let ativo=false,sequencia=0;
const observadores=new Set<(ativo:boolean)=>void>();
function atualizar(valor:boolean){ativo=valor;observadores.forEach(fn=>fn(valor));}
export function observarAudio(observer:(ativo:boolean)=>void){observadores.add(observer);observer(ativo);return()=>{observadores.delete(observer);};}
export function pararAudio(){sequencia++;if(typeof window!=='undefined'&&'speechSynthesis' in window)window.speechSynthesis.cancel();atualizar(false);}
export function falar(texto:string) {
  pararAudio();if(typeof window==='undefined'||!('speechSynthesis' in window))return;
  const chamada=sequencia,fala=new SpeechSynthesisUtterance(texto);fala.lang='pt-BR';
  fala.onend=fala.onerror=()=>{if(chamada===sequencia)atualizar(false);};
  atualizar(true);window.speechSynthesis.speak(fala);
}
export function feedback(texto:string,sucesso:boolean) {try{if(typeof navigator!=='undefined')navigator.vibrate?.(sucesso?120:[100,80,100]);}catch{}falar(texto);}
