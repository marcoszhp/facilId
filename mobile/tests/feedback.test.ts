import Tts from 'react-native-tts';
import { falar, observarAudio, pararAudio } from '../src/services/feedback';
import { pendente } from './helpers';

const mockEventos = new Map<string, (event: { utteranceId: string }) => void>();
jest.mock('react-native-tts', () => ({
  __esModule: true,
  default: {
    getInitStatus: jest.fn(), setDefaultLanguage: jest.fn(), stop: jest.fn(), speak: jest.fn(),
    addEventListener: jest.fn((tipo: string, fn: (event: {utteranceId: string}) => void) => { mockEventos.set(tipo, fn); }),
  },
}));
jest.mock('react-native-haptic-feedback', () => ({ __esModule: true, default: { trigger: jest.fn() } }));
const tts = jest.mocked(Tts);
async function concluirMicrotarefas() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

beforeEach(() => {
  tts.getInitStatus.mockResolvedValue('success');
  tts.setDefaultLanguage.mockResolvedValue('success');
  tts.stop.mockResolvedValue(true);
  // A implementação nativa retorna Promise, embora o .d.ts da lib diga string.
  tts.speak.mockReturnValue(Promise.resolve('fala-teste') as unknown as string);
  pararAudio();
});
afterEach(() => { pararAudio(); });

test('Parar áudio durante a inicialização impede a fala atrasada', async () => {
  const inicializacao = pendente<'success'>();
  tts.getInitStatus.mockReturnValueOnce(inicializacao.promise);
  const observer = jest.fn(); const remover = observarAudio(observer);
  falar('Instrução fictícia');
  await concluirMicrotarefas();
  pararAudio();
  inicializacao.resolver('success');
  await concluirMicrotarefas();
  expect(tts.speak).not.toHaveBeenCalled();
  expect(observer).toHaveBeenLastCalledWith(false);
  remover();
});

test('conclusão do áudio usa o identificador resolvido pela Promise nativa', async () => {
  const observer = jest.fn(); const remover = observarAudio(observer);
  falar('Instrução fictícia');
  await concluirMicrotarefas();
  expect(tts.speak).toHaveBeenCalled();
  expect(observer).toHaveBeenLastCalledWith(true);
  mockEventos.get('tts-finish')!({ utteranceId: 'fala-teste' });
  expect(observer).toHaveBeenLastCalledWith(false);
  remover();
});

test('falha de inicialização encerra o indicador sem bloquear as telas', async () => {
  tts.getInitStatus.mockRejectedValueOnce(new Error('Motor indisponível'));
  const observer = jest.fn(); const remover = observarAudio(observer);
  falar('Instrução fictícia');
  await concluirMicrotarefas();
  expect(observer).toHaveBeenLastCalledWith(false);
  expect(tts.speak).not.toHaveBeenCalled();
  remover();
});

test('uma fala antiga aguardando idioma não interrompe a instrução mais recente', async () => {
  const idioma = pendente<'success'>();
  tts.setDefaultLanguage.mockReturnValueOnce(idioma.promise);
  falar('Primeira instrução');
  await concluirMicrotarefas();
  falar('Instrução mais recente');
  await concluirMicrotarefas();
  const paradas = tts.stop.mock.calls.length;
  idioma.resolver('success');
  await concluirMicrotarefas();
  expect(tts.speak).toHaveBeenCalledTimes(1);
  expect(tts.speak).toHaveBeenLastCalledWith('Instrução mais recente');
  expect(tts.stop).toHaveBeenCalledTimes(paradas);
});
