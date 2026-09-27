import React from 'react';
import { act,fireEvent,render,screen,waitFor } from '@testing-library/react-native';
import { AtendimentosCidadao } from '../src/components/AtendimentosCidadao';
import { AtendimentosAdmin } from '../src/components/AtendimentosAdmin';
import { criarApi } from '../src/services/api.service';
import { Atendimento } from '../src/services/identidade';
import { formatarHorarioAtendimento } from '../src/services/formatacao-atendimento';
import { cartao,pendente } from './helpers';

jest.mock('../src/services/api.service',()=>({...jest.requireActual('../src/services/api.service'),criarApi:jest.fn()}));

const horario='2026-09-28T12:00:00.000Z',outroHorario='2026-09-28T13:00:00.000Z';
const atendimento:Atendimento={
  id:'8e09a0aa-a01f-4783-a2d2-f797734418ba',protocolo:'FID-TESTE-001',cpf:cartao.cpf,nome:cartao.nome,
  horario,status:'agendado',criadoEm:'2026-09-27T12:00:00.000Z',atualizadoEm:'2026-09-27T12:00:00.000Z',
};
const api={horarios:jest.fn(),agendar:jest.fn(),meusAtendimentos:jest.fn(),atendimentos:jest.fn(),atualizarAtendimento:jest.fn()};
const erroHttp=(status:number)=>Object.assign(new Error('Falha de teste'),{isAxiosError:true,response:{status,data:{mensagem:status===401?'Acesso encerrado.':'Horário ocupado.'}}});
const escolher=(valor=horario)=>fireEvent.press(screen.getByRole('button',{name:`Selecionar: ${formatarHorarioAtendimento(valor)}`}));
const botaoAdmin=(verbo:string)=>screen.getByRole('button',{name:`${verbo} atendimento de ${cartao.nome}, CPF final 00, protocolo ${atendimento.protocolo}`});

beforeEach(()=>{
  Object.values(api).forEach(mock=>mock.mockReset());
  jest.mocked(criarApi).mockReturnValue(api as unknown as ReturnType<typeof criarApi>);
  api.horarios.mockResolvedValue({horarios:[horario,outroHorario]});api.meusAtendimentos.mockResolvedValue([]);
  api.agendar.mockResolvedValue(atendimento);api.atendimentos.mockResolvedValue([atendimento]);
});

async function abrirCidadao(){
  fireEvent.press(screen.getByRole('button',{name:'Agendar atendimento na secretaria'}));
  await screen.findByText('Horários e situação dos seus agendamentos atualizados.');
}
async function abrirAdmin(){
  fireEvent.press(screen.getByRole('button',{name:'Consultar atendimentos da secretaria'}));
  await screen.findByText('Situação dos atendimentos atualizada.');
}

test('abre sob demanda, usa Brasília e só grava após confirmar a escolha',async()=>{
  const reserva=pendente<Atendimento>();api.agendar.mockReturnValueOnce(reserva.promise);
  render(<AtendimentosCidadao url="http://localhost:3000" token="jwt-de-teste" onExit={jest.fn()}/>);
  expect(api.horarios).not.toHaveBeenCalled();expect(api.meusAtendimentos).not.toHaveBeenCalled();
  expect(screen.getByText(/simulação escolar.*não reserva atendimento/i)).toBeTruthy();
  await abrirCidadao();
  expect(api.meusAtendimentos).toHaveBeenCalledWith('jwt-de-teste',expect.any(AbortSignal));
  expect(formatarHorarioAtendimento(horario)).toBe('28/09/2026, 09:00 (horário de Brasília)');
  escolher();expect(api.agendar).not.toHaveBeenCalled();
  const confirmar=screen.getByRole('button',{name:'Confirmar agendamento'});
  act(()=>{fireEvent.press(confirmar);fireEvent.press(confirmar);});
  expect(api.agendar).toHaveBeenCalledTimes(1);
  expect(api.agendar).toHaveBeenCalledWith(horario,'jwt-de-teste',expect.any(AbortSignal));
  expect(screen.getByRole('button',{name:'Confirmar agendamento'}).props.accessibilityState.disabled).toBe(true);
  await act(async()=>reserva.resolver(atendimento));
  expect(await screen.findByText(`Protocolo: ${atendimento.protocolo}`)).toBeTruthy();
  expect(screen.getByText(`Agendamento simulado realizado. Guarde o protocolo: ${atendimento.protocolo}.`).props.accessibilityLiveRegion).toBe('polite');
  expect(screen.getByText('Situação: Agendado')).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Confirmar agendamento'})).toBeNull();
  expect(screen.queryByRole('button',{name:`Selecionar: ${formatarHorarioAtendimento(horario)}`})).toBeNull();
});

test('cancelar escolha não escreve; reabrir recupera protocolos da API e atualizar mostra nova situação',async()=>{
  render(<AtendimentosCidadao url="http://localhost:3000" token="jwt-de-teste" onExit={jest.fn()}/>);
  await abrirCidadao();escolher();
  fireEvent.press(screen.getByRole('button',{name:'Cancelar escolha do horário'}));
  expect(api.agendar).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Confirmar agendamento'})).toBeNull();
  fireEvent.press(screen.getByRole('button',{name:'Fechar agendamentos'}));
  api.meusAtendimentos.mockResolvedValueOnce([atendimento]);await abrirCidadao();
  expect(screen.getByText(`Protocolo: ${atendimento.protocolo}`)).toBeTruthy();
  api.meusAtendimentos.mockResolvedValueOnce([{...atendimento,status:'confirmado'}]);
  fireEvent.press(screen.getByRole('button',{name:'Atualizar meus agendamentos e horários'}));
  await screen.findByText('Situação: Confirmado');expect(api.meusAtendimentos).toHaveBeenCalledTimes(3);
});

test('409 descarta horário ocupado, recarrega oferta e permite agendar outro',async()=>{
  api.agendar.mockRejectedValueOnce(erroHttp(409)).mockResolvedValueOnce({...atendimento,horario:outroHorario});
  const onExit=jest.fn();render(<AtendimentosCidadao url="http://localhost:3000" token="jwt-de-teste" onExit={onExit}/>);
  await abrirCidadao();escolher();api.horarios.mockResolvedValueOnce({horarios:[outroHorario]});
  fireEvent.press(screen.getByRole('button',{name:'Confirmar agendamento'}));
  await screen.findByText('Esse horário não está mais disponível. Escolha outro horário.');
  await waitFor(()=>expect(screen.getByRole('button',{name:'Atualizar meus agendamentos e horários'}).props.accessibilityState.disabled).toBe(false));
  expect(api.horarios).toHaveBeenCalledTimes(2);expect(onExit).not.toHaveBeenCalled();
  expect(screen.queryByRole('button',{name:'Confirmar agendamento'})).toBeNull();
  escolher(outroHorario);fireEvent.press(screen.getByRole('button',{name:'Confirmar agendamento'}));
  await screen.findByText(`Protocolo: ${atendimento.protocolo}`);
  expect(api.agendar.mock.calls[1][0]).toBe(outroHorario);
});

test('rede indisponível na confirmação mantém a sessão e orienta consultar possíveis gravações antes de repetir',async()=>{
  api.agendar.mockRejectedValueOnce(Object.assign(new Error('offline'),{isAxiosError:true}));
  const onExit=jest.fn();render(<AtendimentosCidadao url="http://localhost:3000" token="jwt-de-teste" onExit={onExit}/>);
  await abrirCidadao();escolher();fireEvent.press(screen.getByRole('button',{name:'Confirmar agendamento'}));
  const erro=await screen.findByRole('alert');expect(erro.props.children).toMatch(/não foi possível conectar/i);
  expect(screen.getByText(/atualize seus agendamentos antes de tentar de novo/i)).toBeTruthy();expect(onExit).not.toHaveBeenCalled();
  expect(screen.getByRole('button',{name:'Confirmar agendamento'}).props.accessibilityState.disabled).toBe(true);
  api.meusAtendimentos.mockResolvedValueOnce([atendimento]);api.horarios.mockResolvedValueOnce({horarios:[outroHorario]});
  fireEvent.press(screen.getByRole('button',{name:'Atualizar meus agendamentos e horários'}));
  await screen.findByText(`Protocolo: ${atendimento.protocolo}`);expect(api.agendar).toHaveBeenCalledTimes(1);
});

test('409 recupera protocolo de confirmação anterior cuja resposta pode ter se perdido',async()=>{
  api.agendar.mockRejectedValueOnce(erroHttp(409));
  render(<AtendimentosCidadao url="http://localhost:3000" token="jwt-de-teste" onExit={jest.fn()}/>);
  await abrirCidadao();escolher();
  api.horarios.mockResolvedValueOnce({horarios:[outroHorario]});api.meusAtendimentos.mockResolvedValueOnce([atendimento]);
  fireEvent.press(screen.getByRole('button',{name:'Confirmar agendamento'}));
  await screen.findByText(`Você já tem um atendimento nesse horário. Guarde o protocolo: ${atendimento.protocolo}.`);
  expect(screen.getByText(`Protocolo: ${atendimento.protocolo}`)).toBeTruthy();expect(screen.queryByRole('alert')).toBeNull();
  expect(api.meusAtendimentos).toHaveBeenCalledTimes(2);expect(api.agendar).toHaveBeenCalledTimes(1);
});

test('se a conferência após 409 falhar, exige atualizar antes de reservar outro horário',async()=>{
  api.agendar.mockRejectedValueOnce(erroHttp(409));
  render(<AtendimentosCidadao url="http://localhost:3000" token="jwt-de-teste" onExit={jest.fn()}/>);
  await abrirCidadao();escolher();api.meusAtendimentos.mockRejectedValueOnce(new Error('offline'));
  fireEvent.press(screen.getByRole('button',{name:'Confirmar agendamento'}));
  await screen.findByText(/não foi possível conferir seus agendamentos após a disputa/i);
  expect(screen.getByRole('button',{name:`Selecionar: ${formatarHorarioAtendimento(outroHorario)}`}).props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByRole('button',{name:'Atualizar meus agendamentos e horários'}));
  await screen.findByText('Horários e situação dos seus agendamentos atualizados.');
  escolher(outroHorario);expect(screen.getByRole('button',{name:'Confirmar agendamento'}).props.accessibilityState.disabled).toBe(false);
});

test('falha de rede ao carregar permite tentar novamente sem encerrar acesso',async()=>{
  api.horarios.mockRejectedValueOnce(Object.assign(new Error('offline'),{isAxiosError:true}));
  const onExit=jest.fn();render(<AtendimentosCidadao url="http://localhost:3000" token="jwt-de-teste" onExit={onExit}/>);
  fireEvent.press(screen.getByRole('button',{name:'Agendar atendimento na secretaria'}));await screen.findByRole('alert');
  expect(onExit).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button',{name:'Atualizar meus agendamentos e horários'}));
  await screen.findByText('Você ainda não tem agendamentos.');
});

test.each(['horarios','meusAtendimentos','agendar'] as const)('401 em %s encerra acesso e aborta requisições da seção',async metodo=>{
  const onExit=jest.fn();api[metodo].mockRejectedValueOnce(erroHttp(401));
  render(<AtendimentosCidadao url="http://localhost:3000" token="jwt-de-teste" onExit={onExit}/>);
  if(metodo==='agendar'){await abrirCidadao();escolher();fireEvent.press(screen.getByRole('button',{name:'Confirmar agendamento'}));}
  else fireEvent.press(screen.getByRole('button',{name:'Agendar atendimento na secretaria'}));
  await waitFor(()=>expect(onExit).toHaveBeenCalledWith(expect.stringMatching(/encerrado.*entrar novamente/i)));
  const signal=api[metodo].mock.calls[0][metodo==='agendar'?2:1] as AbortSignal;expect(signal.aborted).toBe(true);
});

test.each(['resolver','rejeitar'] as const)('fechar durante confirmação aborta e ignora resposta tardia ao %s',async terminar=>{
  const reserva=pendente<Atendimento>();api.agendar.mockReturnValueOnce(reserva.promise);
  const onExit=jest.fn();render(<AtendimentosCidadao url="http://localhost:3000" token="jwt-de-teste" onExit={onExit}/>);
  await abrirCidadao();escolher();fireEvent.press(screen.getByRole('button',{name:'Confirmar agendamento'}));
  const signal=api.agendar.mock.calls[0][2] as AbortSignal;
  fireEvent.press(screen.getByRole('button',{name:'Fechar agendamentos'}));expect(signal.aborted).toBe(true);
  await act(async()=>{if(terminar==='resolver')reserva.resolver(atendimento);else reserva.rejeitar(erroHttp(401));});
  expect(onExit).not.toHaveBeenCalled();expect(screen.queryByText(`Protocolo: ${atendimento.protocolo}`)).toBeNull();
  await abrirCidadao();expect(screen.getByText('Você ainda não tem agendamentos.')).toBeTruthy();
});

test('desmontar durante consultas aborta ambas e resposta tardia não encerra acesso',async()=>{
  const consulta=pendente<Atendimento[]>();api.meusAtendimentos.mockReturnValueOnce(consulta.promise);
  const onExit=jest.fn();const tela=render(<AtendimentosCidadao url="http://localhost:3000" token="jwt-de-teste" onExit={onExit}/>);
  fireEvent.press(screen.getByRole('button',{name:'Agendar atendimento na secretaria'}));
  tela.unmount();expect((api.horarios.mock.calls[0][1] as AbortSignal).aborted).toBe(true);
  expect((api.meusAtendimentos.mock.calls[0][1] as AbortSignal).aborted).toBe(true);
  await act(async()=>consulta.rejeitar(erroHttp(401)));expect(onExit).not.toHaveBeenCalled();
});

test('admin carrega sob demanda, mascara CPF e permite somente agendado → confirmado → concluído',async()=>{
  const atualizacao=pendente<Atendimento>();api.atualizarAtendimento.mockReturnValueOnce(atualizacao.promise).mockResolvedValueOnce({...atendimento,status:'concluido'});
  render(<AtendimentosAdmin url="http://localhost:3000" credencial="admin-de-teste" onUnauthorized={jest.fn()}/>);
  expect(api.atendimentos).not.toHaveBeenCalled();await abrirAdmin();
  expect(api.atendimentos).toHaveBeenCalledWith('admin-de-teste',expect.any(AbortSignal));
  expect(screen.getByText('CPF: ***.***.***-00')).toBeTruthy();expect(screen.queryByText(cartao.cpf)).toBeNull();
  expect(screen.queryByRole('button',{name:/^Concluir atendimento/})).toBeNull();
  const confirmar=botaoAdmin('Confirmar');act(()=>{fireEvent.press(confirmar);fireEvent.press(confirmar);});
  expect(api.atualizarAtendimento).toHaveBeenCalledTimes(1);
  expect(api.atualizarAtendimento).toHaveBeenCalledWith(atendimento.id,'confirmado','admin-de-teste',expect.any(AbortSignal));
  await act(async()=>atualizacao.resolver({...atendimento,status:'confirmado'}));
  expect(await screen.findByText('Situação: Confirmado')).toBeTruthy();
  fireEvent.press(botaoAdmin('Concluir'));await screen.findByText('Situação: Concluído');
  expect(api.atualizarAtendimento).toHaveBeenLastCalledWith(atendimento.id,'concluido','admin-de-teste',expect.any(AbortSignal));
  expect(screen.queryByRole('button',{name:/^(Confirmar|Concluir) atendimento/})).toBeNull();
});

test('admin pode atualizar dados e mantém situação anterior se alteração falhar',async()=>{
  api.atualizarAtendimento.mockRejectedValueOnce(Object.assign(new Error('offline'),{isAxiosError:true}));
  const onUnauthorized=jest.fn();render(<AtendimentosAdmin url="http://localhost:3000" credencial="admin-de-teste" onUnauthorized={onUnauthorized}/>);
  await abrirAdmin();fireEvent.press(botaoAdmin('Confirmar'));await screen.findByRole('alert');
  expect(screen.getByText('Situação: Agendado')).toBeTruthy();expect(onUnauthorized).not.toHaveBeenCalled();
  api.atendimentos.mockResolvedValueOnce([{...atendimento,status:'confirmado'}]);
  fireEvent.press(screen.getByRole('button',{name:'Atualizar atendimentos'}));await screen.findByText('Situação: Confirmado');
  expect(screen.queryByRole('alert')).toBeNull();
});

test.each(['atendimentos','atualizarAtendimento'] as const)('admin encerra credencial em 401 de %s',async metodo=>{
  const onUnauthorized=jest.fn();api[metodo].mockRejectedValueOnce(erroHttp(401));
  render(<AtendimentosAdmin url="http://localhost:3000" credencial="admin-de-teste" onUnauthorized={onUnauthorized}/>);
  if(metodo==='atendimentos')fireEvent.press(screen.getByRole('button',{name:'Consultar atendimentos da secretaria'}));
  else{await abrirAdmin();fireEvent.press(botaoAdmin('Confirmar'));}
  await waitFor(()=>expect(onUnauthorized).toHaveBeenCalledTimes(1));
  const signal=api[metodo].mock.calls[0][metodo==='atendimentos'?1:3] as AbortSignal;expect(signal.aborted).toBe(true);
});

test('fechar admin durante escrita aborta e ignora 401 tardio; reabrir lê novamente',async()=>{
  const atualizacao=pendente<Atendimento>();api.atualizarAtendimento.mockReturnValueOnce(atualizacao.promise);
  const onUnauthorized=jest.fn();render(<AtendimentosAdmin url="http://localhost:3000" credencial="admin-de-teste" onUnauthorized={onUnauthorized}/>);
  await abrirAdmin();fireEvent.press(botaoAdmin('Confirmar'));
  const signal=api.atualizarAtendimento.mock.calls[0][3] as AbortSignal;
  fireEvent.press(screen.getByRole('button',{name:'Fechar atendimentos'}));expect(signal.aborted).toBe(true);
  await act(async()=>atualizacao.rejeitar(erroHttp(401)));expect(onUnauthorized).not.toHaveBeenCalled();
  api.atendimentos.mockResolvedValueOnce([{...atendimento,status:'confirmado'}]);await abrirAdmin();
  expect(screen.getByText('Situação: Confirmado')).toBeTruthy();expect(api.atendimentos).toHaveBeenCalledTimes(2);
});

test('admin respeita bloqueio de outra operação da tela',async()=>{
  const props={url:'http://localhost:3000',credencial:'admin-de-teste',onUnauthorized:jest.fn()};
  const tela=render(<AtendimentosAdmin {...props}/>);await abrirAdmin();
  tela.rerender(<AtendimentosAdmin {...props} disabled/>);
  fireEvent.press(botaoAdmin('Confirmar'));expect(api.atualizarAtendimento).not.toHaveBeenCalled();
  expect(screen.getByRole('button',{name:'Atualizar atendimentos'}).props.accessibilityState.disabled).toBe(true);
});
