import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'mobile','package.json'));
// Cache do Expo dentro do projeto permite trabalhar sem escrever no perfil do usuário.
const cli=path.join(path.dirname(require.resolve('expo/package.json')),'bin','cli');
const child=spawn(process.execPath,[cli,...process.argv.slice(2)],{cwd:path.join(root,'mobile'),stdio:'inherit',windowsHide:true,env:{...process.env,EXPO_NO_TELEMETRY:'1',__UNSAFE_EXPO_HOME_DIRECTORY:path.join(root,'.expo')}});
child.on('error',e=>{console.error(e.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
