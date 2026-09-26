import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir,readFile,readdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const watch=process.argv.includes('--watch');
const checks=[['types','npm run typecheck'],['tests','npm test'],['build','npm run build']];
if(process.argv.includes('--mysql'))checks.splice(2,0,['mysql','npm run test:mysql']);
const ignored=new Set(['node_modules','.npm-cache','.expo','dist','.local','reports','.git','android','ios']);
const rootFiles=new Set(['backend','mobile','scripts','package.json','package-lock.json','.gitignore','.npmrc']);
let stopping=false,active;
process.on('SIGINT',()=>{stopping=true;if(active)active.kill();});
process.on('SIGTERM',()=>{stopping=true;if(active)active.kill();});
async function fingerprint(dir=root){
  const hash=createHash('sha256');
  for(const item of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    // Outros projetos/ZIPs do usuário podem estar ao lado do FácilID. Não são fontes deste ciclo.
    if(dir===root&&!rootFiles.has(item.name)&&!item.name.endsWith('.md'))continue;
    if(item.name==='.env')continue;
    if(ignored.has(item.name)||item.isSymbolicLink())continue;
    const file=path.join(dir,item.name);hash.update(file);
    if(item.isDirectory())hash.update(await fingerprint(file));else hash.update(await readFile(file));
  }return hash.digest('hex');
}
async function run(command){
  return new Promise(resolve=>{
    const child=spawn(process.platform==='win32'?(process.env.ComSpec||'cmd.exe'):'/bin/sh',process.platform==='win32'?['/d','/s','/c',command]:['-c',command],{cwd:root,env:{...process.env,CI:'1'},windowsHide:true});
    active=child;let output='',timedOut=false;const started=Date.now();
    const timer=setTimeout(()=>{timedOut=true;if(process.platform==='win32')spawn('taskkill',['/pid',String(child.pid),'/t','/f'],{windowsHide:true});else child.kill('SIGTERM');},240000);
    for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{output+=data;process.stdout.write(data);});
    child.on('error',e=>{output+=e.message;});
    child.on('close',code=>{clearTimeout(timer);active=undefined;resolve({code:code??1,timedOut,durationMs:Date.now()-started,output});});
  });
}
await mkdir(path.join(root,'reports'),{recursive:true});
let cycle=0,last='';
do {
  const before=await fingerprint();
  if(before!==last){
    cycle++;console.log(`\nCiclo ${cycle}: verificando tipos, testes e compilação.`);
    const results=[];
    for(const [name,command] of checks){if(stopping)break;const result=await run(command);results.push({name,...result});await writeFile(path.join(root,'reports',`${name}.log`),result.output);}
    const changed=before!==await fingerprint();
    const passed=!stopping&&!changed&&results.length===checks.length&&results.every(r=>r.code===0&&!r.timedOut);
    const report={cycle,checkedAt:new Date().toISOString(),sourceHash:before,changedDuringRun:changed,status:passed?'passed':stopping?'interrupted':changed?'stale':'failed',checks:results.map(({output,...rest})=>rest)};
    await writeFile(path.join(root,'reports','latest.json'),JSON.stringify(report,null,2));
    await writeFile(path.join(root,'reports',`cycle-${Date.now()}.json`),JSON.stringify(report,null,2));
    console.log(passed?'Verificações aprovadas.':'Há falhas ou mudanças pendentes. Consulte reports/*.log, corrija a causa e execute novamente.');
    last=before;
    if(!watch){process.exitCode=passed?0:1;break;}
    console.log('Aguardando alterações para repetir as verificações. Ctrl+C encerra.');
  }
  if(!stopping)await new Promise(resolve=>setTimeout(resolve,1500));
}while(!stopping);
