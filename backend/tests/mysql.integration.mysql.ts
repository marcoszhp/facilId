import request from 'supertest';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Connection, Pool, RowDataPacket, createConnection } from 'mysql2/promise';
import { createApp } from '../src/app';
import { criarPoolMySql, MySqlConfig, prepararSchema } from '../src/db/mysql';
import { migrarJson } from '../src/db/migrar-json';
import { MysqlUsuariosRepository } from '../src/repositories/mysql-usuarios.repository';
import { coletaTeste, loginCompleto, PIN_TESTE } from './helpers';

// Suite opt-in: não carrega .env nem utiliza DB_NAME. Cada caso cria seu próprio
// schema artificial; a conexão administrativa nunca seleciona o banco principal.
const conexao = {
  host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || ''
};
const secret = 'segredo-ficticio-teste-mysql-mais-de-32-caracteres';
const admin = 'responsavel-ficticio-teste-mysql-mais-de-32-caracteres';
const pessoa = {cpf: '12345678900', nome: 'Pessoa Fictícia MySQL', idade: 72};
let administracao: Connection | undefined;
let pool: Pool | undefined, config: MySqlConfig, banco = '', criado = false, dir = '';
let app: ReturnType<typeof createApp>;

function conferirBancoDeTeste() {
  if (!criado || !/^facilid_test_\d+_[a-f0-9]{12}$/.test(banco)) throw new Error('Limpeza recusada: schema não foi criado por esta suíte.');
}
function abrirApp() {
  const atual = pool!;
  return createApp(dir, secret, admin, {
    repo: new MysqlUsuariosRepository(atual), verificarPersistencia: async () => {await atual.query('SELECT 1');}
  });
}
const emitir = (dados: object = {}, target = app) => request(target).post('/api/emissao').set('X-Admin-Token', admin).send({...coletaTeste, ...pessoa, ...dados});
const perfil = (token: string, target = app) => request(target).get('/api/perfil').set('Authorization', `Bearer ${token}`);
const bloquear = (id: string, target = app) => request(target).post(`/api/cartoes/${id}/bloquear`).set('X-Admin-Token', admin);
async function quantidade(tabela: 'facilid_cartoes' | 'facilid_legados' | 'facilid_migracoes' | 'facilid_pessoas') {
  const [rows] = await pool!.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM ${tabela}`);
  return Number(rows[0].total);
}
function privados() {
  const arquivos = new Map<string, string>();
  for (const pasta of ['keys', 'coletas']) {
    const local = path.join(dir, pasta);
    if (!existsSync(local)) continue;
    for (const nome of readdirSync(local)) arquivos.set(pasta + '/' + nome, createHash('sha256').update(readFileSync(path.join(local, nome))).digest('hex'));
  }
  return arquivos;
}

beforeAll(async () => {
  if (!['127.0.0.1', 'localhost', '::1'].includes(conexao.host)) throw new Error('Esta suíte permite somente MySQL local e schemas artificiais.');
  administracao = await createConnection(conexao);
});
beforeEach(async () => {
  banco = `facilid_test_${process.pid}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  if (!/^facilid_test_\d+_[a-f0-9]{12}$/.test(banco)) throw new Error('Nome inválido para o schema de teste.');
  criado = false;
  await administracao!.query(`CREATE DATABASE \`${banco}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  criado = true;
  config = {...conexao, database: banco};
  pool = criarPoolMySql(config);
  await prepararSchema(pool);
  dir = mkdtempSync(path.join(tmpdir(), 'facilid-mysql-'));
  app = abrirApp();
});
afterEach(async () => {
  if (pool) {await pool.end(); pool = undefined;}
  if (criado) {
    conferirBancoDeTeste();
    await administracao!.query(`DROP DATABASE \`${banco}\``);
    criado = false;
  }
  if (dir) {
    const absoluto = path.resolve(dir);
    if (path.dirname(absoluto) !== path.resolve(tmpdir()) || !path.basename(absoluto).startsWith('facilid-mysql-')) throw new Error('Limpeza recusada: pasta fora do diretório temporário de teste.');
    rmSync(absoluto, {recursive: true, force: true}); dir = '';
  }
});
afterAll(async () => {if (administracao) await administracao.end();});
jest.setTimeout(30_000);

test('MySQL real: emissão, PIN, perfil e reconexão preservam cartão e sessão', async () => {
  const chip = (await emitir().expect(201)).body;
  const sessao = (await loginCompleto(app, chip, pessoa.cpf)).body;
  expect(sessao.token).toEqual(expect.any(String));
  expect((await perfil(sessao.token).expect(200)).body).toEqual(pessoa);
  expect(existsSync(path.join(dir, 'usuarios.json'))).toBe(false);
  await pool!.end(); pool = criarPoolMySql(config); app = abrirApp();
  expect((await new MysqlUsuariosRepository(pool).buscarEmissao(chip.emissaoId))?.chip).toEqual(chip);
  await perfil(sessao.token).expect(200);
  expect((await loginCompleto(app, chip, pessoa.cpf)).status).toBe(200);
});

test('MySQL real: bloqueio e segunda via revogam sessões, inclusive após reconexão', async () => {
  const primeiro = (await emitir().expect(201)).body;
  const primeiraSessao = (await loginCompleto(app, primeiro, pessoa.cpf)).body;
  const segundo = (await emitir().expect(201)).body;
  await perfil(primeiraSessao.token).expect(401);
  expect((await loginCompleto(app, primeiro, pessoa.cpf)).status).toBe(401);
  const segundaSessao = (await loginCompleto(app, segundo, pessoa.cpf)).body;
  await bloquear(segundo.emissaoId).expect(200);
  await pool!.end(); pool = criarPoolMySql(config); app = abrirApp();
  await perfil(segundaSessao.token).expect(401);
  expect((await loginCompleto(app, segundo, pessoa.cpf)).status).toBe(401);
  expect((await new MysqlUsuariosRepository(pool).listar()).map(item => item.estado)).toEqual(['substituido', 'bloqueado']);
});

test.each([false, true])('MySQL real: emissões simultâneas deixam um cartão ativo (CPF existente: %s)', async existente => {
  if (existente) await emitir().expect(201);
  const respostas = await Promise.all([emitir(), emitir(), emitir()]);
  respostas.forEach(resposta => expect(resposta.status).toBe(201));
  const registros = await new MysqlUsuariosRepository(pool!).listar();
  expect(registros).toHaveLength(existente ? 4 : 3);
  expect(registros.filter(registro => registro.estado === 'ativo')).toHaveLength(1);
  expect(registros.filter(registro => registro.estado === 'substituido')).toHaveLength(existente ? 3 : 2);
  for (const resposta of respostas) {
    const ativo = registros.find(registro => registro.emissaoId === resposta.body.emissaoId)!.estado === 'ativo';
    expect((await loginCompleto(app, resposta.body, pessoa.cpf)).status).toBe(ativo ? 200 : 401);
  }
});

test('MySQL real: nome com caracteres de SQL é dado, não comando', async () => {
  const nome = "Teste'); DROP TABLE facilid_cartoes; --";
  const chip = (await emitir({nome}).expect(201)).body;
  const salvo = await new MysqlUsuariosRepository(pool!).buscarEmissao(chip.emissaoId);
  expect(salvo?.chip.nome).toBe(nome);
  expect(await quantidade('facilid_cartoes')).toBe(1);
  expect((await request(app).get('/api/cartoes/%27%20OR%201%3D1').set('X-Admin-Token', admin)).status).toBe(400);
});

test('MySQL real: falha depois de começar a segunda via faz rollback sem revogar cartão anterior', async () => {
  const chip = (await emitir().expect(201)).body;
  const sessao = (await loginCompleto(app, chip, pessoa.cpf)).body;
  await pool!.query("CREATE TRIGGER falha_controlada BEFORE INSERT ON facilid_cartoes FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falha artificial do teste'");
  await emitir().expect(500);
  expect(await quantidade('facilid_cartoes')).toBe(1);
  expect((await new MysqlUsuariosRepository(pool!).buscarEmissao(chip.emissaoId))?.estado).toBe('ativo');
  await perfil(sessao.token).expect(200);
});

test('migração real preserva histórico, RSA, arquivos privados, PIN e bytes da origem; reexecução é idempotente', async () => {
  const jsonApp = createApp(dir, secret, admin);
  const primeiro = (await emitir({}, jsonApp).expect(201)).body;
  const segundo = (await emitir({}, jsonApp).expect(201)).body;
  const terceiro = (await emitir({cpf: '98765432100'}, jsonApp).expect(201)).body;
  await bloquear(terceiro.emissaoId, jsonApp).expect(200);
  const sessao = (await loginCompleto(jsonApp, segundo, pessoa.cpf)).body;
  const arquivo = path.join(dir, 'usuarios.json');
  const dados = JSON.parse(readFileSync(arquivo, 'utf8'));
  const {versao, emissaoId, ...legado} = primeiro;
  dados.legados = [legado, legado];
  const original = JSON.stringify(dados, null, 2) + '\n';
  writeFileSync(arquivo, original);
  const antes = privados();
  await expect(migrarJson(arquivo, pool!)).resolves.toEqual({cartoesImportados: 3, legadosImportados: 2, jaAplicada: false});
  expect(readFileSync(arquivo, 'utf8')).toBe(original);
  expect(privados()).toEqual(antes);
  await expect(migrarJson(arquivo, pool!)).resolves.toEqual({cartoesImportados: 0, legadosImportados: 0, jaAplicada: true});
  expect(await quantidade('facilid_migracoes')).toBe(1);
  expect(await quantidade('facilid_legados')).toBe(2);
  const repo = new MysqlUsuariosRepository(pool!);
  for (const registro of dados.cartoes) expect(await repo.buscarEmissao(registro.chip.emissaoId)).toEqual(registro);
  app = abrirApp();
  await perfil(sessao.token).expect(200);
  expect((await loginCompleto(app, segundo, pessoa.cpf)).status).toBe(200);
  expect((await loginCompleto(app, primeiro, pessoa.cpf)).status).toBe(401);
  expect((await loginCompleto(app, terceiro, '98765432100')).status).toBe(401);
});

test('migração recusa estado divergente ou registros removidos depois da importação sem reativá-los', async () => {
  const jsonApp = createApp(dir, secret, admin);
  const chip = (await emitir({}, jsonApp).expect(201)).body;
  const arquivo = path.join(dir, 'usuarios.json'), original = readFileSync(arquivo);
  await migrarJson(arquivo, pool!);
  await new MysqlUsuariosRepository(pool!).bloquear(chip.emissaoId);
  await expect(migrarJson(arquivo, pool!)).rejects.toMatchObject({code: 'FACILID_MIGRATION_CONFLICT'});
  expect((await new MysqlUsuariosRepository(pool!).buscarEmissao(chip.emissaoId))?.estado).toBe('bloqueado');
  await pool!.execute('DELETE FROM facilid_cartoes WHERE emissao_id = ?', [chip.emissaoId]);
  await expect(migrarJson(arquivo, pool!)).rejects.toMatchObject({code: 'FACILID_MIGRATION_CONFLICT'});
  expect(await quantidade('facilid_cartoes')).toBe(0);
  expect(readFileSync(arquivo)).toEqual(original);
});

test('falha no meio da migração reverte todos os cartões, pessoas e marcador de importação', async () => {
  const jsonApp = createApp(dir, secret, admin);
  await emitir({}, jsonApp).expect(201);
  await emitir({cpf: '98765432100', nome: 'Falhar migração'}, jsonApp).expect(201);
  const arquivo = path.join(dir, 'usuarios.json'), original = readFileSync(arquivo);
  await pool!.query("CREATE TRIGGER falha_migracao BEFORE INSERT ON facilid_cartoes FOR EACH ROW BEGIN IF NEW.nome = 'Falhar migração' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falha artificial do teste'; END IF; END");
  await expect(migrarJson(arquivo, pool!)).rejects.toThrow();
  expect(await quantidade('facilid_cartoes')).toBe(0);
  expect(await quantidade('facilid_pessoas')).toBe(0);
  expect(await quantidade('facilid_migracoes')).toBe(0);
  expect(readFileSync(arquivo)).toEqual(original);
});

test('JSON v1 é preservado como legado sem alterar origem ou backup; JSON inválido não importa nada', async () => {
  const chip = (await emitir().expect(201)).body;
  const {versao, emissaoId, ...legado} = chip;
  // Esvazia somente o schema artificial deste caso, antes de importar o arquivo v1.
  conferirBancoDeTeste();
  await pool!.query('DELETE FROM facilid_cartoes');
  await pool!.query('DELETE FROM facilid_pessoas');
  const arquivo = path.join(dir, 'origem-v1.json'), backup = arquivo + '.legado-v1.json';
  const original = JSON.stringify([legado, legado], null, 2) + '\n';
  writeFileSync(arquivo, original); writeFileSync(backup, 'backup artificial que deve permanecer intacto');
  await expect(migrarJson(arquivo, pool!)).resolves.toEqual({cartoesImportados: 0, legadosImportados: 2, jaAplicada: false});
  await expect(migrarJson(arquivo, pool!)).resolves.toEqual({cartoesImportados: 0, legadosImportados: 0, jaAplicada: true});
  expect(readFileSync(arquivo, 'utf8')).toBe(original);
  expect(readFileSync(backup, 'utf8')).toBe('backup artificial que deve permanecer intacto');
  const invalido = path.join(dir, 'invalido.json'); writeFileSync(invalido, '[{}]');
  await expect(migrarJson(invalido, pool!)).rejects.toMatchObject({code: 'FACILID_MIGRATION_INVALID'});
  expect(await quantidade('facilid_legados')).toBe(2);
  expect(await quantidade('facilid_cartoes')).toBe(0);
  expect(readFileSync(invalido, 'utf8')).toBe('[{}]');
  expect(PIN_TESTE).toHaveLength(6);
});
