import { Router } from 'express';
import { cadastroSchema } from '../schemas/payload';
import { UsuariosRepository } from '../repositories/usuarios.repository';
import { assinaturaService } from '../services/assinatura.service';
import { emitirPessoa } from '../services/emissao.service';
export function emissaoRoutes(repo:UsuariosRepository, assinatura:ReturnType<typeof assinaturaService>) {
  const router=Router();
  router.post('/emissao',(req,res)=>{const data=cadastroSchema.safeParse(req.body); if(!data.success) {res.status(400).json({mensagem:'Confira nome, CPF (11 números) e idade de 0 a 130.'});return;} res.status(201).json(emitirPessoa(data.data,assinatura,repo));});
  router.get('/usuarios',(req,res)=>{if(Object.keys(req.query).length) {res.status(400).json({mensagem:'Esta consulta não aceita parâmetros.'});return;} res.json(repo.listar());});
  return router;
}
