import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const children=[spawn(process.execPath,[require.resolve('typescript/bin/tsc'),'--watch','--preserveWatchOutput'],{stdio:'inherit',windowsHide:true}),spawn(process.execPath,['--watch','dist/server.js'],{stdio:'inherit',windowsHide:true})];
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill();process.exitCode=code;}
for(const child of children){child.on('error',e=>{console.error(e);stop(1);});child.on('exit',code=>stop(code??1));}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
