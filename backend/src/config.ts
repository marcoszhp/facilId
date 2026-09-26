import {existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import path from 'node:path';

export const backendDir=path.resolve(__dirname,'..');
export function carregarAmbiente(){
  const arquivo=path.join(backendDir,'.env');
  if(existsSync(arquivo))loadEnvFile(arquivo);
}
export function diretorioDados(){return path.resolve(backendDir,process.env.DATA_DIR||'.local');}
export function clienteBanco(){
  const cliente=process.env.DB_CLIENT||'mysql';
  if(cliente!=='mysql'&&cliente!=='json')throw new Error('DB_CLIENT deve ser mysql ou json.');
  return cliente;
}
// O erro original do driver pode incluir SQL, host ou dados; só códigos conhecidos
// entram no diagnóstico visível, nunca a mensagem ou a configuração da conexão.
export function mensagemBanco(error:unknown){
  const code=error&&typeof error==='object'&&'code' in error?String(error.code):'';
  if(code==='ECONNREFUSED')return 'MySQL indisponível. Inicie MySQL no painel do XAMPP e confira DB_HOST/DB_PORT em backend/.env.';
  if(code==='ER_ACCESS_DENIED_ERROR')return 'Acesso ao MySQL recusado. Confira DB_USER e DB_PASSWORD em backend/.env.';
  if(code==='ER_BAD_DB_ERROR')return 'Banco não encontrado. Execute npm run db:setup para preparar o banco escolhido.';
  if(code==='ER_NO_SUCH_TABLE')return 'Tabelas do FácilID não encontradas. Execute npm run db:setup.';
  if(code==='FACILID_MIGRATION_INVALID')return 'O arquivo de cartões não tem um formato válido para importação. A origem foi preservada; revise o arquivo antes de tentar novamente.';
  if(code==='FACILID_MIGRATION_CONFLICT')return 'A importação diverge dos dados atuais do banco. Nada foi sobrescrito. Importe apenas na configuração inicial, com a API parada.';
  return 'Não foi possível preparar o armazenamento. Confira backend/.env, a disponibilidade do banco e execute npm run db:check.';
}
