const mensagem='Neste navegador, confirme o acesso com seu PIN. A biometria está disponível no aplicativo instalado em aparelho compatível.';
export async function disponibilidadeBiometria(){return {disponivel:false,mensagem};}
export async function lerCredencialBiometrica(_url:string,_emissaoId:string):Promise<{credencial?:string;mensagem?:string}>{return {mensagem};}
export async function guardarCredencialBiometrica(_url:string,_emissaoId:string,_credencial:string){return false;}
