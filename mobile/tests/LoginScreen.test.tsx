import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../src/screens/LoginScreen';
import { criarApi } from '../src/services/api.service';
import { cancelarNfc, lerNfc } from '../src/services/nfc.service';
import { feedback } from '../src/services/feedback';
import { cartao, pendente, sessao } from './helpers';

jest.mock('../src/services/api.service', () => ({
  ...jest.requireActual('../src/services/api.service'), criarApi: jest.fn(),
}));
jest.mock('../src/services/nfc.service', () => ({ lerNfc: jest.fn(), cancelarNfc: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/services/feedback', () => ({
  falar: jest.fn(), feedback: jest.fn(), pararAudio: jest.fn(),
  observarAudio: jest.fn(() => () => {}),
}));
jest.mock('../src/components/LeitorQr', () => ({ LeitorQr: () => null }));

const entrar = jest.fn();
beforeEach(() => {
  jest.mocked(criarApi).mockReturnValue({ entrar } as unknown as ReturnType<typeof criarApi>);
  entrar.mockReset();
  jest.mocked(lerNfc).mockReset();
});

function informarCpf() {
  fireEvent.changeText(screen.getByLabelText('Seu CPF'), cartao.cpf);
  fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
}

test('primeiro pede CPF e só então apresenta a leitura e opções secundárias', () => {
  render(<LoginScreen url="http://localhost:3000" onSuccess={jest.fn()} />);
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
  const resposta = pendente<ReturnType<typeof sessao>>();
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
  await act(async () => { resposta.resolver(sessao()); });
  expect(onSuccess).not.toHaveBeenCalled();
});

test('desmontar a tela aborta a requisição e ignora retorno mesmo sem suporte do transporte', async () => {
  const resposta = pendente<ReturnType<typeof sessao>>();
  entrar.mockReturnValue(resposta.promise);
  const onSuccess = jest.fn();
  const view = render(<LoginScreen url="http://localhost:3000" onSuccess={onSuccess} cartaoDemonstracao={cartao} />);
  fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.press(screen.getByRole('button', { name: 'Entrar com o cartão preparado' }));
  await waitFor(() => expect(entrar).toHaveBeenCalledTimes(1));
  const signal = entrar.mock.calls[0][2] as AbortSignal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => { resposta.resolver(sessao()); });
  expect(onSuccess).not.toHaveBeenCalled();
});
