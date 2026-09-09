import { Router } from 'express';
import { loginSchema } from '../schemas/payload';
import { assinaturaService } from '../services/assinatura.service';
import { authService } from '../services/auth.service';
import { UsuariosRepository } from '../repositories/usuarios.repository';
export function autenticacaoRoutes(repo:UsuariosRepository, assinatura:ReturnType<typeof assinaturaService>, auth:ReturnType<typeof authService>) {
  const router=Router();
  router.post('/autenticar-nfc',(req,res)=>{
    const parsed=loginSchema.safeParse(req.body);
    if(!parsed.success) {res.status(401).json({sucesso:false,mensagem:'Cartão não reconhecido. Confira o CPF e leia novamente.'});return;}
    const {cpfDigitado,dadosChip}=parsed.data;
    const fail=(mensagem:string)=>res.status(401).json({sucesso:false,mensagem});
    if(dadosChip.cpf!==cpfDigitado) {fail('CPF não confere com o cartão.');return;}
    if(!assinatura.validar(dadosChip)) {fail('Assinatura inválida. Solicite outro cartão.');return;}
    if(repo.buscar(cpfDigitado)?.assinatura_digital_orgao!==dadosChip.assinatura_digital_orgao) {fail('Cartão não reconhecido ou substituído.');return;}
    res.json({sucesso:true,token:auth.emitir(cpfDigitado),perfil:{cpf:dadosChip.cpf,nome:dadosChip.nome,idade:dadosChip.idade}});
  });
  router.get('/perfil',(req,res)=>{
    try {const claims=auth.validar((req.headers.authorization||'').replace(/^Bearer /,''));
      if(typeof claims==='string' || !claims.sub) throw new Error();
      const pessoa=repo.buscar(claims.sub); if(!pessoa) throw new Error();
      res.json({cpf:pessoa.cpf,nome:pessoa.nome,idade:pessoa.idade});
    } catch {res.status(401).json({mensagem:'Sessão encerrada. Entre novamente.'});}
  });
  return router;
}
