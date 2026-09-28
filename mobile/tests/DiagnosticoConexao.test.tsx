import React from 'react';
import axios,{AxiosInstance} from 'axios';
import { act,fireEvent,render,screen } from '@testing-library/react-native';
import { DiagnosticoConexao } from '../src/components/DiagnosticoConexao';
import { pendente } from './helpers';

const get=jest.fn(),url='http://servico-privado.invalid:3000';
const saude=(tipo='mysql',status='disponivel')=>({
  status:status==='indisponivel'?'indisponivel':'ok',api:{status:'disponivel'},persistencia:{tipo,status},
});
const resposta=(tipo='mysql',status='disponivel')=>({status:status==='indisponivel'?503:200,data:saude(tipo,status)});
beforeEach(()=>{
  get.mockReset();jest.spyOn(axios,'create').mockReturnValue({get} as unknown as AxiosInstance);
});
afterEach(()=>jest.restoreAllMocks());
function abrir(){fireEvent.press(screen.getByRole('button',{name:'Diagnosticar conexão'}));}
function verificar(){fireEvent.press(screen.getByRole('button',{name:'Verificar conexão'}));}

test('consulta pública sob demanda verifica MySQL, sem expor URL nem enviar credenciais',async()=>{
  get.mockResolvedValue(resposta());render(<DiagnosticoConexao url={url}/>);
  expect(get).not.toHaveBeenCalled();abrir();expect(get).not.toHaveBeenCalled();verificar();
  await screen.findByText('API: acessível.');expect(screen.getByText('MySQL: disponível.')).toBeTruthy();
  expect(get).toHaveBeenCalledWith('/health',{signal:expect.any(AbortSignal),validateStatus:expect.any(Function)});
  expect(axios.create).toHaveBeenCalledWith({baseURL:url,timeout:10000});
  expect(JSON.stringify(screen.toJSON())).not.toContain(url);
});

test('503 válido distingue API acessível de MySQL indisponível e pode recuperar na próxima consulta',async()=>{
  get.mockResolvedValueOnce({...resposta('mysql','indisponivel'),data:{...saude('mysql','indisponivel'),mensagem:'senha e host privados'}}).mockResolvedValueOnce(resposta());
  render(<DiagnosticoConexao url={url}/>);abrir();verificar();
  await screen.findByText('MySQL: indisponível.');expect(screen.getByText('API: acessível.')).toBeTruthy();
  expect(JSON.stringify(screen.toJSON())).not.toContain('senha e host privados');
  verificar();await screen.findByText('MySQL: disponível.');
});

test.each(['ERR_NETWORK','ECONNABORTED'])('falha %s não atribui a causa ao MySQL nem expõe erro bruto',async code=>{
  get.mockRejectedValue(new axios.AxiosError('detalhe privado do transporte',code));
  render(<DiagnosticoConexao url={url}/>);abrir();verificar();
  await screen.findByText('API: sem resposta.');expect(screen.getByText('Banco de dados: não verificado.')).toBeTruthy();
  expect(screen.queryByText('MySQL: indisponível.')).toBeNull();
  expect(JSON.stringify(screen.toJSON())).not.toContain('detalhe privado');
});

test.each([
  {status:404,data:'<html>Detalhe privado</html>'},
  {status:200,data:{status:'ok'}},
  {status:200,data:saude('mysql','indisponivel')},
])('resposta incompatível não confirma estado do banco: %j',async retorno=>{
  get.mockResolvedValue(retorno);render(<DiagnosticoConexao url={url}/>);abrir();verificar();
  await screen.findByText('API: resposta incompatível.');expect(screen.getByText('Banco de dados: não verificado.')).toBeTruthy();
  expect(JSON.stringify(screen.toJSON())).not.toContain('Detalhe privado');
});

test('JSON informa MySQL não utilizado e tipo desconhecido não confirma conexão com banco',async()=>{
  get.mockResolvedValueOnce(resposta('json')).mockResolvedValueOnce(resposta('nao_informado','nao_verificada'));
  render(<DiagnosticoConexao url={url}/>);abrir();verificar();
  await screen.findByText('MySQL: não utilizado. Armazenamento JSON de simulação.');
  expect(screen.queryByText('MySQL: disponível.')).toBeNull();verificar();
  await screen.findByText('Banco de dados: não verificado.');expect(screen.getByText('API: acessível.')).toBeTruthy();
});

test('cancela transporte e ignora resposta tardia sem sobrescrever nova verificação',async()=>{
  const antiga=pendente<ReturnType<typeof resposta>>();get.mockReturnValueOnce(antiga.promise).mockResolvedValueOnce(resposta('mysql','indisponivel'));
  render(<DiagnosticoConexao url={url}/>);abrir();
  const botao=screen.getByRole('button',{name:'Verificar conexão'});
  act(()=>{fireEvent.press(botao);fireEvent.press(botao);});expect(get).toHaveBeenCalledTimes(1);
  const signal=get.mock.calls[0][1].signal as AbortSignal;
  fireEvent.press(screen.getByRole('button',{name:'Cancelar verificação'}));expect(signal.aborted).toBe(true);
  verificar();await screen.findByText('MySQL: indisponível.');
  await act(async()=>antiga.resolver(resposta()));expect(screen.queryByText('MySQL: disponível.')).toBeNull();
});

test('fechar, mudar URL e desmontar abortam e descartam resultados sem iniciar novas chamadas',async()=>{
  const antiga=pendente<ReturnType<typeof resposta>>(),outra=pendente<ReturnType<typeof resposta>>();
  get.mockReturnValueOnce(antiga.promise).mockReturnValueOnce(outra.promise).mockReturnValueOnce(new Promise(()=>{}));
  const view=render(<DiagnosticoConexao url={url}/>);abrir();verificar();
  const primeiro=get.mock.calls[0][1].signal as AbortSignal;
  fireEvent.press(screen.getByRole('button',{name:'Fechar diagnóstico'}));expect(primeiro.aborted).toBe(true);
  abrir();await act(async()=>antiga.resolver(resposta()));expect(screen.queryByText('MySQL: disponível.')).toBeNull();
  verificar();const segundo=get.mock.calls[1][1].signal as AbortSignal;
  view.rerender(<DiagnosticoConexao url="http://novo-servico.invalid:3000"/>);expect(segundo.aborted).toBe(true);
  await act(async()=>outra.resolver(resposta()));expect(screen.queryByText('API: acessível.')).toBeNull();expect(get).toHaveBeenCalledTimes(2);
  verificar();expect(axios.create).toHaveBeenLastCalledWith({baseURL:'http://novo-servico.invalid:3000',timeout:10000});
  const terceiro=get.mock.calls[2][1].signal as AbortSignal;view.unmount();expect(terceiro.aborted).toBe(true);
});
