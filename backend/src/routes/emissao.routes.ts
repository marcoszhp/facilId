import { Router, json } from 'express';
import { z } from 'zod';
import { emissaoSchema, fotoSchema } from '../schemas/coleta';
import { UsuariosRepository } from '../repositories/usuarios.repository';
import { assinaturaService } from '../services/assinatura.service';
import { emitirPessoa } from '../services/emissao.service';
import { exigirAdministrador } from '../services/admin.service';
import { ColetasRepository } from '../repositories/coletas.repository';
import { validarFoto } from '../services/coleta.service';

export function emissaoRoutes(repo: UsuariosRepository, assinatura: ReturnType<typeof assinaturaService>, adminToken: string, coletas: ColetasRepository) {
  const router = Router();
  const administrador = exigirAdministrador(adminToken);
  router.post('/emissao/foto', administrador, json({limit: '3mb'}), (req, res) => {
    const dados = fotoSchema.safeParse(req.body);
    if (!dados.success) {res.status(400).json({mensagem: 'Envie uma foto JPEG ou PNG de até 2 MB.'}); return;}
    res.status(201).json(coletas.guardarFoto(validarFoto(dados.data.base64, dados.data.mimeType), dados.data.mimeType));
  });
  router.post('/emissao', administrador, json({limit: '64kb'}), async (req, res) => {
    const data = emissaoSchema.safeParse(req.body);
    if (!data.success) {res.status(400).json({mensagem: 'Confira os dados, o PIN de 6 números e a assinatura desenhada. No modo real, confirme o consentimento e capture a foto.'}); return;}
    res.status(201).json(await emitirPessoa(data.data, assinatura, repo, coletas));
  });
  router.get('/usuarios', administrador, async (req, res) => {
    if (Object.keys(req.query).length) {res.status(400).json({mensagem: 'Esta consulta não aceita parâmetros.'}); return;}
    res.json(await repo.listar());
  });
  router.get('/cartoes/:emissaoId', administrador, async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.emissaoId).success) {res.status(400).json({mensagem: 'Identificador de cartão inválido.'}); return;}
    const registro = await repo.buscarEmissao(req.params.emissaoId as string);
    if (!registro) {res.status(404).json({mensagem: 'Cartão não encontrado.'}); return;}
    if (registro.estado !== 'ativo') {res.status(409).json({mensagem: 'Este cartão está bloqueado ou foi substituído. Emita um novo cartão.'}); return;}
    res.json(registro.chip);
  });
  router.get('/cartoes/:emissaoId/coleta', administrador, (req, res) => {
    if (!z.string().uuid().safeParse(req.params.emissaoId).success) {res.status(400).json({mensagem: 'Identificador de cartão inválido.'}); return;}
    const coleta = coletas.obter(req.params.emissaoId as string);
    if (!coleta) {res.status(404).json({mensagem: 'Coleta não encontrada. Cartões antigos precisam de reemissão.'}); return;}
    res.json(coleta);
  });
  router.post('/cartoes/:emissaoId/bloquear', administrador, async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.emissaoId).success) {res.status(400).json({mensagem: 'Identificador de cartão inválido.'}); return;}
    const registro = await repo.bloquear(req.params.emissaoId as string);
    if (!registro) {res.status(404).json({mensagem: 'Cartão não encontrado.'}); return;}
    res.json({emissaoId: registro.chip.emissaoId, estado: registro.estado});
  });
  return router;
}
