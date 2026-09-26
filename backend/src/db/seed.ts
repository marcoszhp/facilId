import path from 'node:path';
import { assinaturaService, carregarChaves } from '../services/assinatura.service';
import { emitirPessoa } from '../services/emissao.service';
import { carregarAdminToken } from '../services/admin.service';
import { ArquivosColetasRepository } from '../repositories/coletas.repository';
import { carregarAmbiente,diretorioDados,mensagemBanco } from '../config';
import { abrirPersistencia } from './persistencia';

async function main(){
  carregarAmbiente();
  const dir=diretorioDados(),pin=process.env.DEMO_PIN;
  if(pin&&!/^\d{6}$/.test(pin))throw new Error('DEMO_PIN deve conter 6 números.');
  const persistencia=await abrirPersistencia(dir);
  try{
    carregarAdminToken(dir);
    const repo=persistencia.repo;
    const assinatura=assinaturaService(carregarChaves(path.join(dir,'keys')));
    const coletas=new ArquivosColetasRepository(path.join(dir,'coletas'));
    for(const pessoa of [{cpf:'12345678900',nome:'Maria Silva',idade:72},{cpf:'98765432100',nome:'José Santos',idade:68}]){
      // Reexecutar o preparo não deve reativar um exemplo bloqueado pelo responsável.
      if(pin&&!(await repo.listar()).some(registro=>registro.cpf===pessoa.cpf))await emitirPessoa({...pessoa,modo:'demonstracao',pin,assinatura:{largura:320,altura:180,tracos:[[{x:20,y:120},{x:100,y:40},{x:240,y:110}]]}},assinatura,repo,coletas);
    }
    console.log('Preparo concluído. Emita cartões com assinatura e PIN na área do responsável. DEMO_PIN cria apenas exemplos artificiais novos; nenhum segredo é exibido nos logs.');
  }finally{await persistencia.encerrar();}
}
main().catch(error=>{console.error(mensagemBanco(error));process.exitCode=1;});
