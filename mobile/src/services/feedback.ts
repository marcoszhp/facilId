import Tts from 'react-native-tts';
import HapticFeedback from 'react-native-haptic-feedback';
export function falar(texto:string) {
  void Tts.getInitStatus().then(async()=>{await Tts.setDefaultLanguage('pt-BR'); await Tts.stop(); Tts.speak(texto);}).catch(()=>{});
}
export function feedback(texto:string,sucesso:boolean) {
  // A indisponibilidade de vibração nunca deve transformar um login válido em erro.
  try {HapticFeedback.trigger(sucesso?'notificationSuccess':'notificationError',{enableVibrateFallback:true,ignoreAndroidSystemSettings:false});} catch {}
  falar(texto);
}
