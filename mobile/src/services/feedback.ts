import Tts from 'react-native-tts';
import HapticFeedback from 'react-native-haptic-feedback';
let ativo=false,sequencia=0,ouvindo=false,utteranceId:string|number|null=null;
const observadores=new Set<(ativo:boolean)=>void>();
function atualizar(valor:boolean){ativo=valor;observadores.forEach(fn=>fn(valor));}
export function observarAudio(observer:(ativo:boolean)=>void){observadores.add(observer);observer(ativo);return()=>{observadores.delete(observer);};}
function observarConclusao(){
  if(ouvindo)return;
  ouvindo=true;
  const concluir=(event:{utteranceId:string|number})=>{if(event.utteranceId===utteranceId){utteranceId=null;atualizar(false);}};
  Tts.addEventListener('tts-finish',concluir);Tts.addEventListener('tts-cancel',concluir);Tts.addEventListener('tts-error',concluir);
}
export function pararAudio(){sequencia++;utteranceId=null;atualizar(false);try{void Tts.stop().catch(()=>{});}catch{}}
export function falar(texto:string) {
  const chamada=++sequencia;utteranceId=null;atualizar(true);
  void Promise.resolve().then(async()=>{
    observarConclusao();await Tts.getInitStatus();if(chamada!==sequencia)return;
    await Tts.setDefaultLanguage('pt-BR');if(chamada!==sequencia)return;
    await Tts.stop();if(chamada!==sequencia)return;
    const id=await Promise.resolve(Tts.speak(texto));
    if(chamada===sequencia)utteranceId=id;
  }).catch(()=>{if(chamada===sequencia)atualizar(false);});
}
export function feedback(texto:string,sucesso:boolean) {
  try {HapticFeedback.trigger(sucesso?'notificationSuccess':'notificationError',{enableVibrateFallback:true,ignoreAndroidSystemSettings:false});} catch {}
  falar(texto);
}
