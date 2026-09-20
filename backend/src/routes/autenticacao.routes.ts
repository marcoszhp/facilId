import { Router } from 'express';
import { loginSchema } from '../schemas/payload';
import { assinaturaService } from '../services/assinatura.service';
import { authService } from '../services/auth.service';
import { UsuariosRepository } from '../repositories/usuarios.repository';
import { exigirSessao } from '../middleware/sessao';

export function autenticacaoRoutes(repo: UsuariosRepository, assinatura: ReturnType<typeof assinaturaService>, auth: ReturnType<typeof authService>) {
  const router = Router();
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
    res.json({sucesso: true, ...auth.emitir(cpfDigitado, dadosChip.emissaoId), perfil: {cpf: dadosChip.cpf, nome: dadosChip.nome, idade: dadosChip.idade}});
  });
  router.get('/perfil', exigirSessao(repo, auth), (_req, res) => {res.json(res.locals.perfil);});
  return router;
}
