import axios, { AxiosInstance } from 'axios';
import { criarApi, erroCancelado, erroNaoAutorizado } from '../src/services/api.service';
import { cartao, sessao } from './helpers';

const get = jest.fn();
const post = jest.fn();
beforeEach(() => {
  get.mockReset();
  post.mockReset();
  jest.spyOn(axios, 'create').mockReturnValue({ get, post } as unknown as AxiosInstance);
});

test('login valida o cartão comum e encaminha AbortSignal ao transporte', async () => {
  const controller = new AbortController();
  post.mockResolvedValue({ data: sessao() });
  await criarApi('http://localhost:3000').entrar('123.456.789-00', JSON.stringify(cartao), controller.signal);
  expect(post).toHaveBeenCalledWith('/api/autenticar-nfc', {
    cpfDigitado: cartao.cpf, dadosChip: cartao,
  }, expect.objectContaining({ signal: controller.signal }));
});

test('cartão malformado não chega ao transporte de autenticação', async () => {
  await expect(criarApi('http://localhost:3000').entrar(cartao.cpf, '{')).rejects.toThrow(/inválido/i);
  expect(post).not.toHaveBeenCalled();
});

test('emissão e listagem enviam a credencial do responsável por cabeçalho', async () => {
  const controller = new AbortController();
  const api = criarApi('http://localhost:3000');
  post.mockResolvedValue({ data: cartao });
  get.mockResolvedValue({ data: [] });
  await api.emitir(sessao().perfil, 'responsavel-ficticio', controller.signal);
  await api.usuarios('responsavel-ficticio', controller.signal);
  const configuracao = expect.objectContaining({
    signal: controller.signal,
    headers: expect.objectContaining({ 'X-Admin-Token': 'responsavel-ficticio' }),
  });
  expect(post).toHaveBeenCalledWith('/api/emissao', sessao().perfil, configuracao);
  expect(get).toHaveBeenCalledWith('/api/usuarios', configuracao);
});

test('consulta autenticada preserva token e cancelamento no mesmo pedido', async () => {
  const controller = new AbortController();
  get.mockResolvedValue({ data: sessao().perfil });
  await criarApi('http://localhost:3000').perfil('sessao-ficticia', controller.signal);
  expect(get).toHaveBeenCalledWith('/api/perfil', expect.objectContaining({
    signal: controller.signal,
    headers: expect.objectContaining({ Authorization: 'Bearer sessao-ficticia' }),
  }));
});

test('todas as operações passam o AbortSignal ao transporte Axios', async () => {
  get.mockResolvedValue({ data: [] }); post.mockResolvedValue({ data: {} });
  const api = criarApi('http://localhost:3000');
  const { signal } = new AbortController();
  await api.emitir(sessao().perfil, 'admin-de-teste', signal);
  await api.usuarios('admin-de-teste', signal);
  await api.cartao(cartao.emissaoId, 'admin-de-teste', signal);
  await api.bloquear(cartao.emissaoId, 'admin-de-teste', signal);
  await api.entrar(cartao.cpf, JSON.stringify(cartao), signal);
  await api.perfil('sessao-de-teste', signal);
  for (const call of get.mock.calls) expect(call[1].signal).toBe(signal);
  for (const call of post.mock.calls) expect(call[2].signal).toBe(signal);
  expect(get).toHaveBeenCalledTimes(3);
  expect(post).toHaveBeenCalledTimes(3);
});

test('requisições do cidadão não herdam a chave do responsável', async () => {
  get.mockResolvedValue({ data: [] }); post.mockResolvedValue({ data: {} });
  const api = criarApi('http://localhost:3000');
  await api.usuarios('admin-de-teste');
  await api.entrar(cartao.cpf, JSON.stringify(cartao));
  await api.perfil('sessao-de-teste');
  expect(get.mock.calls[0][1].headers).toEqual({ 'X-Admin-Token': 'admin-de-teste' });
  expect(post.mock.calls[0][2].headers).toBeUndefined();
  expect(get.mock.calls[1][1].headers).toEqual({ Authorization: 'Bearer sessao-de-teste' });
});

test('CPF divergente é recusado antes da requisição de autenticação', async () => {
  await expect(criarApi('http://localhost:3000').entrar('98765432100', JSON.stringify(cartao))).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
});

test('reconhece 401 e cancelamento sem confundir falha de conexão com revogação', () => {
  expect(erroNaoAutorizado({ isAxiosError: true, response: { status: 401 } })).toBe(true);
  expect(erroNaoAutorizado({ isAxiosError: true, code: 'ERR_NETWORK' })).toBe(false);
  expect(erroCancelado(new axios.CanceledError())).toBe(true);
  const error = new Error(); error.name = 'AbortError';
  expect(erroCancelado(error)).toBe(true);
});
