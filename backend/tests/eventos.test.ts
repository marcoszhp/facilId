import request from 'supertest';
import fs = require('node:fs');
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Pool } from 'mysql2/promise';
import { createApp } from '../src/app';
import { migrarJson } from '../src/db/migrar-json';
import { JsonUsuariosRepository, UsuariosRepository } from '../src/repositories/usuarios.repository';
import { Chip } from '../src/schemas/payload';
import { EventoAdministrativo, eventoAdministrativoSchema, motivosEvento, novoEvento } from '../src/schemas/evento';
import { coletaTeste, loginCompleto, PIN_TESTE } from './helpers';

const admin = 'chave-ficticia-eventos-com-mais-de-32-caracteres';
const secret = 'segredo-ficticio-eventos-com-mais-de-32-caracteres';
const pessoa = {cpf: '12345678900', nome: 'Maria Fictícia', idade: 72};
let dir: string, file: string;
beforeEach(() => {dir = fs.mkdtempSync(path.join(tmpdir(), 'facilid-eventos-')); file = path.join(dir, 'usuarios.json');});
afterEach(() => {jest.restoreAllMocks(); fs.rmSync(dir, {recursive: true, force: true});});
const chipTeste = (nome = pessoa.nome): Chip => ({...pessoa, nome, versao: 2, emissaoId: randomUUID(),
  rosto_hash: 'foto-ficticia', digital_template: 'DEMONSTRACAO_SEM_BIOMETRIA', assinatura_svg: 'hash-ficticio', assinatura_digital_orgao: 'dGVzdGU='});
const eventos = (app: ReturnType<typeof createApp>) => request(app).get('/api/eventos').set('X-Admin-Token', admin);
const emitir = (app: ReturnType<typeof createApp>, nome = pessoa.nome) => request(app).post('/api/emissao').set('X-Admin-Token', admin).send({...coletaTeste, ...pessoa, nome});
const bloquear = (app: ReturnType<typeof createApp>, id: string) => request(app).post(`/api/cartoes/${id}/bloquear`).set('X-Admin-Token', admin);

test('eventos começa vazio e consulta sem parâmetros exige chave administrativa antes de validar', async () => {
  const repo = new JsonUsuariosRepository(file), listar = jest.spyOn(repo, 'listarEventos');
  const app = createApp(dir, secret, admin, {repo});
  expect((await eventos(app).expect(200)).body).toEqual([]);
  listar.mockClear();
  await request(app).get('/api/eventos?cpf=12345678900').expect(401);
  await request(app).get('/api/eventos?pagina=1').set('X-Admin-Token', 'incorreta').expect(401);
  await request(app).get('/api/eventos?cpf=12345678900').set('X-Admin-Token', admin).expect(400);
  expect(listar).not.toHaveBeenCalled();
});

test('sessão de cidadão não autoriza histórico administrativo', async () => {
  const app = createApp(dir, secret, admin);
  const chip = (await emitir(app).expect(201)).body;
  const sessao = (await loginCompleto(app, chip, pessoa.cpf)).body;
  await request(app).get('/api/eventos').set('Authorization', `Bearer ${sessao.token}`).expect(401);
  await request(app).get('/api/eventos').set('X-Admin-Token', sessao.token).expect(401);
});

test('histórico registra só transições reais, preserva nome da emissão e desempata pela gravação', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-01T12:34:56.789Z'));
  const app = createApp(dir, secret, admin);
  const primeiro = (await emitir(app).expect(201)).body;
  await bloquear(app, primeiro.emissaoId).expect(200);
  await bloquear(app, primeiro.emissaoId).expect(200);
  const segundo = (await emitir(app, 'Maria Nome Atualizado').expect(201)).body;
  await bloquear(app, primeiro.emissaoId).expect(200);
  const terceiro = (await emitir(app, 'Maria Nome Atualizado').expect(201)).body;
  const lista: EventoAdministrativo[] = (await eventos(app).expect(200)).body;
  expect(lista.map(item => [item.emissaoId, item.tipo])).toEqual([
    [terceiro.emissaoId, 'emissao'], [segundo.emissaoId, 'substituicao'], [segundo.emissaoId, 'emissao'],
    [primeiro.emissaoId, 'substituicao'], [primeiro.emissaoId, 'bloqueio'], [primeiro.emissaoId, 'emissao']
  ]);
  expect(new Set(lista.map(item => item.id)).size).toBe(lista.length);
  for (const item of lista) {
    expect(eventoAdministrativoSchema.safeParse(item).success).toBe(true);
    expect(Object.keys(item).sort()).toEqual(['cpf', 'emissaoId', 'id', 'motivo', 'nome', 'ocorridoEm', 'tipo']);
    expect(item.ocorridoEm).toBe('2026-10-01T12:34:56.789Z');
    expect(item.motivo).toBe(motivosEvento[item.tipo]);
    expect(item.nome).toBe(item.emissaoId === primeiro.emissaoId ? pessoa.nome : 'Maria Nome Atualizado');
  }
  const texto = JSON.stringify(lista);
  for (const privado of [PIN_TESTE, admin, secret, primeiro.assinatura_digital_orgao, 'rosto_hash', 'credencialDispositivo', 'operador']) expect(texto).not.toContain(privado);
  expect((await eventos(createApp(dir, secret, admin)).expect(200)).body).toEqual(lista);
});

test('tentativas inválidas e cartão inexistente não criam eventos', async () => {
  const app = createApp(dir, secret, admin);
  await request(app).post('/api/emissao').set('X-Admin-Token', admin).send({...coletaTeste, ...pessoa, pin: '123'}).expect(400);
  await bloquear(app, randomUUID()).expect(404);
  expect((await eventos(app).expect(200)).body).toEqual([]);
});

test('consulta aguarda repositório assíncrono e sanitiza falha sem expor detalhes', async () => {
  const base = new JsonUsuariosRepository(file);
  base.salvar(chipTeste());
  const listarEventos = jest.fn(async () => base.listarEventos());
  const repo: UsuariosRepository = {listarEventos, listar: () => base.listar(), buscar: cpf => base.buscar(cpf),
    buscarEmissao: id => base.buscarEmissao(id), salvar: chip => base.salvar(chip), bloquear: id => base.bloquear(id)};
  const app = createApp(dir, secret, admin, {repo});
  expect((await eventos(app).expect(200)).body).toEqual(base.listarEventos());
  listarEventos.mockRejectedValueOnce(new Error('SQL senha-ficticia-privada'));
  const erro = (await eventos(app).expect(500)).body;
  expect(Object.keys(erro).sort()).toEqual(['mensagem', 'requestId']);
  expect(JSON.stringify(erro)).not.toMatch(/SQL|senha-ficticia/);
});

test('JSON v2 anterior permanece intacto sem inventar histórico e aceita novas transições', () => {
  const anterior = chipTeste();
  const original = JSON.stringify({versao: 2, cartoes: [{chip: anterior, estado: 'ativo'}], legados: []});
  fs.writeFileSync(file, original);
  const repo = new JsonUsuariosRepository(file);
  expect(repo.listarEventos()).toEqual([]);
  expect(fs.readFileSync(file, 'utf8')).toBe(original);
  repo.bloquear(anterior.emissaoId);
  expect(repo.listarEventos().map(item => item.tipo)).toEqual(['bloqueio']);
  const novo = chipTeste(); repo.salvar(novo);
  expect(repo.listarEventos().map(item => [item.emissaoId, item.tipo])).toEqual([
    [novo.emissaoId, 'emissao'], [anterior.emissaoId, 'substituicao'], [anterior.emissaoId, 'bloqueio']
  ]);
  expect(new JsonUsuariosRepository(file).listarEventos()).toEqual(repo.listarEventos());
});

test('reemissão registra cada cartão que mudou de estado e ignora os já substituídos', () => {
  const antigos = [chipTeste(), chipTeste(), chipTeste()];
  fs.writeFileSync(file, JSON.stringify({versao: 2, legados: [], cartoes: antigos.map((chip, i) => ({chip, estado: i === 2 ? 'substituido' : 'bloqueado'}))}));
  const repo = new JsonUsuariosRepository(file), novo = chipTeste();
  repo.salvar(novo);
  expect(repo.listarEventos().map(item => [item.emissaoId, item.tipo])).toEqual([
    [novo.emissaoId, 'emissao'], [antigos[1].emissaoId, 'substituicao'], [antigos[0].emissaoId, 'substituicao']
  ]);
});

test.each(['salvar', 'bloquear'] as const)('falha de gravação JSON em %s preserva estado e eventos em memória e disco', operacao => {
  const repo = new JsonUsuariosRepository(file), anterior = chipTeste(); repo.salvar(anterior);
  const eventosAntes = repo.listarEventos(), bytesAntes = fs.readFileSync(file, 'utf8');
  jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => {throw new Error('Falha artificial ao confirmar arquivo');});
  expect(() => operacao === 'salvar' ? repo.salvar(chipTeste()) : repo.bloquear(anterior.emissaoId)).toThrow('Falha artificial');
  expect(repo.buscarEmissao(anterior.emissaoId)?.estado).toBe('ativo');
  expect(repo.listarEventos()).toEqual(eventosAntes);
  expect(fs.readFileSync(file, 'utf8')).toBe(bytesAntes);
  expect(new JsonUsuariosRepository(file).listarEventos()).toEqual(eventosAntes);
  repo.bloquear(anterior.emissaoId);
  expect(repo.listarEventos()).toHaveLength(2);
});

test('JSON lista por data e usa ordem persistida no empate, sem expor referências mutáveis', () => {
  const agora = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-01T00:00:00.000Z'));
  const repo = new JsonUsuariosRepository(file), primeiro = chipTeste(); repo.salvar(primeiro);
  agora.mockReturnValue(Date.parse('2026-09-01T00:00:00.000Z'));
  repo.bloquear(primeiro.emissaoId);
  const eventos = repo.listarEventos();
  expect(eventos.map(item => item.tipo)).toEqual(['emissao', 'bloqueio']);
  eventos[0].nome = 'Mutação externa'; eventos.pop();
  expect(repo.listarEventos()).toEqual(new JsonUsuariosRepository(file).listarEventos());
  expect(repo.listarEventos()[0].nome).toBe(pessoa.nome);
});

test.each(['referencia', 'cpf', 'motivo', 'data', 'duplicado', 'campo-privado'])('JSON recusa histórico inconsistente: %s, sem alterar origem', caso => {
  const chip = chipTeste(), evento = novoEvento(chip, 'emissao', '2026-10-01T00:00:00.000Z');
  const registros: unknown[] = [evento];
  if (caso === 'referencia') evento.emissaoId = randomUUID();
  if (caso === 'cpf') evento.cpf = '00000000000';
  if (caso === 'motivo') evento.motivo = 'PIN informado pelo cliente';
  if (caso === 'data') evento.ocorridoEm = '2026-10-01T00:00:00Z';
  if (caso === 'duplicado') registros.push({...evento, id: randomUUID()});
  if (caso === 'campo-privado') registros[0] = {...evento, pin: PIN_TESTE};
  const original = JSON.stringify({versao: 2, cartoes: [{chip, estado: 'ativo'}], legados: [], eventos: registros});
  fs.writeFileSync(file, original);
  expect(() => new JsonUsuariosRepository(file)).toThrow();
  expect(fs.readFileSync(file, 'utf8')).toBe(original);
});

test('migração rejeita evento inconsistente antes de conectar ao destino e preserva origem', async () => {
  const chip = chipTeste(), evento = novoEvento(chip, 'emissao', '2026-10-01T00:00:00.000Z');
  const original = JSON.stringify({versao: 2, cartoes: [{chip, estado: 'ativo'}], legados: [], eventos: [{...evento, emissaoId: randomUUID()}]});
  fs.writeFileSync(file, original);
  const getConnection = jest.fn();
  await expect(migrarJson(file, {getConnection} as unknown as Pool)).rejects.toMatchObject({code: 'FACILID_MIGRATION_INVALID'});
  expect(getConnection).not.toHaveBeenCalled();
  expect(fs.readFileSync(file, 'utf8')).toBe(original);
});
