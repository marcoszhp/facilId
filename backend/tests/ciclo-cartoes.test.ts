import request from 'supertest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { carregarAdminToken } from '../src/services/admin.service';
import { JsonUsuariosRepository } from '../src/repositories/usuarios.repository';

const secret = 'segredo-de-testes-de-ciclo-com-mais-de-32-caracteres';
const admin = 'chave-administrativa-de-testes-com-mais-de-32-caracteres';
const pessoa = {cpf: '12345678900', nome: 'Maria Silva', idade: 72};
let dir: string, app: ReturnType<typeof createApp>;
beforeEach(() => {dir = mkdtempSync(path.join(tmpdir(), 'facilid-ciclo-')); app = createApp(dir, secret, admin);});
afterEach(() => {rmSync(dir, {recursive: true, force: true});});
const emitir = () => request(app).post('/api/emissao').set('X-Admin-Token', admin).send(pessoa).expect(201);
const entrar = (chip: unknown, target = app) => request(target).post('/api/autenticar-nfc').send({cpfDigitado: pessoa.cpf, dadosChip: chip});
const perfil = (token: string, target = app) => request(target).get('/api/perfil').set('Authorization', `Bearer ${token}`);
const bloquear = (id: string) => request(app).post(`/api/cartoes/${id}/bloquear`).set('X-Admin-Token', admin);

test('P1.2: reemissão idêntica cria outro ID/assinatura e mantém o anterior substituído', async () => {
  const primeiro = (await emitir()).body;
  const segundo = (await emitir()).body;
  expect(segundo.versao).toBe(2);
  expect(segundo.emissaoId).not.toBe(primeiro.emissaoId);
  expect(segundo.assinatura_digital_orgao).not.toBe(primeiro.assinatura_digital_orgao);
  expect((await entrar(primeiro)).status).toBe(401);
  expect((await entrar(segundo)).status).toBe(200);
  const lista = (await request(app).get('/api/usuarios').set('X-Admin-Token', admin)).body;
  expect(lista.map((r: {estado: string}) => r.estado)).toEqual(['substituido', 'ativo']);
  expect(Object.keys(lista[0]).sort()).toEqual(['cpf', 'emissaoId', 'estado', 'idade', 'nome']);
});

test.each(['emissaoId', 'versao'])('P1.2: o campo de emissão %s integra a assinatura', async campo => {
  const chip = (await emitir()).body;
  const alterado = {...chip, [campo]: campo === 'emissaoId' ? randomUUID() : 1};
  expect((await entrar(alterado)).status).toBe(401);
});

test.each(['ausente', 'incorreta', 'jwt-cidadao'])('P1.3: credencial administrativa %s não acessa nenhuma rota administrativa', async modo => {
  const chip = (await emitir()).body;
  const token = (await entrar(chip)).body.token;
  for (const [method, url] of [
    ['post', '/api/emissao'], ['get', '/api/usuarios'],
    ['get', `/api/cartoes/${chip.emissaoId}`], ['post', `/api/cartoes/${chip.emissaoId}/bloquear`]
  ] as const) {
    const consulta = request(app)[method](url);
    if (modo === 'incorreta') consulta.set('X-Admin-Token', 'incorreta');
    if (modo === 'jwt-cidadao') consulta.set('Authorization', `Bearer ${token}`).set('X-Admin-Token', token);
    if (url === '/api/emissao') consulta.send(pessoa);
    expect((await consulta).status).toBe(401);
  }
  expect((await entrar(chip)).status).toBe(200);
});

test('P1.3: responsável recupera cartão ativo; cidadão autentica sem chave administrativa', async () => {
  const chip = (await emitir()).body;
  expect((await request(app).get(`/api/cartoes/${chip.emissaoId}`).set('X-Admin-Token', admin)).body).toEqual(chip);
  expect((await entrar(chip)).status).toBe(200);
  expect((await perfil(admin)).status).toBe(401);
});

test('P1.3: chave local é aleatória, persistente e não aparece na resposta de erro', async () => {
  const local = carregarAdminToken(dir);
  expect(local.length).toBeGreaterThanOrEqual(32);
  expect(carregarAdminToken(dir)).toBe(local);
  const localApp = createApp(dir, secret, local);
  const erro = await request(localApp).get('/api/usuarios');
  expect(JSON.stringify(erro.body)).not.toContain(local);
  expect(() => createApp(dir, secret, 'curta')).toThrow(/administrativa/);
});

test('P1.5: reemissão idêntica revoga JWT anterior já emitido', async () => {
  const primeiro = (await emitir()).body;
  const sessao = (await entrar(primeiro)).body;
  expect((await perfil(sessao.token)).status).toBe(200);
  const novo = (await emitir()).body;
  expect((await perfil(sessao.token)).status).toBe(401);
  const novaSessao = (await entrar(novo)).body;
  expect((await perfil(novaSessao.token)).status).toBe(200);
});

test('P1.5: bloqueio revoga cartão e sessão, persiste após reiniciar e é idempotente', async () => {
  const chip = (await emitir()).body;
  const token = (await entrar(chip)).body.token;
  expect((await bloquear(chip.emissaoId)).body.estado).toBe('bloqueado');
  expect((await bloquear(chip.emissaoId)).body.estado).toBe('bloqueado');
  expect((await entrar(chip)).status).toBe(401);
  expect((await perfil(token)).status).toBe(401);
  const reiniciado = createApp(dir, secret, admin);
  expect((await entrar(chip, reiniciado)).status).toBe(401);
  expect((await perfil(token, reiniciado)).status).toBe(401);
  expect((await request(app).get(`/api/cartoes/${chip.emissaoId}`).set('X-Admin-Token', admin)).status).toBe(409);
});

test('P1.5: bloquear cartão substituído não afeta a nova emissão; bloqueado pode ser reemitido', async () => {
  const velho = (await emitir()).body;
  const novo = (await emitir()).body;
  expect((await bloquear(velho.emissaoId)).body.estado).toBe('substituido');
  expect((await entrar(novo)).status).toBe(200);
  await bloquear(novo.emissaoId);
  const reemitido = (await emitir()).body;
  expect((await entrar(novo)).status).toBe(401);
  expect((await entrar(reemitido)).status).toBe(200);
});

test('P1.5: JWT legado sem emissão e JWT de outra emissão não permitem acesso', async () => {
  const chip = (await emitir()).body;
  for (const claims of [{}, {emissaoId: randomUUID()}, {emissaoId: chip.emissaoId}]) {
    const token = jwt.sign(claims, secret, {subject: '98765432100', expiresIn: '15m', issuer: 'facilid', audience: 'acessosenior'});
    expect((await perfil(token)).status).toBe(401);
  }
  const legado = jwt.sign({}, secret, {subject: pessoa.cpf, expiresIn: '15m', issuer: 'facilid', audience: 'acessosenior'});
  expect((await perfil(legado)).status).toBe(401);
});

test('rotas de cartões retornam erro claro para ID inválido ou ausente', async () => {
  for (const [id, status] of [['invalido', 400], [randomUUID(), 404]] as const) {
    expect((await request(app).get(`/api/cartoes/${id}`).set('X-Admin-Token', admin)).status).toBe(status);
    expect((await bloquear(id)).status).toBe(status);
  }
});

test('migração preserva bytes do arquivo legado e dados; cartão v1 requer reemissão', async () => {
  const {versao, emissaoId, ...legado} = (await emitir()).body;
  const file = path.join(dir, 'usuarios.json');
  const original = JSON.stringify([legado], null, 2) + '\n';
  writeFileSync(file, original);
  const migrado = createApp(dir, secret, admin);
  expect(readFileSync(file + '.legado-v1.json', 'utf8')).toBe(original);
  expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({versao: 2, cartoes: [], legados: [legado]});
  expect((await entrar(legado, migrado)).status).toBe(401);
  expect((await entrar(legado, migrado)).body.mensagem).toMatch(/novo cartão/);
  const novo = await request(migrado).post('/api/emissao').set('X-Admin-Token', admin).send(pessoa).expect(201);
  expect((await entrar(novo.body, migrado)).status).toBe(200);
  expect(JSON.parse(readFileSync(file, 'utf8')).legados).toEqual([legado]);
  createApp(dir, secret, admin);
  expect(readFileSync(file + '.legado-v1.json', 'utf8')).toBe(original);
});

test('migração interrompe arquivo inválido ou backup conflitante sem sobrescrever dados', () => {
  const file = path.join(dir, 'usuarios.json');
  writeFileSync(file, '[{}]');
  expect(() => new JsonUsuariosRepository(file)).toThrow();
  expect(readFileSync(file, 'utf8')).toBe('[{}]');
  writeFileSync(file, '[]');
  writeFileSync(file + '.legado-v1.json', '["preservar"]');
  expect(() => new JsonUsuariosRepository(file)).toThrow(/Backup legado/);
  expect(readFileSync(file, 'utf8')).toBe('[]');
  expect(readFileSync(file + '.legado-v1.json', 'utf8')).toBe('["preservar"]');
});

test('request ID é gerado pelo servidor e correlaciona erro sem incluir dados enviados', async () => {
  const result = await request(app).post('/api/emissao').set('X-Request-Id', 'nao-confiavel').set('Content-Type', 'application/json').send('{');
  expect(result.status).toBe(400);
  expect(result.headers['x-request-id']).toMatch(/^[\da-f-]{36}$/);
  expect(result.body.requestId).toBe(result.headers['x-request-id']);
  expect(result.body).not.toHaveProperty('stack');
});
