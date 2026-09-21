import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const indisponivel='Biometria indisponível ou não configurada. Use seu PIN para continuar.';
const opcoes={requireAuthentication:true,authenticationPrompt:'Confirme seu acesso ao FácilID',keychainService:'facilid-biometria-v1',keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY};
// Separa credenciais por servidor e emissão sem guardar o CPF na chave.
function chave(url:string,emissaoId:string){
  const servidor=url.replace(/\/$/,'');
  if(servidor.length>512||!/^https?:\/\/[^\s]+$/.test(servidor)||! /^[\da-f-]{36}$/i.test(emissaoId))throw new Error('Referência de cartão inválida.');
  return `facilid.${servidor.split('').map(c=>c.charCodeAt(0).toString(16).padStart(4,'0')).join('')}.${emissaoId}`;
}
export async function disponibilidadeBiometria():Promise<{disponivel:boolean;mensagem:string}>{
  try{
    const disponivel=await LocalAuthentication.hasHardwareAsync()&&await LocalAuthentication.isEnrolledAsync()&&SecureStore.canUseBiometricAuthentication();
    return {disponivel,mensagem:disponivel?'Biometria disponível neste aparelho.':indisponivel};
  }catch{return {disponivel:false,mensagem:indisponivel};}
}
export async function lerCredencialBiometrica(url:string,emissaoId:string):Promise<{credencial?:string;mensagem?:string}>{
  if(!(await disponibilidadeBiometria()).disponivel)return {mensagem:indisponivel};
  try{
    // A autenticação nativa protege a leitura do segredo; um booleano enviado
    // pelo aplicativo jamais é suficiente para o servidor liberar uma sessão.
    const credencial=await SecureStore.getItemAsync(chave(url,emissaoId),opcoes);
    return credencial?{credencial}:{mensagem:'Use o PIN e habilite a biometria neste aparelho novamente.'};
  }catch{return {mensagem:'A biometria não foi confirmada. Use seu PIN ou tente novamente.'};}
}
export async function guardarCredencialBiometrica(url:string,emissaoId:string,credencial:string):Promise<boolean>{
  if(!(await disponibilidadeBiometria()).disponivel||! /^[\da-f]{64}$/i.test(credencial))return false;
  try{await SecureStore.setItemAsync(chave(url,emissaoId),credencial,opcoes);return true;}
  catch{return false;}
}
