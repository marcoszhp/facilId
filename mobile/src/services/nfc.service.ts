import NfcManager, { Ndef, NfcTech, NdefStatus } from 'react-native-nfc-manager';
async function preparar() {
  if(!await NfcManager.isSupported()) throw new Error('Este aparelho não possui NFC. Use o modo simulado.');
  await NfcManager.start();
  if(!await NfcManager.isEnabled()) throw new Error('Ative o NFC nas configurações do aparelho.');
}
export async function lerNfc():Promise<string> {
  await preparar();
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef,{alertMessage:'Aproxime seu cartão.'});
    const tag=await NfcManager.getTag();
    const record=tag?.ndefMessage?.find(r=>r.tnf===Ndef.TNF_WELL_KNOWN&&(typeof r.type==='string'?r.type:String.fromCharCode(...r.type))==='T');
    if(!record) throw new Error('Cartão sem código de identidade.');
    return Ndef.text.decodePayload(Uint8Array.from(record.payload));
  } finally {await NfcManager.cancelTechnologyRequest().catch(()=>{});}
}
export async function gravarNfc(texto:string) {
  await preparar();
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef,{alertMessage:'Aproxime uma tag NDEF com espaço disponível.'});
    const bytes=Ndef.encodeMessage([Ndef.textRecord(texto)]);
    const status=await NfcManager.ndefHandler.getNdefStatus();
    if(status.status===NdefStatus.ReadOnly) throw new Error('Este cartão é somente leitura. Use uma tag gravável.');
    // O JSON RSA excede NTAG213/215. Nunca truncar o conteúdo assinado.
    if(!bytes || bytes.length>status.capacity) throw new Error(`O cartão precisa de ${bytes?.length||0} bytes; esta tag tem ${status.capacity}. Use uma tag NDEF maior.`);
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
  } finally {await NfcManager.cancelTechnologyRequest().catch(()=>{});}
}
export async function cancelarNfc() {await NfcManager.cancelTechnologyRequest().catch(()=>{});}
