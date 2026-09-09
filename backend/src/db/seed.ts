import path from 'node:path';
import { JsonUsuariosRepository } from '../repositories/usuarios.repository';
import { assinaturaService, carregarChaves } from '../services/assinatura.service';
import { emitirPessoa } from '../services/emissao.service';
const dir=path.resolve(process.env.DATA_DIR||'.local');
const repo=new JsonUsuariosRepository(path.join(dir,'usuarios.json'));
const assinatura=assinaturaService(carregarChaves(path.join(dir,'keys')));
for(const pessoa of [{cpf:'12345678900',nome:'Maria Silva',idade:72},{cpf:'98765432100',nome:'José Santos',idade:68}]) {
  if(!repo.buscar(pessoa.cpf)) emitirPessoa(pessoa,assinatura,repo);
}
console.log('Maria Silva e José Santos disponíveis em GET /api/usuarios.');
