import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../src/screens/LoginScreen';
import { criarApi } from '../src/services/api.service';
import { cancelarNfc, lerNfc } from '../src/services/nfc.service';
import { feedback } from '../src/services/feedback';
import { disponibilidadeBiometria, guardarCredencialBiometrica, lerCredencialBiometrica } from '../src/services/biometria.service';
import { cartao, desafio, pendente, sessao } from './helpers';

jest.mock('../src/services/api.service', () => ({
  ...jest.requireActual('../src/services/api.service'), criarApi: jest.fn(),
}));
jest.mock('../src/services/nfc.service', () => ({ lerNfc: jest.fn(), cancelarNfc: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/services/feedback', () => ({
  falar: jest.fn(), feedback: jest.fn(), pararAudio: jest.fn(),
  observarAudio: jest.fn(() => () => {}),
}));
jest.mock('../src/components/LeitorQr', () => ({ LeitorQr: () => null }));
jest.mock('../src/services/biometria.service', () => ({
  disponibilidadeBiometria: jest.fn(), guardarCredencialBiometrica: jest.fn(), lerCredencialBiometrica: jest.fn(),
}));

const entrar = jest.fn();
const confirmar = jest.fn();
beforeEach(() => {
  jest.mocked(criarApi).mockReturnValue({ entrar, confirmar } as unknown as ReturnType<typeof criarApi>);
  entrar.mockReset().mockResolvedValue(desafio());
  confirmar.mockReset().mockResolvedValue(sessao());
  jest.mocked(lerNfc).mockReset();
  jest.mocked(disponibilidadeBiometria).mockReset().mockResolvedValue({ disponivel: false, mensagem: 'Biometria indisponível. Use o PIN.' });
  jest.mocked(lerCredencialBiometrica).mockReset();
  jest.mocked(guardarCredencialBiometrica).mockReset().mockResolvedValue(true);
});

function informarCpf() {
  fireEvent.changeText(screen.getByLabelText('Seu CPF'), cartao.cpf);
  fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
}

test('primeiro pede CPF e só então apresenta a leitura e opções secundárias', async () => {
  render(<LoginScreen url="http://localhost:3000" onSuccess={jest.fn()} />);
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByText('Informe seu CPF')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Aproximar cartão' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
  expect(screen.queryByText('Leia seu cartão')).toBeNull();
  informarCpf();
  expect(screen.getByText('Leia seu cartão')).toBeTruthy();
  expect(screen.queryByLabelText('Código do cartão')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Opções da demonstração' }));
  fireEvent.press(screen.getByRole('button', { name: 'Digitar ou colar código' }));
  expect(screen.getByLabelText('Código do cartão')).toBeTruthy();
});

test('cancelar NFC ignora leitura tardia sem autenticar nem anunciar erro', async () => {
  const leitura = pendente<string>();
  jest.mocked(lerNfc).mockReturnValue(leitura.promise);
  const onSuccess = jest.fn();
  render(<LoginScreen url="http://localhost:3000" onSuccess={onSuccess} />);
  informarCpf();
  fireEvent.press(screen.getByRole('button', { name: 'Aproximar cartão' }));
  expect(screen.getByText('Aguardando cartão…')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Cancelar leitura' }));
  await act(async () => { leitura.resolver(JSON.stringify(cartao)); });
  expect(cancelarNfc).toHaveBeenCalled();
  expect(entrar).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
  expect(feedback).not.toHaveBeenCalledWith(expect.anything(), false);
  expect(screen.getByRole('button', { name: 'Aproximar cartão' })).toBeEnabled();
});

test('distingue leitura da verificação e cancela a API sem liberar acesso tardio', async () => {
  const resposta = pendente<ReturnType<typeof desafio>>();
  jest.mocked(lerNfc).mockResolvedValue(JSON.stringify(cartao));
  entrar.mockReturnValue(resposta.promise);
  const onSuccess = jest.fn();
  render(<LoginScreen url="http://localhost:3000" onSuccess={onSuccess} />);
  informarCpf();
  fireEvent.press(screen.getByRole('button', { name: 'Aproximar cartão' }));
  await screen.findByText('Verificando acesso…');
  const signal = entrar.mock.calls[0][2] as AbortSignal;
  expect(signal.aborted).toBe(false);
  fireEvent.press(screen.getByRole('button', { name: 'Cancelar verificação' }));
  expect(signal.aborted).toBe(true);
  await act(async () => { resposta.resolver(desafio()); });
  expect(onSuccess).not.toHaveBeenCalled();
});

test('desmontar a tela aborta a requisição e ignora retorno mesmo sem suporte do transporte', async () => {
  const resposta = pendente<ReturnType<typeof desafio>>();
  entrar.mockReturnValue(resposta.promise);
  const onSuccess = jest.fn();
  const view = render(<LoginScreen url="http://localhost:3000" onSuccess={onSuccess} cartaoDemonstracao={cartao} />);
  fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.press(screen.getByRole('button', { name: 'Entrar com o cartão preparado' }));
  await waitFor(() => expect(entrar).toHaveBeenCalledTimes(1));
  const signal = entrar.mock.calls[0][2] as AbortSignal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => { resposta.resolver(desafio()); });
  expect(onSuccess).not.toHaveBeenCalled();
});

async function lerCartaoPreparado(onSuccess = jest.fn()) {
  const view = render(<LoginScreen url="http://localhost:3000" onSuccess={onSuccess} cartaoDemonstracao={cartao} />);
  fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.press(screen.getByRole('button', { name: 'Entrar com o cartão preparado' }));
  await screen.findByText('Confirme seu acesso');
  return { ...view, onSuccess };
}

test('cartão válido cria desafio, mas indisponibilidade biométrica exige PIN antes do acesso', async () => {
  const { onSuccess } = await lerCartaoPreparado();
  expect(onSuccess).not.toHaveBeenCalled();
  expect(confirmar).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Confirmar com biometria' })).toBeNull();
  fireEvent.changeText(await screen.findByLabelText('PIN de 6 números'), '123456');
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar PIN' }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  expect(confirmar).toHaveBeenCalledWith(expect.objectContaining({ desafioId: desafio().desafioId, pin: '123456' }), expect.anything());
  expect(guardarCredencialBiometrica).not.toHaveBeenCalled();
});

test('recusa biométrica mantém o acesso fechado e oferece PIN recuperável', async () => {
  jest.mocked(disponibilidadeBiometria).mockResolvedValue({ disponivel: true, mensagem: 'Biometria disponível.' });
  jest.mocked(lerCredencialBiometrica).mockResolvedValue({ mensagem: 'Biometria recusada. Use o PIN.' });
  const { onSuccess } = await lerCartaoPreparado();
  fireEvent.press(await screen.findByRole('button', { name: 'Confirmar com biometria' }));
  await screen.findByLabelText('PIN de 6 números');
  expect(confirmar).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('PIN de 6 números'), '123456');
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar PIN' }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
});

test('PIN incorreto não libera acesso nem salva credencial biométrica', async () => {
  confirmar.mockRejectedValue(Object.assign(new Error('PIN incorreto.'), {
    isAxiosError: true, response: { status: 401, data: { mensagem: 'PIN incorreto.' } },
  }));
  const { onSuccess } = await lerCartaoPreparado();
  fireEvent.changeText(await screen.findByLabelText('PIN de 6 números'), '000000');
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar PIN' }));
  await screen.findByText('PIN incorreto.');
  expect(onSuccess).not.toHaveBeenCalled();
  expect(guardarCredencialBiometrica).not.toHaveBeenCalled();
});

test('credencial biométrica só é enviada ao servidor depois da liberação pelo sistema operacional', async () => {
  jest.mocked(disponibilidadeBiometria).mockResolvedValue({ disponivel: true, mensagem: 'Biometria disponível.' });
  const sistema = pendente<{ credencial: string }>();
  jest.mocked(lerCredencialBiometrica).mockReturnValue(sistema.promise);
  const { onSuccess } = await lerCartaoPreparado();
  fireEvent.press(await screen.findByRole('button', { name: 'Confirmar com biometria' }));
  expect(confirmar).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
  await act(async () => { sistema.resolver({ credencial: 'c'.repeat(64) }); });
  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  expect(lerCredencialBiometrica).toHaveBeenCalledWith('http://localhost:3000', cartao.emissaoId);
  expect(confirmar).toHaveBeenCalledWith({ desafioId: desafio().desafioId, credencialDispositivo: 'c'.repeat(64) }, expect.anything());
  expect(guardarCredencialBiometrica).not.toHaveBeenCalled();
});

test('sair durante prompt biométrico ignora aprovação nativa tardia', async () => {
  jest.mocked(disponibilidadeBiometria).mockResolvedValue({ disponivel: true, mensagem: 'Biometria disponível.' });
  const sistema = pendente<{ credencial: string }>();
  jest.mocked(lerCredencialBiometrica).mockReturnValue(sistema.promise);
  const { onSuccess, unmount } = await lerCartaoPreparado();
  fireEvent.press(await screen.findByRole('button', { name: 'Confirmar com biometria' }));
  unmount();
  await act(async () => { sistema.resolver({ credencial: 'c'.repeat(64) }); });
  expect(confirmar).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
});

test('sair durante confirmação PIN aborta pedido e não aproveita sessão tardia', async () => {
  const resultado = pendente<ReturnType<typeof sessao>>();
  confirmar.mockReturnValue(resultado.promise);
  const { onSuccess, unmount } = await lerCartaoPreparado();
  fireEvent.changeText(await screen.findByLabelText('PIN de 6 números'), '123456');
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar PIN' }));
  await waitFor(() => expect(confirmar).toHaveBeenCalledTimes(1));
  const signal = confirmar.mock.calls[0][1] as AbortSignal;
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => { resultado.resolver(sessao()); });
  expect(onSuccess).not.toHaveBeenCalled();
  expect(guardarCredencialBiometrica).not.toHaveBeenCalled();
});

test('habilitar biometria só guarda credencial depois de o servidor validar o PIN', async () => {
  jest.mocked(disponibilidadeBiometria).mockResolvedValue({ disponivel: true, mensagem: 'Biometria disponível.' });
  const resposta = pendente<ReturnType<typeof sessao> & { credencialDispositivo: string }>();
  confirmar.mockReturnValue(resposta.promise);
  const { onSuccess } = await lerCartaoPreparado();
  fireEvent.press(screen.getByRole('button', { name: 'Usar PIN' }));
  fireEvent.changeText(await screen.findByLabelText('PIN de 6 números'), '123456');
  fireEvent(screen.getByLabelText('Habilitar biometria neste aparelho'), 'valueChange', true);
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar PIN' }));
  await waitFor(() => expect(confirmar).toHaveBeenCalledWith({ desafioId: desafio().desafioId, pin: '123456', registrarDispositivo: true }, expect.anything()));
  expect(guardarCredencialBiometrica).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
  await act(async () => { resposta.resolver({ ...sessao(), credencialDispositivo: 'd'.repeat(64) }); });
  expect(guardarCredencialBiometrica).toHaveBeenCalledWith('http://localhost:3000', cartao.emissaoId, 'd'.repeat(64));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
});

test('cadastro biométrico com PIN recusado não grava segredo nem libera acesso', async () => {
  jest.mocked(disponibilidadeBiometria).mockResolvedValue({ disponivel: true, mensagem: 'Biometria disponível.' });
  confirmar.mockRejectedValue(Object.assign(new Error('PIN incorreto.'), { isAxiosError: true, response: { status: 401, data: { mensagem: 'PIN incorreto.' } } }));
  const { onSuccess } = await lerCartaoPreparado();
  fireEvent.press(screen.getByRole('button', { name: 'Usar PIN' }));
  fireEvent.changeText(await screen.findByLabelText('PIN de 6 números'), '000000');
  fireEvent(screen.getByLabelText('Habilitar biometria neste aparelho'), 'valueChange', true);
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar PIN' }));
  await screen.findByText('PIN incorreto.');
  expect(guardarCredencialBiometrica).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
});

test('cancelamento de cadastro no sistema explica alternativa PIN antes de continuar acesso válido', async () => {
  jest.mocked(disponibilidadeBiometria).mockResolvedValue({ disponivel: true, mensagem: 'Biometria disponível.' });
  confirmar.mockResolvedValue({ ...sessao(), credencialDispositivo: 'd'.repeat(64) });
  jest.mocked(guardarCredencialBiometrica).mockResolvedValue(false);
  const { onSuccess } = await lerCartaoPreparado();
  fireEvent.press(screen.getByRole('button', { name: 'Usar PIN' }));
  fireEvent.changeText(await screen.findByLabelText('PIN de 6 números'), '123456');
  fireEvent(screen.getByLabelText('Habilitar biometria neste aparelho'), 'valueChange', true);
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar PIN' }));
  await screen.findByText(/PIN confirmado.*Não foi possível habilitar a biometria/i);
  expect(onSuccess).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Continuar para meu acesso' }));
  expect(onSuccess).toHaveBeenCalledTimes(1);
});

test('cancelar verificação biométrica ignora resultado tardio e não faz confirmação no servidor', async () => {
  jest.mocked(disponibilidadeBiometria).mockResolvedValue({ disponivel: true, mensagem: 'Biometria disponível.' });
  const resultado = pendente<{ credencial: string }>();
  jest.mocked(lerCredencialBiometrica).mockReturnValue(resultado.promise);
  const { onSuccess } = await lerCartaoPreparado();
  fireEvent.press(await screen.findByRole('button', { name: 'Confirmar com biometria' }));
  fireEvent.press(screen.getByRole('button', { name: 'Cancelar verificação' }));
  await act(async () => { resultado.resolver({ credencial: 'c'.repeat(64) }); });
  expect(confirmar).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
});
