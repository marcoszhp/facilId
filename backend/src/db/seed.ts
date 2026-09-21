import path from 'node:path';
import { JsonUsuariosRepository } from '../repositories/usuarios.repository';
import { assinaturaService, carregarChaves } from '../services/assinatura.service';
import { emitirPessoa } from '../services/emissao.service';
import { carregarAdminToken } from '../services/admin.service';
import { ArquivosColetasRepository } from '../repositories/coletas.repository';
const dir=path.resolve(process.env.DATA_DIR||'.local');
carregarAdminToken(dir);
const repo=new JsonUsuariosRepository(path.join(dir,'usuarios.json'));
const assinatura=assinaturaService(carregarChaves(path.join(dir,'keys')));
const coletas=new ArquivosColetasRepository(path.join(dir,'coletas'));
const pin=process.env.DEMO_PIN;
if(pin&&!/^\d{6}$/.test(pin))throw new Error('DEMO_PIN deve conter 6 números.');
for(const pessoa of [{cpf:'12345678900',nome:'Maria Silva',idade:72},{cpf:'98765432100',nome:'José Santos',idade:68}]) {
  // Reexecutar o preparo não deve reativar um exemplo bloqueado pelo responsável.
  if(pin&&!repo.listar().some(registro=>registro.cpf===pessoa.cpf)) emitirPessoa({...pessoa,modo:'demonstracao',pin,assinatura:{largura:320,altura:180,tracos:[[{x:20,y:120},{x:100,y:40},{x:240,y:110}]]}},assinatura,repo,coletas);
}
console.log('Preparo concluído. Emita cartões com assinatura e PIN na área do responsável. DEMO_PIN permite criar exemplos artificiais novos, sem reativar cartões antigos. Nenhum segredo é exibido nos logs.');
