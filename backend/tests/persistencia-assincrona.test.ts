import request from 'supertest';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app';
import { JsonUsuariosRepository, UsuariosRepository } from '../src/repositories/usuarios.repository';
import { Chip } from '../src/schemas/payload';
import { coletaTeste, loginCompleto, PIN_TESTE } from './helpers';

const secret = 'segredo-de-testes-assincronos-com-mais-de-32-caracteres';
const admin = 'chave-administrativa-assincrona-com-mais-de-32-caracteres';
const pessoa = {cpf: '12345678900', nome: 'Maria Fictícia', idade: 72};
let dir: string, base: JsonUsuariosRepository, repo: jest.Mocked<UsuariosRepository>, app: ReturnType<typeof createApp>;
function pendente<T>() {
  let resolver!: (valor: T) => void;
  const promise = new Promise<T>(resolve => {resolver = resolve;});
  return {promise, resolver};
}
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'facilid-async-'));
  base = new JsonUsuariosRepository(path.join(dir, 'dados-do-adaptador.json'));
  repo = {
    listar: jest.fn(async () => base.listar()),
    buscar: jest.fn(async cpf => base.buscar(cpf)),
    buscarEmissao: jest.fn(async id => base.buscarEmissao(id)),
    salvar: jest.fn(async chip => {base.salvar(chip);}),
    bloquear: jest.fn(async id => base.bloquear(id))
  };
  app = createApp(dir, secret, admin, {repo});
});
afterEach(() => {jest.restoreAllMocks(); rmSync(dir, {recursive: true, force: true});});
const emitir = () => request(app).post('/api/emissao').set('X-Admin-Token', admin).send({...coletaTeste, ...pessoa});
const desafiar = (chip: Chip) => request(app).post('/api/autenticar-nfc').send({cpfDigitado: chip.cpf, dadosChip: chip});
const confirmar = (desafioId: string, pin = PIN_TESTE) => request(app).post('/api/autenticar-confirmar').send({desafioId, pin});
const perfil = (token: string) => request(app).get('/api/perfil').set('Authorization', `Bearer ${token}`);

test('repositório assíncrono é aguardado em emissão, listagem, recuperação, login, perfil e bloqueio', async () => {
  const chip = (await emitir().expect(201)).body;
  expect(chip.emissaoId).toEqual(expect.any(String));
  expect(existsSync(path.join(dir, 'usuarios.json'))).toBe(false);
  const lista = await request(app).get('/api/usuarios').set('X-Admin-Token', admin).expect(200);
  expect(lista.body).toEqual([expect.objectContaining({emissaoId: chip.emissaoId, estado: 'ativo'})]);
  expect((await request(app).get(`/api/cartoes/${chip.emissaoId}`).set('X-Admin-Token', admin).expect(200)).body).toEqual(chip);
  const sessao = await loginCompleto(app, chip, pessoa.cpf);
  expect(sessao.status).toBe(200); expect((await perfil(sessao.body.token).expect(200)).body.nome).toBe(pessoa.nome);
  await request(app).post(`/api/cartoes/${chip.emissaoId}/bloquear`).set('X-Admin-Token', admin).expect(200);
  await perfil(sessao.body.token).expect(401);
});

test('falha assíncrona ao salvar remove a coleta da tentativa e preserva o cartão anterior', async () => {
  const anterior = (await emitir().expect(201)).body;
  let falhou!: Chip;
  repo.salvar.mockImplementationOnce(async chip => {falhou = chip; throw new Error('Detalhe interno do banco que não deve aparecer.');});
  const resposta = await emitir().expect(500);
  expect(Object.keys(resposta.body).sort()).toEqual(['mensagem', 'requestId']);
  expect(JSON.stringify(resposta.body)).not.toContain('Detalhe interno');
  expect(readdirSync(path.join(dir, 'coletas')).some(nome => nome.includes(falhou.emissaoId))).toBe(false);
  expect(base.buscar(pessoa.cpf)?.emissaoId).toBe(anterior.emissaoId);
  expect((await loginCompleto(app, anterior, pessoa.cpf)).status).toBe(200);
});

test('indisponibilidade do banco no perfil responde 500 sem invalidar a sessão como 401', async () => {
  const chip = (await emitir().expect(201)).body;
  const {token} = (await loginCompleto(app, chip, pessoa.cpf)).body;
  repo.buscarEmissao.mockRejectedValueOnce(new Error('mysql: informação interna'));
  const resposta = await perfil(token).expect(500);
  expect(resposta.body.mensagem).toBe('Não foi possível concluir. Tente novamente.');
  expect(JSON.stringify(resposta.body)).not.toContain('mysql:');
  await perfil(token).expect(200);
});

test('falhas assíncronas na listagem e na leitura do cartão chegam ao tratamento genérico', async () => {
  const chip = (await emitir().expect(201)).body;
  repo.listar.mockRejectedValueOnce(new Error('consulta indisponível'));
  await request(app).get('/api/usuarios').set('X-Admin-Token', admin).expect(500);
  repo.buscarEmissao.mockRejectedValueOnce(new Error('consulta indisponível'));
  await desafiar(chip).expect(500);
});

test('uma confirmação reserva o desafio antes de aguardar o banco e impede sucesso duplicado', async () => {
  const chip = (await emitir().expect(201)).body;
  const {desafioId} = (await desafiar(chip).expect(200)).body;
  const entrou = pendente<void>(), liberar = pendente<void>();
  repo.buscarEmissao.mockImplementationOnce(async id => {entrou.resolver(); await liberar.promise; return base.buscarEmissao(id);});
  const primeira = confirmar(desafioId).then(resposta => resposta);
  await entrou.promise;
  const paralela = await confirmar(desafioId).expect(409);
  expect(paralela.body).not.toHaveProperty('token');
  liberar.resolver(); expect((await primeira).status).toBe(200);
  await confirmar(desafioId).expect(401);
});

test('PIN incorreto libera a reserva para nova tentativa com o mesmo desafio', async () => {
  const chip = (await emitir().expect(201)).body;
  const {desafioId} = (await desafiar(chip).expect(200)).body;
  await confirmar(desafioId, '000000').expect(401);
  await confirmar(desafioId).expect(200);
  await confirmar(desafioId).expect(401);
});

test('falha do banco após verificar o fator libera o desafio, sem emitir JWT', async () => {
  const chip = (await emitir().expect(201)).body;
  const {desafioId} = (await desafiar(chip).expect(200)).body;
  repo.buscarEmissao.mockResolvedValueOnce(base.buscarEmissao(chip.emissaoId)).mockRejectedValueOnce(new Error('Banco indisponível após o fator.'));
  const falha = await confirmar(desafioId).expect(500);
  expect(falha.body).not.toHaveProperty('token');
  await confirmar(desafioId).expect(200);
});

test('bloqueio enquanto a confirmação aguarda a segunda leitura impede a emissão de JWT', async () => {
  const chip = (await emitir().expect(201)).body;
  const {desafioId} = (await desafiar(chip).expect(200)).body;
  const entrou = pendente<void>(), liberar = pendente<void>();
  repo.buscarEmissao.mockResolvedValueOnce(base.buscarEmissao(chip.emissaoId)).mockImplementationOnce(async id => {
    entrou.resolver(); await liberar.promise; return base.buscarEmissao(id);
  });
  const confirmacao = confirmar(desafioId).then(resposta => resposta);
  await entrou.promise; base.bloquear(chip.emissaoId); liberar.resolver();
  const resposta = await confirmacao;
  expect(resposta.status).toBe(401); expect(resposta.body).not.toHaveProperty('token');
  await confirmar(desafioId).expect(401);
});

test('desafio que expira durante a espera do banco não libera acesso e fica consumido', async () => {
  const chip = (await emitir().expect(201)).body;
  const {desafioId, expiraEm} = (await desafiar(chip).expect(200)).body;
  const entrou = pendente<void>(), liberar = pendente<void>();
  repo.buscarEmissao.mockImplementationOnce(async id => {entrou.resolver(); await liberar.promise; return base.buscarEmissao(id);});
  const confirmacao = confirmar(desafioId).then(resposta => resposta);
  await entrou.promise;
  const relogio = jest.spyOn(Date, 'now').mockReturnValue(expiraEm + 1);
  liberar.resolver(); expect((await confirmacao).status).toBe(401);
  relogio.mockRestore(); await confirmar(desafioId).expect(401);
});

test('saúde verifica persistência injetada e expõe somente indisponibilidade sem detalhes do banco', async () => {
  const verificar = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
  const monitorado = createApp(dir, secret, admin, {repo, verificarPersistencia: verificar});
  expect((await request(monitorado).get('/health').expect(200)).body).toEqual({status: 'ok'});
  verificar.mockRejectedValueOnce(new Error('host e senha internos'));
  expect((await request(monitorado).get('/health').expect(503)).body).toEqual({status: 'indisponivel', mensagem: 'Banco de dados indisponível.'});
  expect((await request(app).get('/health').expect(200)).body).toEqual({status: 'ok'});
});
