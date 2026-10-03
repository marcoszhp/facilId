import React from 'react';
import { act,fireEvent,render,screen,waitFor } from '@testing-library/react-native';
import { EventosAdmin } from '../src/components/EventosAdmin';
import { criarApi } from '../src/services/api.service';
import { EventoAdministrativo } from '../src/services/identidade';
import { cartao,pendente } from './helpers';

jest.mock('../src/services/api.service',()=>({...jest.requireActual('../src/services/api.service'),criarApi:jest.fn()}));
const evento:EventoAdministrativo={
  id:'6ab82fa5-36de-40fc-89e5-05a14bc1d208',emissaoId:cartao.emissaoId,cpf:cartao.cpf,nome:cartao.nome,
  tipo:'emissao',ocorridoEm:'2026-10-03T02:15:40.000Z',motivo:'Emissão solicitada pelo responsável.',
};
const api={eventos:jest.fn()};
const props={url:'http://localhost:3000',credencial:'admin-de-teste',onUnauthorized:jest.fn()};
const erroHttp=(status:number)=>Object.assign(new Error('Falha de teste'),{isAxiosError:true,response:{status,data:{mensagem:'Não foi possível consultar os eventos.'}}});
const abrir=()=>fireEvent.press(screen.getByRole('button',{name:'Consultar histórico administrativo'}));
const atualizar=()=>fireEvent.press(screen.getByRole('button',{name:'Atualizar histórico'}));
const carregado=()=>screen.findByText('Histórico administrativo atualizado.');

beforeEach(()=>{
  api.eventos.mockReset().mockResolvedValue([evento]);props.onUnauthorized.mockReset();
  jest.mocked(criarApi).mockReturnValue(api as unknown as ReturnType<typeof criarApi>);
});

test('consulta sob demanda e mostra pessoa, CPF mascarado, tipo, motivo e data em Brasília na ordem estável da API',async()=>{
  const bloqueio={...evento,id:'c8932fef-49b1-47b8-a530-316423b8a07e',nome:'José Fictício',cpf:'98765432111',tipo:'bloqueio',ocorridoEm:'2026-10-03T12:00:00.000Z',motivo:'Bloqueio solicitado pelo responsável.'};
  const substituicao={...evento,id:'47b7f07e-cbb4-4276-b16c-eb8f1572f55e',tipo:'substituicao',motivo:'Cartão substituído por nova emissão.'};
  api.eventos.mockResolvedValue([bloqueio,evento,substituicao]);
  render(<EventosAdmin {...props}/>);expect(api.eventos).not.toHaveBeenCalled();
  abrir();await carregado();
  expect(api.eventos).toHaveBeenCalledWith('admin-de-teste',expect.any(AbortSignal));
  expect(screen.getByText('José Fictício')).toBeTruthy();expect(screen.getAllByText(cartao.nome)).toHaveLength(2);
  expect(screen.getByText('CPF: ***.***.***-11')).toBeTruthy();expect(screen.getAllByText('CPF: ***.***.***-00')).toHaveLength(2);
  expect(screen.queryByText(new RegExp(cartao.cpf))).toBeNull();expect(screen.queryByText(/98765432111/)).toBeNull();
  expect(screen.getAllByText(/^Tipo: /).map(texto=>texto.props.children.join(''))).toEqual(['Tipo: Bloqueio','Tipo: Emissão','Tipo: Substituição']);
  expect(screen.getAllByText(/^Motivo: /).map(texto=>texto.props.children.join(''))).toEqual([
    'Motivo: Bloqueio solicitado pelo responsável.','Motivo: Emissão solicitada pelo responsável.','Motivo: Cartão substituído por nova emissão.',
  ]);
  expect(screen.getByText('Data: 03/10/2026, 09:00:00 (horário de Brasília)')).toBeTruthy();
  expect(screen.getAllByText('Data: 02/10/2026, 23:15:40 (horário de Brasília)')).toHaveLength(2);
  expect(screen.getByText(/motivos são registrados automaticamente, sem identificação individual/)).toBeTruthy();
});

test('lista vazia é informada após resposta e atualizar mostra novos eventos',async()=>{
  api.eventos.mockResolvedValueOnce([]);
  render(<EventosAdmin {...props}/>);abrir();await screen.findByText('Nenhum evento administrativo registrado.');
  atualizar();await carregado();
  expect(screen.getByText(cartao.nome)).toBeTruthy();expect(screen.queryByText('Nenhum evento administrativo registrado.')).toBeNull();
  expect(api.eventos).toHaveBeenCalledTimes(2);
});

test('erro de conexão permite tentar novamente sem encerrar acesso nem mostrar lista vazia como fato',async()=>{
  api.eventos.mockRejectedValueOnce(Object.assign(new Error('offline'),{isAxiosError:true}));
  render(<EventosAdmin {...props}/>);abrir();await screen.findByRole('alert');
  expect(screen.getByRole('alert').props.children).toMatch(/Não foi possível conectar/);
  expect(screen.queryByText('Nenhum evento administrativo registrado.')).toBeNull();expect(props.onUnauthorized).not.toHaveBeenCalled();
  atualizar();await carregado();expect(screen.queryByRole('alert')).toBeNull();
});

test('falha ao atualizar preserva consulta anterior com aviso de que pode estar desatualizada',async()=>{
  render(<EventosAdmin {...props}/>);abrir();await carregado();
  api.eventos.mockRejectedValueOnce(erroHttp(503));atualizar();await screen.findByRole('alert');
  expect(screen.getByText(cartao.nome)).toBeTruthy();
  expect(screen.getByText(/histórico exibido corresponde à última consulta/)).toBeTruthy();
  expect(props.onUnauthorized).not.toHaveBeenCalled();
});

test('401 em atualização apaga histórico e cancela a operação antes de encerrar o acesso',async()=>{
  render(<EventosAdmin {...props}/>);abrir();await carregado();
  api.eventos.mockRejectedValueOnce(erroHttp(401));atualizar();
  await waitFor(()=>expect(props.onUnauthorized).toHaveBeenCalledTimes(1));
  expect((api.eventos.mock.calls[1][1] as AbortSignal).aborted).toBe(true);
  expect(screen.queryByText(cartao.nome)).toBeNull();expect(screen.queryByText('Nenhum evento administrativo registrado.')).toBeNull();
});

test.each(['resolver','rejeitar'] as const)('cancelar permite nova consulta e ignora resposta antiga ao %s',async terminar=>{
  const consulta=pendente<EventoAdministrativo[]>();api.eventos.mockReturnValueOnce(consulta.promise);
  render(<EventosAdmin {...props}/>);abrir();
  const signal=api.eventos.mock.calls[0][1] as AbortSignal;
  fireEvent.press(screen.getByRole('button',{name:'Cancelar consulta do histórico'}));
  expect(signal.aborted).toBe(true);expect(screen.getByText('Consulta do histórico cancelada.')).toBeTruthy();
  api.eventos.mockResolvedValueOnce([]);atualizar();await carregado();
  await act(async()=>{if(terminar==='resolver')consulta.resolver([evento]);else consulta.rejeitar(erroHttp(401));});
  expect(screen.queryByText(cartao.nome)).toBeNull();expect(props.onUnauthorized).not.toHaveBeenCalled();
  expect(screen.getByText('Nenhum evento administrativo registrado.')).toBeTruthy();
});

test.each(['fechar','desmontar'] as const)('%s cancela consulta e ignora 401 tardio',async sair=>{
  const consulta=pendente<EventoAdministrativo[]>();api.eventos.mockReturnValueOnce(consulta.promise);
  const tela=render(<EventosAdmin {...props}/>);abrir();
  const signal=api.eventos.mock.calls[0][1] as AbortSignal;
  if(sair==='fechar')fireEvent.press(screen.getByRole('button',{name:'Fechar histórico'}));else tela.unmount();
  expect(signal.aborted).toBe(true);
  await act(async()=>consulta.rejeitar(erroHttp(401)));expect(props.onUnauthorized).not.toHaveBeenCalled();
  if(sair==='fechar'){
    expect(screen.queryByText(cartao.nome)).toBeNull();abrir();await carregado();expect(api.eventos).toHaveBeenCalledTimes(2);
  }
});

test.each(['url','credencial'] as const)('mudar %s descarta histórico carregado, aborta atualização e volta à consulta sob demanda',async campo=>{
  const tela=render(<EventosAdmin {...props}/>);abrir();await carregado();
  const consulta=pendente<EventoAdministrativo[]>();api.eventos.mockReturnValueOnce(consulta.promise);atualizar();
  const signal=api.eventos.mock.calls[1][1] as AbortSignal;
  const novos={...props,[campo]:campo==='url'?'http://outro-servico:3000':'outra-credencial'};
  tela.rerender(<EventosAdmin {...novos}/>);
  expect(signal.aborted).toBe(true);expect(screen.queryByText(cartao.nome)).toBeNull();expect(api.eventos).toHaveBeenCalledTimes(2);
  await act(async()=>consulta.resolver([evento]));expect(screen.queryByText(cartao.nome)).toBeNull();
  api.eventos.mockResolvedValueOnce([]);abrir();await carregado();
  expect(criarApi).toHaveBeenLastCalledWith(novos.url);expect(api.eventos).toHaveBeenLastCalledWith(novos.credencial,expect.any(AbortSignal));
});

test('respeita confirmação da tela e evita consultas simultâneas por toque duplo',async()=>{
  const tela=render(<EventosAdmin {...props} disabled/>);abrir();expect(api.eventos).not.toHaveBeenCalled();
  tela.rerender(<EventosAdmin {...props}/>);abrir();await carregado();
  const consulta=pendente<EventoAdministrativo[]>();api.eventos.mockReturnValueOnce(consulta.promise);
  const botao=screen.getByRole('button',{name:'Atualizar histórico'});
  act(()=>{fireEvent.press(botao);fireEvent.press(botao);});expect(api.eventos).toHaveBeenCalledTimes(2);
  await act(async()=>consulta.resolver([evento]));
  tela.rerender(<EventosAdmin {...props} disabled/>);atualizar();expect(api.eventos).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button',{name:'Atualizar histórico'}).props.accessibilityState.disabled).toBe(true);
});

test('cancelamento de transporte não exibe erro nem encerra acesso',async()=>{
  api.eventos.mockRejectedValueOnce(Object.assign(new Error('Cancelado'),{name:'AbortError'}));
  render(<EventosAdmin {...props}/>);abrir();
  await waitFor(()=>expect(screen.getByRole('button',{name:'Atualizar histórico'}).props.accessibilityState.disabled).toBe(false));
  expect(screen.queryByRole('alert')).toBeNull();expect(props.onUnauthorized).not.toHaveBeenCalled();
});
