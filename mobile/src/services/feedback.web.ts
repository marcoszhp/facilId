export function falar(texto:string) {
  if(typeof window!=='undefined' && 'speechSynthesis' in window) {window.speechSynthesis.cancel(); const fala=new SpeechSynthesisUtterance(texto);fala.lang='pt-BR';window.speechSynthesis.speak(fala);}
}
export function feedback(texto:string,sucesso:boolean) {if(typeof navigator!=='undefined') navigator.vibrate?.(sucesso?120:[100,80,100]);falar(texto);}
