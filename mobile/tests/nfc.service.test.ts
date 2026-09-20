import NfcManager, { Ndef, NdefStatus, NfcTech } from 'react-native-nfc-manager';
import { cancelarNfc, gravarNfc, lerNfc } from '../src/services/nfc.service';

jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  // Codificação real; somente o transporte Android é simulado.
  Ndef: require('react-native-nfc-manager/ndef-lib'),
  NfcTech: { Ndef: 'Ndef' },
  NdefStatus: { ReadOnly: 1, ReadWrite: 2 },
  default: {
    isSupported: jest.fn(), start: jest.fn(), isEnabled: jest.fn(),
    requestTechnology: jest.fn(), getTag: jest.fn(), cancelTechnologyRequest: jest.fn(),
    ndefHandler: { getNdefStatus: jest.fn(), writeNdefMessage: jest.fn() },
  },
}));

const manager = jest.mocked(NfcManager);
const conteudo = JSON.stringify({ exemplo: 'Cartão de demonstração', assinatura: 'x'.repeat(700) });

beforeEach(() => {
  jest.clearAllMocks();
  manager.isSupported.mockResolvedValue(true);
  manager.start.mockResolvedValue(undefined);
  manager.isEnabled.mockResolvedValue(true);
  manager.requestTechnology.mockResolvedValue(NfcTech.Ndef);
  manager.cancelTechnologyRequest.mockResolvedValue(undefined);
  manager.getTag.mockResolvedValue({ ndefMessage: [Ndef.textRecord(conteudo)] } as never);
  manager.ndefHandler.getNdefStatus.mockResolvedValue({ status: NdefStatus.ReadWrite, capacity: 2048 });
  manager.ndefHandler.writeNdefMessage.mockResolvedValue(undefined);
});

test('P1.1 mantém arquitetura legada exigida pela biblioteca NFC v3', () => {
  expect(require('../app.json').expo.newArchEnabled).toBe(false);
  expect(require('../package.json').dependencies['react-native-nfc-manager']).toBe('3.17.2');
});

test('lê o texto NDEF completo sem alterar o JSON e encerra a operação', async () => {
  await expect(lerNfc()).resolves.toBe(conteudo);
  expect(manager.cancelTechnologyRequest).toHaveBeenCalled();
});

test('aceita tipo do registro entregue pelo Android como vetor de bytes', async () => {
  const registro = { ...Ndef.textRecord(conteudo), type: [84] };
  manager.getTag.mockResolvedValue({ ndefMessage: [registro] } as never);
  await expect(lerNfc()).resolves.toBe(conteudo);
});

test('grava todo o NDEF numa tag com capacidade e libera a operação', async () => {
  await gravarNfc(conteudo);
  expect(manager.ndefHandler.writeNdefMessage).toHaveBeenCalledWith(Ndef.encodeMessage([Ndef.textRecord(conteudo)]));
  expect(manager.cancelTechnologyRequest).toHaveBeenCalled();
});

test.each([144, 504])('não trunca credencial para caber em tag de %i bytes', async capacity => {
  manager.ndefHandler.getNdefStatus.mockResolvedValue({ status: NdefStatus.ReadWrite, capacity });
  await expect(gravarNfc(conteudo)).rejects.toThrow('Use uma tag NDEF maior');
  expect(manager.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();
});

test('recusa tag somente leitura e ainda libera a operação', async () => {
  manager.ndefHandler.getNdefStatus.mockResolvedValue({ status: NdefStatus.ReadOnly, capacity: 2048 });
  await expect(gravarNfc(conteudo)).rejects.toThrow('somente leitura');
  expect(manager.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();
  expect(manager.cancelTechnologyRequest).toHaveBeenCalled();
});

test('cancelamento durante preparação impede abrir uma leitura depois de sair da tela', async () => {
  let resolver!: (supported: boolean) => void;
  manager.isSupported.mockReturnValueOnce(new Promise(resolve => { resolver = resolve; }));
  const leitura = lerNfc();
  const resultado = expect(leitura).rejects.toMatchObject({ name: 'AbortError' });
  await cancelarNfc();
  resolver(true);
  await resultado;
  expect(manager.requestTechnology).not.toHaveBeenCalled();
});

test('cancelamento enquanto aguarda tag ignora resposta nativa tardia', async () => {
  let resolver!: (tech: NfcTech | null) => void;
  let iniciou!: () => void;
  const inicio = new Promise<void>(resolve => { iniciou = resolve; });
  manager.requestTechnology.mockImplementationOnce(() => {
    iniciou();
    return new Promise(resolve => { resolver = resolve; });
  });
  const leitura = lerNfc();
  const resultado = expect(leitura).rejects.toMatchObject({ name: 'AbortError' });
  await inicio;
  await cancelarNfc();
  resolver(NfcTech.Ndef);
  await resultado;
  expect(manager.getTag).not.toHaveBeenCalled();
});

test('falha de leitura encerra a operação e permite tentar novamente', async () => {
  manager.getTag.mockResolvedValueOnce({ ndefMessage: [] } as never);
  await expect(lerNfc()).rejects.toThrow('Cartão sem código');
  await expect(lerNfc()).resolves.toBe(conteudo);
});
