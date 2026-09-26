import path from 'node:path';
import {JsonUsuariosRepository,UsuariosRepository} from '../repositories/usuarios.repository';
import {MysqlUsuariosRepository} from '../repositories/mysql-usuarios.repository';
import {clienteBanco} from '../config';
import {criarPoolMySql,lerConfigMySql,validarSchema} from './mysql';

export type Persistencia={repo:UsuariosRepository;verificar:()=>Promise<void>;encerrar:()=>Promise<void>;tipo:'mysql'|'json'};
export async function abrirPersistencia(dir:string):Promise<Persistencia>{
  if(clienteBanco()==='json')return {repo:new JsonUsuariosRepository(path.join(dir,'usuarios.json')),verificar:async()=>{},encerrar:async()=>{},tipo:'json'};
  const pool=criarPoolMySql(lerConfigMySql());
  try{
    await validarSchema(pool);
    return {repo:new MysqlUsuariosRepository(pool),verificar:async()=>{await pool.query('SELECT 1');},encerrar:async()=>{await pool.end();},tipo:'mysql'};
  }catch(error){await pool.end();throw error;}
}
