export async function lerNfc():Promise<string> {throw new Error('No navegador, use o modo simulado. NFC requer o aplicativo Android.');}
export async function gravarNfc(_texto:string):Promise<void> {throw new Error('Gravação NFC disponível no aplicativo Android.');}
export async function cancelarNfc():Promise<void> {}
