import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { disponibilidadeBiometria, guardarCredencialBiometrica, lerCredencialBiometrica } from '../src/services/biometria.service';
import { cartao, pendente } from './helpers';

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(), isEnrolledAsync: jest.fn(),
}));
jest.mock('expo-secure-store', () => ({
  canUseBiometricAuthentication: jest.fn(), isAvailableAsync: jest.fn(),
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

beforeEach(() => {
  jest.mocked(LocalAuthentication.hasHardwareAsync).mockReset().mockResolvedValue(true);
  jest.mocked(LocalAuthentication.isEnrolledAsync).mockReset().mockResolvedValue(true);
  jest.mocked(SecureStore.canUseBiometricAuthentication).mockReset().mockReturnValue(true);
  jest.mocked(SecureStore.isAvailableAsync).mockReset().mockResolvedValue(true);
  jest.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValue('c'.repeat(64));
  jest.mocked(SecureStore.setItemAsync).mockReset().mockResolvedValue();
});

test.each(['sem hardware', 'não configurada', 'armazenamento incompatível'])('biometria %s informa indisponibilidade e não lê segredo', async caso => {
  if (caso === 'sem hardware') jest.mocked(LocalAuthentication.hasHardwareAsync).mockResolvedValue(false);
  if (caso === 'não configurada') jest.mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValue(false);
  if (caso === 'armazenamento incompatível') jest.mocked(SecureStore.canUseBiometricAuthentication).mockReturnValue(false);
  await expect(disponibilidadeBiometria()).resolves.toEqual(expect.objectContaining({ disponivel: false, mensagem: expect.any(String) }));
  const leitura = await lerCredencialBiometrica('http://localhost:3000', cartao.emissaoId);
  expect(leitura.credencial).toBeUndefined();
  expect(leitura.mensagem).toMatch(/PIN/i);
  expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
});

test('leitura exige autenticação protegida pelo sistema e só retorna após conclusão do prompt', async () => {
  const sistema = pendente<string>();
  jest.mocked(SecureStore.getItemAsync).mockReturnValue(sistema.promise);
  let concluida = false;
  const leitura = lerCredencialBiometrica('http://localhost:3000', cartao.emissaoId).then(value => { concluida = true; return value; });
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(concluida).toBe(false);
  sistema.resolver('d'.repeat(64));
  await expect(leitura).resolves.toEqual(expect.objectContaining({ credencial: 'd'.repeat(64) }));
  expect(SecureStore.getItemAsync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ requireAuthentication: true }));
});

test('recusa do prompt não entrega credencial e orienta usar PIN', async () => {
  jest.mocked(SecureStore.getItemAsync).mockRejectedValue(new Error('Authentication canceled'));
  const leitura = await lerCredencialBiometrica('http://localhost:3000', cartao.emissaoId);
  expect(leitura.credencial).toBeUndefined();
  expect(leitura.mensagem).toMatch(/PIN/i);
});

test('credencial ausente ou invalidada por mudança de biometria recai no PIN', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  const leitura = await lerCredencialBiometrica('http://localhost:3000', cartao.emissaoId);
  expect(leitura.credencial).toBeUndefined();
  expect(leitura.mensagem).toMatch(/PIN/i);
});

test('credencial recebida do servidor é armazenada com autenticação obrigatória', async () => {
  await expect(guardarCredencialBiometrica('http://localhost:3000', cartao.emissaoId, 'd'.repeat(64))).resolves.toBe(true);
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(expect.any(String), 'd'.repeat(64), expect.objectContaining({ requireAuthentication: true }));
});

test('cancelamento ao proteger nova credencial informa que o cadastro não terminou', async () => {
  jest.mocked(SecureStore.setItemAsync).mockRejectedValue(new Error('Authentication canceled'));
  await expect(guardarCredencialBiometrica('http://localhost:3000', cartao.emissaoId, 'd'.repeat(64))).resolves.toBe(false);
});

test('credenciais de diferentes serviços ou emissões não compartilham a mesma chave', async () => {
  await lerCredencialBiometrica('http://localhost:3000', cartao.emissaoId);
  await lerCredencialBiometrica('https://outro-servico.example', cartao.emissaoId);
  await lerCredencialBiometrica('http://localhost:3000', '98d597cd-e817-4dc9-b1a3-35595584b65b');
  const chaves = jest.mocked(SecureStore.getItemAsync).mock.calls.map(call => call[0]);
  expect(new Set(chaves).size).toBe(3);
});
