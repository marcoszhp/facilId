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
import { MysqlAtendimentosRepository } from '../src/repositories/mysql-atendimentos.repository';
import { horariosDaGrade, novoAtendimento } from '../src/services/atendimento.service';
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
    repo: new MysqlUsuariosRepository(atual), atendimentosRepo: new MysqlAtendimentosRepository(atual), verificarPersistencia: async () => {await atual.query('SELECT 1');}
  });
}
const emitir = (dados: object = {}, target = app) => request(target).post('/api/emissao').set('X-Admin-Token', admin).send({...coletaTeste, ...pessoa, ...dados});
const perfil = (token: string, target = app) => request(target).get('/api/perfil').set('Authorization', `Bearer ${token}`);
const bloquear = (id: string, target = app) => request(target).post(`/api/cartoes/${id}/bloquear`).set('X-Admin-Token', admin);
async function quantidade(tabela: 'facilid_cartoes' | 'facilid_legados' | 'facilid_migracoes' | 'facilid_pessoas' | 'facilid_atendimentos' | 'facilid_eventos') {
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
  const eventos = await new MysqlUsuariosRepository(pool!).listarEventos();
  expect(eventos.filter(e => e.tipo === 'emissao')).toHaveLength(existente ? 4 : 3);
  expect(eventos.filter(e => e.tipo === 'substituicao')).toHaveLength(existente ? 3 : 2);
  expect(new Set(eventos.map(e => e.emissaoId + ':' + e.tipo)).size).toBe(eventos.length);
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
  expect(await repo.listarEventos()).toEqual([...dados.eventos].reverse().sort((a, b) => b.ocorridoEm.localeCompare(a.ocorridoEm)));
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
  await pool!.execute('DELETE FROM facilid_eventos WHERE emissao_id = ?', [chip.emissaoId]);
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
  await pool!.query('DELETE FROM facilid_eventos');
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

test('MySQL real: reservas concorrentes em duas instâncias têm um único vencedor por horário', async () => {
  const chip = (await emitir().expect(201)).body;
  const token = (await loginCompleto(app, chip, pessoa.cpf)).body.token;
  const outroChip = (await emitir({cpf: '98765432100', nome: 'Outra Pessoa Fictícia'}).expect(201)).body;
  const outroToken = (await loginCompleto(app, outroChip, outroChip.cpf)).body.token;
  const horario = horariosDaGrade()[0], outroApp = abrirApp();
  const reservar = (target: typeof app, bearer: string) => request(target).post('/api/atendimentos').set('Authorization', `Bearer ${bearer}`).send({horario});
  const respostas = await Promise.all([reservar(app, token), reservar(outroApp, outroToken), reservar(app, outroToken)]);
  expect(respostas.map(item => item.status).sort()).toEqual([201, 409, 409]);
  expect(await quantidade('facilid_atendimentos')).toBe(1);
  const vencedor = respostas.find(item => item.status === 201)!.body;
  expect(vencedor.horario).toBe(horario);
  expect(vencedor.protocolo).toMatch(/^FID-[A-F0-9]{12}$/);
  await reservar(app, token).expect(409);
  expect((await request(app).get('/api/atendimentos/horarios').set('Authorization', `Bearer ${token}`).expect(200)).body.horarios).not.toContain(horario);
  expect(existsSync(path.join(dir, 'atendimentos.json'))).toBe(false);
});

test('MySQL real: atendimento isola CPF, status é idempotente e sobrevive à reconexão e segunda via', async () => {
  const grade = horariosDaGrade();
  const primeiro = (await emitir().expect(201)).body;
  const token = (await loginCompleto(app, primeiro, pessoa.cpf)).body.token;
  const outro = (await emitir({cpf: '98765432100', nome: 'Outra Pessoa'}).expect(201)).body;
  const outroToken = (await loginCompleto(app, outro, outro.cpf)).body.token;
  const agendar = (bearer: string, horario: string) => request(app).post('/api/atendimentos').set('Authorization', `Bearer ${bearer}`).send({horario});
  const atendimento = (await agendar(token, grade[0]).expect(201)).body;
  const outroAtendimento = (await agendar(outroToken, grade[1]).expect(201)).body;
  const atualizar = (status: string) => request(app).patch(`/api/atendimentos/${atendimento.id}/status`).set('X-Admin-Token', admin).send({status});
  await atualizar('concluido').expect(409);
  const confirmados = await Promise.all([atualizar('confirmado'), atualizar('confirmado')]);
  expect(confirmados.map(item => item.status)).toEqual([200, 200]);
  expect(confirmados[0].body).toEqual(confirmados[1].body);
  const concluido = (await atualizar('concluido').expect(200)).body;
  expect((await atualizar('concluido').expect(200)).body).toEqual(concluido);
  await atualizar('confirmado').expect(409);
  await pool!.end(); pool = criarPoolMySql(config); app = abrirApp();
  const meus = (bearer: string) => request(app).get('/api/atendimentos/meus').set('Authorization', `Bearer ${bearer}`);
  expect((await meus(token).expect(200)).body).toEqual([concluido]);
  expect((await meus(outroToken).expect(200)).body).toEqual([outroAtendimento]);
  const segundaVia = (await emitir().expect(201)).body;
  await meus(token).expect(401);
  const novoToken = (await loginCompleto(app, segundaVia, pessoa.cpf)).body.token;
  expect((await meus(novoToken).expect(200)).body).toEqual([concluido]);
  await bloquear(segundaVia.emissaoId).expect(200);
  await agendar(novoToken, grade[2]).expect(401);
  expect(await quantidade('facilid_atendimentos')).toBe(2);
});

test('MySQL real: banco impõe protocolo único e FK da pessoa, com datas UTC preservadas', async () => {
  await emitir().expect(201);
  const repo = new MysqlAtendimentosRepository(pool!), grade = horariosDaGrade();
  const primeiro = novoAtendimento(pessoa, grade[0]);
  primeiro.criadoEm = primeiro.atualizadoEm = '2026-09-01T01:02:03.456Z';
  await repo.reservar(primeiro);
  await expect(repo.reservar({...primeiro, id: randomUUID(), horario: grade[1]})).rejects.toMatchObject({status: 409});
  await expect(repo.reservar(novoAtendimento({cpf: '00000000000', nome: 'Pessoa sem cartão'}, grade[2]))).rejects.toMatchObject({code: 'ER_NO_REFERENCED_ROW_2'});
  expect(await repo.listar()).toEqual([primeiro]);
  expect(await quantidade('facilid_atendimentos')).toBe(1);
});

test('MySQL real: preparo aditivo preserva cartões e atendimentos já existentes', async () => {
  const chip = (await emitir().expect(201)).body;
  const repo = new MysqlAtendimentosRepository(pool!);
  const atendimento = await repo.reservar(novoAtendimento(pessoa, horariosDaGrade()[0]));
  await prepararSchema(pool!);
  expect((await new MysqlUsuariosRepository(pool!).buscarEmissao(chip.emissaoId))?.chip).toEqual(chip);
  expect(await repo.listar()).toEqual([atendimento]);
  for (const tabela of ['facilid_pessoas', 'facilid_cartoes', 'facilid_atendimentos'] as const) expect(await quantidade(tabela)).toBe(1);
  for (const tabela of ['facilid_legados', 'facilid_migracoes'] as const) expect(await quantidade(tabela)).toBe(0);
});

test('MySQL real: falha ao atualizar status faz rollback e não expõe erro do banco', async () => {
  await emitir().expect(201);
  const repo = new MysqlAtendimentosRepository(pool!);
  const atendimento = await repo.reservar(novoAtendimento(pessoa, horariosDaGrade()[0]));
  await pool!.query("CREATE TRIGGER falha_status BEFORE UPDATE ON facilid_atendimentos FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Detalhe artificial privado do banco'");
  const resposta = await request(app).patch(`/api/atendimentos/${atendimento.id}/status`).set('X-Admin-Token', admin).send({status: 'confirmado'}).expect(500);
  expect(JSON.stringify(resposta.body)).not.toContain('privado');
  expect(await repo.listar()).toEqual([atendimento]);
  await pool!.query('DROP TRIGGER falha_status');
  await request(app).patch(`/api/atendimentos/${atendimento.id}/status`).set('X-Admin-Token', admin).send({status: 'confirmado'}).expect(200);
});

test('eventos MySQL: bloqueio repetido, segunda via e reconexão preservam cronologia e identidade do cartão', async () => {
  const primeiro = (await emitir().expect(201)).body;
  await bloquear(primeiro.emissaoId).expect(200);
  await bloquear(primeiro.emissaoId).expect(200);
  const segundo = (await emitir({nome: 'Outro nome da mesma pessoa'}).expect(201)).body;
  await bloquear(primeiro.emissaoId).expect(200);
  const lista = await new MysqlUsuariosRepository(pool!).listarEventos();
  expect(lista.map(e => e.tipo)).toEqual(['emissao','substituicao','bloqueio','emissao']);
  expect(lista[0].emissaoId).toBe(segundo.emissaoId);
  expect(lista[1].nome).toBe(pessoa.nome);
  expect(await quantidade('facilid_eventos')).toBe(4);
  await pool!.end(); pool = criarPoolMySql(config); app = abrirApp();
  const resposta = await request(app).get('/api/eventos').set('X-Admin-Token', admin).expect(200);
  expect(resposta.body).toEqual(lista);
});

test.each(['emissao','bloqueio','substituicao'])('eventos MySQL: falha no evento %s reverte cartão e histórico juntos', async tipo => {
  const primeiro = (await emitir().expect(201)).body;
  const repo = new MysqlUsuariosRepository(pool!), antes = await repo.listarEventos();
  // Tipo vem somente da lista fixa deste teste e o trigger existe no schema artificial.
  await pool!.query("CREATE TRIGGER falha_evento BEFORE INSERT ON facilid_eventos FOR EACH ROW BEGIN IF NEW.tipo = '" + tipo + "' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'detalhe privado artificial'; END IF; END");
  const resposta = tipo === 'bloqueio' ? await bloquear(primeiro.emissaoId).expect(500) : await emitir().expect(500);
  expect(JSON.stringify(resposta.body)).not.toContain('detalhe privado');
  expect(await repo.listarEventos()).toEqual(antes);
  expect(await quantidade('facilid_cartoes')).toBe(1);
  expect((await repo.buscarEmissao(primeiro.emissaoId))?.estado).toBe('ativo');
  await pool!.query('DROP TRIGGER falha_evento');
  await bloquear(primeiro.emissaoId).expect(200);
  expect(await quantidade('facilid_eventos')).toBe(2);
});

test('eventos MySQL: preparo aditivo de instalação antiga não inventa histórico', async () => {
  const chip = (await emitir().expect(201)).body;
  conferirBancoDeTeste();
  await pool!.query('DROP TABLE facilid_eventos');
  await prepararSchema(pool!);
  const repo = new MysqlUsuariosRepository(pool!);
  expect(await repo.listarEventos()).toEqual([]);
  expect((await repo.buscarEmissao(chip.emissaoId))?.chip).toEqual(chip);
  await bloquear(chip.emissaoId).expect(200);
  expect((await repo.listarEventos()).map(e => e.tipo)).toEqual(['bloqueio']);
});

test('eventos MySQL: falha na importação reverte eventos, cartões, pessoas e marcador', async () => {
  const jsonApp = createApp(dir, secret, admin);
  await emitir({}, jsonApp).expect(201);
  const arquivo = path.join(dir, 'usuarios.json'), antes = readFileSync(arquivo);
  await pool!.query("CREATE TRIGGER falha_evento_importado BEFORE INSERT ON facilid_eventos FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falha artificial de importação'");
  await expect(migrarJson(arquivo, pool!)).rejects.toThrow();
  for (const tabela of ['facilid_eventos','facilid_cartoes','facilid_pessoas','facilid_migracoes'] as const) expect(await quantidade(tabela)).toBe(0);
  expect(readFileSync(arquivo)).toEqual(antes);
  await pool!.query('DROP TRIGGER falha_evento_importado');
  await migrarJson(arquivo, pool!);
  const historico = await new MysqlUsuariosRepository(pool!).listarEventos();
  await migrarJson(arquivo, pool!);
  expect(await new MysqlUsuariosRepository(pool!).listarEventos()).toEqual(historico);
  await pool!.query('DELETE FROM facilid_eventos');
  await expect(migrarJson(arquivo, pool!)).rejects.toMatchObject({code: 'FACILID_MIGRATION_CONFLICT'});
});
