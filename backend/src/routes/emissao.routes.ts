import { Router } from 'express';
import { z } from 'zod';
import { cadastroSchema } from '../schemas/payload';
import { UsuariosRepository } from '../repositories/usuarios.repository';
import { assinaturaService } from '../services/assinatura.service';
import { emitirPessoa } from '../services/emissao.service';
import { exigirAdministrador } from '../services/admin.service';

export function emissaoRoutes(repo: UsuariosRepository, assinatura: ReturnType<typeof assinaturaService>, adminToken: string) {
  const router = Router();
  const administrador = exigirAdministrador(adminToken);
  router.post('/emissao', administrador, (req, res) => {
    const data = cadastroSchema.safeParse(req.body);
    if (!data.success) {res.status(400).json({mensagem: 'Confira nome, CPF (11 números) e idade de 0 a 130.'}); return;}
    res.status(201).json(emitirPessoa(data.data, assinatura, repo));
  });
  router.get('/usuarios', administrador, (req, res) => {
    if (Object.keys(req.query).length) {res.status(400).json({mensagem: 'Esta consulta não aceita parâmetros.'}); return;}
    res.json(repo.listar());
  });
  router.get('/cartoes/:emissaoId', administrador, (req, res) => {
    if (!z.string().uuid().safeParse(req.params.emissaoId).success) {res.status(400).json({mensagem: 'Identificador de cartão inválido.'}); return;}
    const registro = repo.buscarEmissao(req.params.emissaoId as string);
    if (!registro) {res.status(404).json({mensagem: 'Cartão não encontrado.'}); return;}
    if (registro.estado !== 'ativo') {res.status(409).json({mensagem: 'Este cartão está bloqueado ou foi substituído. Emita um novo cartão.'}); return;}
    res.json(registro.chip);
  });
  router.post('/cartoes/:emissaoId/bloquear', administrador, (req, res) => {
    if (!z.string().uuid().safeParse(req.params.emissaoId).success) {res.status(400).json({mensagem: 'Identificador de cartão inválido.'}); return;}
    const registro = repo.bloquear(req.params.emissaoId as string);
    if (!registro) {res.status(404).json({mensagem: 'Cartão não encontrado.'}); return;}
    res.json({emissaoId: registro.chip.emissaoId, estado: registro.estado});
  });
  return router;
}
