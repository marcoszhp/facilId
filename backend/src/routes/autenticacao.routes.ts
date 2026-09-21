import { Router } from 'express';
import { loginSchema } from '../schemas/payload';
import { assinaturaService } from '../services/assinatura.service';
import { authService } from '../services/auth.service';
import { UsuariosRepository } from '../repositories/usuarios.repository';
import { exigirSessao } from '../middleware/sessao';
import { ColetasRepository } from '../repositories/coletas.repository';
import { confirmacaoSchema } from '../schemas/coleta';
import { desafioService } from '../services/desafio.service';

export function autenticacaoRoutes(repo: UsuariosRepository, assinatura: ReturnType<typeof assinaturaService>, auth: ReturnType<typeof authService>, coletas: ColetasRepository) {
  const router = Router();
  const desafios = desafioService();
  router.post('/autenticar-nfc', (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    const fail = (mensagem: string) => res.status(401).json({sucesso: false, mensagem});
    if (!parsed.success) {
      fail(req.body?.dadosChip && req.body.dadosChip.versao === undefined
        ? 'Cartão antigo ou inválido. Peça ao responsável para emitir um novo cartão.'
        : 'Cartão não reconhecido. Confira o CPF e leia novamente.');
      return;
    }
    const {cpfDigitado, dadosChip} = parsed.data;
    if (dadosChip.cpf !== cpfDigitado) {fail('CPF não confere com o cartão.'); return;}
    if (!assinatura.validar(dadosChip)) {fail('Assinatura inválida. Solicite outro cartão.'); return;}
    const registro = repo.buscarEmissao(dadosChip.emissaoId);
    if (!registro || registro.estado !== 'ativo' || registro.chip.assinatura_digital_orgao !== dadosChip.assinatura_digital_orgao) {
      fail('Cartão não reconhecido, bloqueado ou substituído. Solicite ajuda ao responsável.'); return;
    }
    if (!coletas.obter(dadosChip.emissaoId)) {fail('Este cartão precisa de nova emissão com assinatura e PIN. Peça ajuda ao responsável.'); return;}
    res.json(desafios.criar(dadosChip.emissaoId));
  });
  router.post('/autenticar-confirmar', (req, res) => {
    const dados = confirmacaoSchema.safeParse(req.body);
    if (!dados.success) {res.status(400).json({mensagem: 'Informe o desafio e apenas o PIN de 6 números ou a credencial do aparelho.'}); return;}
    const desafio = desafios.obter(dados.data.desafioId);
    const registro = desafio && repo.buscarEmissao(desafio.emissaoId);
    if (!desafio || !registro || registro.estado !== 'ativo' || !coletas.obter(desafio.emissaoId)) {
      desafios.consumir(dados.data.desafioId);
      res.status(401).json({mensagem: 'Verificação expirada ou cartão inválido. Leia o cartão novamente.'}); return;
    }
    const fator = coletas.verificarFator(desafio.emissaoId, dados.data, dados.data.registrarDispositivo === true);
    if (fator.status === 'limitado') {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((fator.tentarEm! - Date.now()) / 1000))));
      res.status(429).json({mensagem: 'Muitas tentativas. Aguarde 30 segundos antes de tentar novamente.', tentarEm: fator.tentarEm}); return;
    }
    if (fator.status !== 'ok') {res.status(401).json({mensagem: 'PIN ou confirmação do aparelho inválido. Tente novamente.'}); return;}
    desafios.consumir(dados.data.desafioId);
    const chip = registro.chip;
    res.json({sucesso: true, ...auth.emitir(chip.cpf, chip.emissaoId), perfil: {cpf: chip.cpf, nome: chip.nome, idade: chip.idade},
      ...(fator.credencialDispositivo ? {credencialDispositivo: fator.credencialDispositivo} : {})});
  });
  router.get('/perfil', exigirSessao(repo, auth, coletas), (_req, res) => {res.json(res.locals.perfil);});
  return router;
}
