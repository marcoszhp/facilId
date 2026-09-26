import { createApp } from './app';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { carregarAdminToken } from './services/admin.service';
import { carregarAmbiente,diretorioDados,mensagemBanco } from './config';
import { abrirPersistencia } from './db/persistencia';

async function iniciar(){
  carregarAmbiente();
  const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Porta inválida.');
  const dir=diretorioDados(),persistencia=await abrirPersistencia(dir);
  try{
    mkdirSync(dir,{recursive:true});
    const secretFile=path.join(dir,'jwt.secret');
    if(!process.env.JWT_SECRET&&!existsSync(secretFile))writeFileSync(secretFile,randomBytes(48).toString('hex'),{mode:0o600,flag:'wx'});
    const app=createApp(dir,process.env.JWT_SECRET||readFileSync(secretFile,'utf8'),carregarAdminToken(dir),{repo:persistencia.repo,verificarPersistencia:persistencia.verificar});
    const server=app.listen(port,host,()=>console.log('FácilID: http://'+host+':'+port+' — documentação em /docs — armazenamento: '+persistencia.tipo));
    let encerrando=false;
    const encerrar=()=>{
      if(encerrando)return;
      encerrando=true;
      server.close(()=>{void persistencia.encerrar().catch(()=>{process.exitCode=1;});});
    };
    process.once('SIGINT',encerrar);process.once('SIGTERM',encerrar);
    server.once('error',()=>{console.error('Não foi possível abrir a porta da API. Confira PORT e se outro servidor está em execução.');void persistencia.encerrar().catch(()=>{process.exitCode=1;});process.exitCode=1;});
  }catch(error){await persistencia.encerrar();throw error;}
}
iniciar().catch(error=>{console.error(mensagemBanco(error));process.exitCode=1;});
