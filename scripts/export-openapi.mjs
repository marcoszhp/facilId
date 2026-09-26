import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
// Somente a declaração pública: não importa app/server nem abre dados privados.
const {swagger}=require(path.join(root,'backend/dist/docs/swagger.js'));
if(swagger.openapi!=='3.0.3'||!swagger.paths)throw new Error('Contrato OpenAPI inválido. Compile o backend antes de exportar.');
await mkdir(path.join(root,'docs'),{recursive:true});
await writeFile(path.join(root,'docs/openapi.json'),JSON.stringify(swagger,null,2)+'\n');
console.log('Contrato público exportado para docs/openapi.json.');
