import path from 'node:path';
import {existsSync} from 'node:fs';
import {carregarAmbiente,diretorioDados,mensagemBanco} from '../config';
import {criarBanco,criarPoolMySql,lerConfigMySql,prepararSchema,validarSchema} from './mysql';
import {migrarJson} from './migrar-json';

async function main(){
  carregarAmbiente();
  const comando=process.argv[2];
  if(!['setup','check','migrate'].includes(comando))throw new Error('Comando de banco inválido.');
  const config=lerConfigMySql();
  if(comando==='setup')await criarBanco(config);
  const pool=criarPoolMySql(config);
  try{
    if(comando==='setup')await prepararSchema(pool);
    await validarSchema(pool);
    if(comando==='migrate'){
      const arquivo=path.join(diretorioDados(),'usuarios.json');
      if(!existsSync(arquivo)){console.log('Não há arquivo de cartões locais para importar. O banco está pronto para novas emissões.');return;}
      const resultado=await migrarJson(arquivo,pool);
      console.log('Migração concluída. Cartões e estados foram preservados; os arquivos de origem e as chaves continuam no diretório privado.');
      // Somente contagens/status, conforme contrato de migração; sem identidade.
      console.log(JSON.stringify(resultado));
    }else console.log(comando==='setup'?'Banco FácilID preparado. Execute npm run db:migrate para importar os cartões locais.':'Conexão e tabelas do FácilID verificadas.');
  }finally{await pool.end();}
}
main().catch(error=>{console.error(mensagemBanco(error));process.exitCode=1;});
