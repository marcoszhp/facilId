import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SucessoScreen } from '../src/screens/SucessoScreen';
import { criarApi } from '../src/services/api.service';
import { pendente, sessao } from './helpers';

jest.mock('../src/services/api.service', () => ({
  ...jest.requireActual('../src/services/api.service'), criarApi: jest.fn(),
}));
jest.mock('../src/services/feedback', () => ({
  falar: jest.fn(), feedback: jest.fn(), pararAudio: jest.fn(),
  observarAudio: jest.fn(() => () => {}),
}));

const perfil = jest.fn();
const horarios=jest.fn(),meusAtendimentos=jest.fn();
beforeEach(() => {
  perfil.mockReset();horarios.mockReset();meusAtendimentos.mockReset();
  horarios.mockResolvedValue({horarios:[]});meusAtendimentos.mockResolvedValue([]);
  jest.mocked(criarApi).mockReturnValue({ perfil,horarios,meusAtendimentos } as unknown as ReturnType<typeof criarApi>);
});

test('sair desmonta agenda imediatamente, aborta consultas e ignora 401 tardio',async()=>{
  const consulta=pendente<[]>();meusAtendimentos.mockReturnValueOnce(consulta.promise);
  const onExit=jest.fn();render(<SucessoScreen sessao={sessao()} url="http://localhost:3000" onExit={onExit}/>);
  expect(horarios).not.toHaveBeenCalled();
  expect(screen.getByText('Demonstração escolar • não é documento oficial')).toBeTruthy();
  fireEvent.press(screen.getByRole('button',{name:'Agendar atendimento na secretaria'}));
  const signal=meusAtendimentos.mock.calls[0][1] as AbortSignal;
  fireEvent.press(screen.getByRole('button',{name:'Sair'}));expect(signal.aborted).toBe(true);
  expect(screen.queryByText('Meus agendamentos')).toBeNull();
  await act(async()=>consulta.rejeitar(Object.assign(new Error('expired'),{isAxiosError:true,response:{status:401}})));
  expect(onExit).toHaveBeenCalledTimes(1);
});

test('401 na agenda encerra toda sessão e cancela consulta de perfil simultânea',async()=>{
  const consulta=pendente<ReturnType<typeof sessao>['perfil']>();perfil.mockReturnValueOnce(consulta.promise);
  horarios.mockRejectedValueOnce(Object.assign(new Error('expired'),{isAxiosError:true,response:{status:401}}));
  const onExit=jest.fn();render(<SucessoScreen sessao={sessao()} url="http://localhost:3000" onExit={onExit}/>);
  fireEvent.press(screen.getByRole('button',{name:'Consultar meu acesso'}));
  const signal=perfil.mock.calls[0][1] as AbortSignal;
  fireEvent.press(screen.getByRole('button',{name:'Agendar atendimento na secretaria'}));
  await waitFor(()=>expect(onExit).toHaveBeenCalledTimes(1));expect(signal.aborted).toBe(true);
  expect(screen.queryByText('Meus agendamentos')).toBeNull();
  await act(async()=>consulta.rejeitar(Object.assign(new Error('expired'),{isAxiosError:true,response:{status:401}})));
  expect(onExit).toHaveBeenCalledTimes(1);
});

test('expiração da sessão cancela agenda aberta sem depender da navegação do App',async()=>{
  jest.useFakeTimers();
  const consulta=pendente<[]>();meusAtendimentos.mockReturnValueOnce(consulta.promise);
  const onExit=jest.fn();render(<SucessoScreen sessao={sessao({expiraEm:Date.now()+10_000})} url="http://localhost:3000" onExit={onExit}/>);
  fireEvent.press(screen.getByRole('button',{name:'Agendar atendimento na secretaria'}));
  const signal=meusAtendimentos.mock.calls[0][1] as AbortSignal;
  act(()=>jest.advanceTimersByTime(10_000));expect(signal.aborted).toBe(true);
  expect(onExit).toHaveBeenCalledWith(expect.stringMatching(/sessão expirou/i));
  await act(async()=>consulta.resolver([]));expect(screen.queryByText('Meus agendamentos')).toBeNull();
});
afterEach(() => { jest.useRealTimers(); });

test('resposta 401 encerra a sessão com orientação para entrar novamente', async () => {
  const erro401 = Object.assign(new Error('Sessão encerrada.'), {
    isAxiosError: true, response: { status: 401, data: { mensagem: 'Sessão encerrada.' } },
  });
  perfil.mockRejectedValue(erro401);
  const onExit = jest.fn();
  render(<SucessoScreen sessao={sessao()} url="http://localhost:3000" onExit={onExit} />);
  fireEvent.press(screen.getByRole('button', { name: 'Consultar meu acesso' }));
  await waitFor(() => expect(onExit).toHaveBeenCalledWith(expect.stringMatching(/encerrado.*entrar novamente/i)));
});

test('falha de conexão permite tentar novamente sem fingir sessão revogada', async () => {
  perfil.mockRejectedValueOnce(Object.assign(new Error('offline'), { isAxiosError: true }));
  perfil.mockResolvedValueOnce(sessao().perfil);
  const onExit = jest.fn();
  render(<SucessoScreen sessao={sessao()} url="http://localhost:3000" onExit={onExit} />);
  fireEvent.press(screen.getByRole('button', { name: 'Consultar meu acesso' }));
  await screen.findByText(/não foi possível conectar/i);
  expect(onExit).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Consultar meu acesso' }));
  await screen.findByText('Seu acesso está ativo.');
});

test('expira na data informada pela API e avisa antes do vencimento', () => {
  jest.useFakeTimers();
  const onExit = jest.fn();
  render(<SucessoScreen sessao={sessao({ expiraEm: Date.now() + 30_000 })} url="http://localhost:3000" onExit={onExit} />);
  expect(screen.getByText(/acesso termina em menos de um minuto/i)).toBeTruthy();
  act(() => { jest.advanceTimersByTime(29_000); });
  expect(onExit).not.toHaveBeenCalled();
  act(() => { jest.advanceTimersByTime(1_000); });
  expect(onExit).toHaveBeenCalledWith(expect.stringMatching(/sessão expirou/i));
});

test('sair cancela consulta e resposta tardia não dispara novo encerramento', async () => {
  const consulta = pendente<ReturnType<typeof sessao>['perfil']>();
  perfil.mockReturnValue(consulta.promise);
  const onExit = jest.fn();
  const view = render(<SucessoScreen sessao={sessao()} url="http://localhost:3000" onExit={onExit} />);
  fireEvent.press(screen.getByRole('button', { name: 'Consultar meu acesso' }));
  const signal = perfil.mock.calls[0][1] as AbortSignal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => {
    consulta.rejeitar(Object.assign(new Error('expired'), { isAxiosError: true, response: { status: 401 } }));
  });
  expect(onExit).not.toHaveBeenCalled();
});
