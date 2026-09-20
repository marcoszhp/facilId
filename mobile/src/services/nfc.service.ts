import NfcManager, { Ndef, NfcTech, NdefStatus } from 'react-native-nfc-manager';
let geracao = 0;
let operacaoEmAndamento = false;

class OperacaoNfcCancelada extends Error {
  constructor() { super('Leitura NFC cancelada.'); this.name = 'AbortError'; }
}

async function preparar(conferir: () => void) {
  if(!await NfcManager.isSupported()) throw new Error('Este aparelho não possui NFC. Use o modo simulado.');
  conferir();
  await NfcManager.start();
  conferir();
  if(!await NfcManager.isEnabled()) throw new Error('Ative o NFC nas configurações do aparelho.');
  conferir();
}

async function executar<T>(acao: (conferir: () => void) => Promise<T>): Promise<T> {
  if (operacaoEmAndamento) throw new Error('Aguarde o encerramento da leitura anterior e tente novamente.');
  operacaoEmAndamento = true;
  const atual = ++geracao;
  const conferir = () => { if (atual !== geracao) throw new OperacaoNfcCancelada(); };
  try {
    await preparar(conferir);
    return await acao(conferir);
  } finally {
    // Não permitir outra operação até a lib encerrar a anterior, inclusive após cancelamento.
    await NfcManager.cancelTechnologyRequest().catch(() => {});
    operacaoEmAndamento = false;
  }
}

export async function lerNfc():Promise<string> {
  return executar(async conferir => {
    conferir();
    await NfcManager.requestTechnology(NfcTech.Ndef,{alertMessage:'Aproxime seu cartão.'});
    conferir();
    const tag=await NfcManager.getTag();
    conferir();
    const record=tag?.ndefMessage?.find(r=>r.tnf===Ndef.TNF_WELL_KNOWN&&(typeof r.type==='string'?r.type:String.fromCharCode(...r.type))==='T');
    if(!record) throw new Error('Cartão sem código de identidade.');
    return Ndef.text.decodePayload(Uint8Array.from(record.payload));
  });
}
export async function gravarNfc(texto:string) {
  return executar(async conferir => {
    conferir();
    await NfcManager.requestTechnology(NfcTech.Ndef,{alertMessage:'Aproxime uma tag NDEF com espaço disponível.'});
    conferir();
    const bytes=Ndef.encodeMessage([Ndef.textRecord(texto)]);
    const status=await NfcManager.ndefHandler.getNdefStatus();
    conferir();
    if(status.status===NdefStatus.ReadOnly) throw new Error('Este cartão é somente leitura. Use uma tag gravável.');
    // O JSON RSA excede NTAG213/215. Nunca truncar o conteúdo assinado.
    if(!bytes || bytes.length>status.capacity) throw new Error(`O cartão precisa de ${bytes?.length||0} bytes; esta tag tem ${status.capacity}. Use uma tag NDEF maior.`);
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
    conferir();
  });
}
export async function cancelarNfc() {
  ++geracao;
  await NfcManager.cancelTechnologyRequest().catch(()=>{});
}
