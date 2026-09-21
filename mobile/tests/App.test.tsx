import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import App from '../App';
import { criarApi } from '../src/services/api.service';
import { lerNfc } from '../src/services/nfc.service';
import { cartao, desafio, pendente, sessao } from './helpers';

jest.mock('../src/services/api.service', () => ({
  ...jest.requireActual('../src/services/api.service'), criarApi: jest.fn(),
}));
jest.mock('../src/services/nfc.service', () => ({
  lerNfc: jest.fn(), cancelarNfc: jest.fn().mockResolvedValue(undefined), gravarNfc: jest.fn(),
}));
jest.mock('../src/services/feedback', () => ({
  falar: jest.fn(), feedback: jest.fn(), pararAudio: jest.fn(),
  observarAudio: jest.fn(() => () => {}),
}));
jest.mock('../src/components/LeitorQr', () => ({ LeitorQr: () => null }));
jest.mock('react-native-qrcode-svg', () => () => null);
jest.mock('../src/services/biometria.service', () => ({
  disponibilidadeBiometria: jest.fn().mockResolvedValue({ disponivel: false, mensagem: 'Use o PIN neste aparelho.' }),
  lerCredencialBiometrica: jest.fn(), guardarCredencialBiometrica: jest.fn(),
}));

const api = {
  entrar: jest.fn(), perfil: jest.fn(), emitir: jest.fn(), usuarios: jest.fn(),
  cartao: jest.fn(), bloquear: jest.fn(), confirmar: jest.fn(), foto: jest.fn(),
};
beforeEach(() => {
  Object.values(api).forEach(mock => mock.mockReset());
  jest.mocked(criarApi).mockReturnValue(api as unknown as ReturnType<typeof criarApi>);
  api.usuarios.mockResolvedValue([]);
  api.emitir.mockResolvedValue(cartao);
  api.entrar.mockResolvedValue(desafio());
  api.confirmar.mockResolvedValue(sessao());
  api.perfil.mockResolvedValue(sessao().perfil);
  jest.mocked(lerNfc).mockReset();
});

async function abrirResponsavel() {
  fireEvent.press(screen.getByRole('button', { name: 'Área do responsável' }));
  fireEvent.changeText(screen.getByLabelText('Credencial do responsável'), 'credencial-ficticia-do-teste');
  fireEvent.press(screen.getByRole('button', { name: 'Acessar área do responsável' }));
  await screen.findByRole('button', { name: 'Gerar cartão' });
}

test('área do cidadão não emite nem lista cartões e responsável precisa autorizar antes do formulário', async () => {
  render(<App />);
  expect(screen.getByText('Informe seu CPF')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Gerar cartão' })).toBeNull();
  expect(api.usuarios).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Área do responsável' }));
  expect(screen.getByLabelText('Credencial do responsável')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Gerar cartão' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Voltar para entrar' }));
  expect(screen.getByText('Informe seu CPF')).toBeTruthy();
  await abrirResponsavel();
  expect(api.usuarios).toHaveBeenCalledWith('credencial-ficticia-do-teste', expect.anything());
  fireEvent.press(screen.getByRole('button', { name: 'Encerrar acesso do responsável' }));
  expect(screen.queryByRole('button', { name: 'Gerar cartão' })).toBeNull();
  expect(screen.getByLabelText('Credencial do responsável').props.value).toBe('');
});

test('emissão pode ser usada no mesmo aparelho e 401 remove acesso e volta ao login com aviso', async () => {
  render(<App />);
  await abrirResponsavel();
  fireEvent.press(screen.getByRole('button', { name: 'Usar modo demonstração sem câmera' }));
  fireEvent.changeText(screen.getByLabelText('Nome'), cartao.nome);
  fireEvent.changeText(screen.getByLabelText('CPF'), cartao.cpf);
  fireEvent.changeText(screen.getByLabelText('Idade'), String(cartao.idade));
  fireEvent.changeText(screen.getByLabelText('PIN de acesso (6 números)'), '123456');
  fireEvent.changeText(screen.getByLabelText('Confirme o PIN'), '123456');
  fireEvent.press(screen.getByRole('button', { name: 'Usar assinatura fictícia' }));
  fireEvent.press(screen.getByRole('button', { name: 'Gerar cartão' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Usar este cartão na demonstração' }));
  expect(screen.getByText('Informe seu CPF')).toBeTruthy();
  expect(screen.getByLabelText('Seu CPF').props.value).toBe(cartao.cpf);
  fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.press(screen.getByRole('button', { name: 'Entrar com o cartão preparado' }));
  await screen.findByText('Confirme seu acesso');
  expect(screen.queryByText('Acesso liberado')).toBeNull();
  fireEvent.changeText(await screen.findByLabelText('PIN de 6 números'), '123456');
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar PIN' }));
  await screen.findByText('Acesso liberado');
  api.perfil.mockRejectedValueOnce(Object.assign(new Error('revogado'), {
    isAxiosError: true, response: { status: 401, data: { mensagem: 'Sessão encerrada.' } },
  }));
  fireEvent.press(screen.getByRole('button', { name: 'Consultar meu acesso' }));
  await screen.findByText('Informe seu CPF');
  expect(screen.queryByText('Acesso liberado')).toBeNull();
  expect(screen.getByText(/acesso foi encerrado.*entrar novamente/i)).toBeTruthy();
});

test('trocar para o responsável durante consulta de login impede acesso liberado atrasado', async () => {
  const consulta = pendente<ReturnType<typeof desafio>>();
  api.entrar.mockReturnValue(consulta.promise);
  jest.mocked(lerNfc).mockResolvedValue(JSON.stringify(cartao));
  render(<App />);
  fireEvent.changeText(screen.getByLabelText('Seu CPF'), cartao.cpf);
  fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.press(screen.getByRole('button', { name: 'Aproximar cartão' }));
  await waitFor(() => expect(api.entrar).toHaveBeenCalledTimes(1));
  const signal = api.entrar.mock.calls[0][2] as AbortSignal;
  fireEvent.press(screen.getByRole('button', { name: 'Área do responsável' }));
  expect(signal.aborted).toBe(true);
  await act(async () => { consulta.resolver(desafio()); });
  expect(screen.queryByText('Acesso liberado')).toBeNull();
  expect(screen.getByLabelText('Credencial do responsável')).toBeTruthy();
});
