import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { swagger } from './docs/swagger';
import { JsonUsuariosRepository, UsuariosRepository } from './repositories/usuarios.repository';
import { assinaturaService, carregarChaves } from './services/assinatura.service';
import { authService } from './services/auth.service';
import { emissaoRoutes } from './routes/emissao.routes';
import { autenticacaoRoutes } from './routes/autenticacao.routes';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { carregarAdminToken } from './services/admin.service';
import { ArquivosColetasRepository } from './repositories/coletas.repository';
import { ErroColeta } from './services/coleta.service';
export function createApp(dataDir:string,secret:string,adminToken=carregarAdminToken(dataDir),options?:{repo?:UsuariosRepository;verificarPersistencia?:()=>Promise<void>}) {
  const app=express(); const repo=options?.repo ?? new JsonUsuariosRepository(path.join(dataDir,'usuarios.json'));
  const assinatura=assinaturaService(carregarChaves(path.join(dataDir,'keys')));
  const coletas=new ArquivosColetasRepository(path.join(dataDir,'coletas'));
  app.disable('x-powered-by');
  app.use((_req,res,next)=>{res.locals.requestId=randomUUID();res.setHeader('X-Request-Id',res.locals.requestId);next();});
  app.use(cors({origin:process.env.CORS_ORIGIN?.split(',') || ['http://localhost:8081','http://127.0.0.1:8081'],exposedHeaders:['X-Request-Id','Retry-After']}));
  // Autorização vem antes dos parsers maiores; nenhuma foto usa o parser geral.
  app.use('/api',emissaoRoutes(repo,assinatura,adminToken,coletas));
  app.use(express.json({limit:'16kb'}));
  app.get('/health',async (_req,res)=>{
    try {await options?.verificarPersistencia?.();res.json({status:'ok'});}
    catch {res.status(503).json({status:'indisponivel',mensagem:'Banco de dados indisponível.'});}
  });
  app.get('/openapi.json',(_req,res)=>res.json(swagger));
  app.use('/docs',swaggerUi.serve,swaggerUi.setup(swagger));
  app.use('/api',autenticacaoRoutes(repo,assinatura,authService(secret),coletas));
  app.use((_req,res)=>{res.status(404).json({mensagem:'Endereço não encontrado.'});});
  app.use((error:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
    const status=error instanceof ErroColeta?error.status:error.type==='entity.too.large'?413:error.type==='entity.parse.failed'?400:500;
    res.status(status).json({mensagem:error instanceof ErroColeta?error.message:status===500?'Não foi possível concluir. Tente novamente.':'Dados enviados em formato inválido ou muito grandes.',requestId:res.locals.requestId});
  });
  return app;
}
