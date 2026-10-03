import request from 'supertest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app';
import { ResumoCartao, UsuariosRepository } from '../src/repositories/usuarios.repository';

const admin = 'chave-administrativa-de-teste-paginacao-usuarios';
const cartoes: ResumoCartao[] = Array.from({length: 5}, (_, indice) => ({
  emissaoId: `00000000-0000-4000-8000-${String(indice + 1).padStart(12, '0')}`,
  cpf: String(12345678900 + indice), nome: `Pessoa de teste ${indice + 1}`, idade: 65 + indice,
  estado: (['ativo', 'bloqueado', 'substituido'] as const)[indice % 3]
}));
const repo: jest.Mocked<UsuariosRepository> = {
  listarEventos: jest.fn(), listar: jest.fn(), buscar: jest.fn(), buscarEmissao: jest.fn(), salvar: jest.fn(), bloquear: jest.fn()
};
let dir: string, app: ReturnType<typeof createApp>;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'facilid-usuarios-paginacao-'));
  app = createApp(dir, 'segredo-isolado-de-testes-paginacao-usuarios', admin, {repo});
});
beforeEach(() => {repo.listar.mockResolvedValue(structuredClone(cartoes));});
afterAll(() => {rmSync(dir, {recursive: true, force: true});});
const consultar = (query = '') => request(app).get(`/api/usuarios${query}`).set('X-Admin-Token', admin);

test('sem parâmetros mantém o array completo e a ordem do repositório assíncrono', async () => {
  expect((await consultar().expect(200)).body).toEqual(cartoes);
  expect(repo.listar).toHaveBeenCalledTimes(1);
});

test.each([
  [1, cartoes.slice(0, 2)], [2, cartoes.slice(2, 4)], [3, cartoes.slice(4)], [4, []]
])('página %i retorna somente seus itens com total e metadados', async (pagina, itens) => {
  expect((await consultar(`?pagina=${pagina}&limite=2`).expect(200)).body).toEqual({itens, total: 5, pagina, limite: 2});
  expect(repo.listar).toHaveBeenCalledTimes(1);
});

test('limite máximo 100 e página máxima segura são aceitos', async () => {
  expect((await consultar('?pagina=1&limite=100').expect(200)).body).toEqual({itens: cartoes, total: 5, pagina: 1, limite: 100});
  expect((await consultar(`?pagina=${Number.MAX_SAFE_INTEGER}&limite=100`).expect(200)).body).toEqual({itens: [], total: 5, pagina: Number.MAX_SAFE_INTEGER, limite: 100});
});

test('lista vazia mantém os dois contratos', async () => {
  repo.listar.mockResolvedValue([]);
  expect((await consultar().expect(200)).body).toEqual([]);
  expect((await consultar('?pagina=1&limite=20').expect(200)).body).toEqual({itens: [], total: 0, pagina: 1, limite: 20});
});

test.each([
  '?pagina=1', '?limite=20', '?busca=Maria', '?pagina=1&limite=20&estado=ativo',
  '?pagina=1&pagina=2&limite=20', '?pagina=1&limite=20&limite=20',
  '?pagina[]=1&limite=20', '?pagina=1&limite[tamanho]=20',
  '?pagina=&limite=20', '?pagina=1&limite=', '?pagina=0&limite=20', '?pagina=1&limite=0',
  '?pagina=-1&limite=20', '?pagina=1&limite=-1', '?pagina=1.5&limite=20', '?pagina=1&limite=2.5',
  '?pagina=1e2&limite=20', '?pagina=1&limite=0x10', '?pagina=%201&limite=20', '?pagina=1&limite=20%20',
  '?pagina=%2B1&limite=20', '?pagina=01&limite=20', '?pagina=1&limite=020',
  '?pagina=Infinity&limite=20', '?pagina=NaN&limite=20', '?pagina=1&limite=101',
  '?pagina=9007199254740992&limite=20', '?pagina=1&limite=9007199254740992', '?pagina=%ZZ&limite=20'
])('consulta inválida %s é recusada antes de ler dados', async query => {
  const resposta = await consultar(query).expect(400);
  expect(resposta.body).toEqual({mensagem: expect.any(String)});
  expect(repo.listar).not.toHaveBeenCalled();
});

test.each(['', '?pagina=1&limite=2', '?pagina=invalida&limite=200&extra=1'])('consulta %s exige chave administrativa', async query => {
  await request(app).get(`/api/usuarios${query}`).expect(401);
  await request(app).get(`/api/usuarios${query}`).set('X-Admin-Token', 'chave-invalida').expect(401);
  await request(app).get(`/api/usuarios${query}`).set('Authorization', 'Bearer credencial-de-cidadao').expect(401);
  expect(repo.listar).not.toHaveBeenCalled();
});

test('autorização precede também o parser da consulta', async () => {
  const padrao = app.get('query parser');
  const parser = jest.fn(() => {throw new Error('Parser não deve rodar sem autorização.');});
  app.set('query parser', parser);
  try {
    await request(app).get('/api/usuarios?pagina=1&limite=2').expect(401);
    expect(parser).not.toHaveBeenCalled();
    expect(repo.listar).not.toHaveBeenCalled();
  } finally {app.set('query parser', padrao);}
});

test('erro assíncrono do repositório na página continua sanitizado', async () => {
  repo.listar.mockRejectedValueOnce(new Error('Detalhe privado da persistência'));
  const resposta = await consultar('?pagina=1&limite=20').expect(500);
  expect(resposta.body).toEqual({mensagem: 'Não foi possível concluir. Tente novamente.', requestId: expect.any(String)});
});
