import request from 'supertest';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app';
import { AtendimentosRepository, JsonAtendimentosRepository } from '../src/repositories/atendimentos.repository';
import { horariosDaGrade, novoAtendimento } from '../src/services/atendimento.service';
import { instanteSchema } from '../src/schemas/atendimento';
import { coletaTeste, loginCompleto } from './helpers';

const secret = 'segredo-ficticio-testes-atendimento-com-32-caracteres';
const admin = 'chave-ficticia-testes-atendimento-com-32-caracteres';
const pessoa = {cpf: '12345678900', nome: 'Pessoa Fictícia', idade: 72};
const outra = {cpf: '98765432100', nome: 'Outra Pessoa Fictícia', idade: 68};

describe('calendário da secretaria', () => {
  test('usa Brasília, hoje até +13 e dias úteis, excluindo horários passados', () => {
    const agora = Date.parse('2026-09-25T13:30:00.000Z'); // Sexta, 10h30 em Brasília.
    const grade = horariosDaGrade(agora);
    expect(grade.slice(0, 3)).toEqual(['2026-09-25T14:00:00.000Z', '2026-09-25T17:00:00.000Z', '2026-09-25T18:00:00.000Z']);
    expect(grade[grade.length - 1]).toBe('2026-10-08T18:00:00.000Z');
    expect(grade).toHaveLength(48);
    expect(new Set(grade).size).toBe(grade.length);
    expect(grade.every(valor => new Date(valor).getUTCDay() !== 0 && new Date(valor).getUTCDay() !== 6)).toBe(true);
    expect(horariosDaGrade(Date.parse(grade[0]))).not.toContain(grade[0]);
  });
  test('virada de data e ano usa calendário de Brasília sem TZ do host', () => {
    const tzAnterior = process.env.TZ;
    try {
      const agora = Date.parse('2027-01-01T01:00:00.000Z'); // Ainda 31/12 no Brasil.
      process.env.TZ = 'Pacific/Auckland';
      const grade = horariosDaGrade(agora);
      process.env.TZ = 'America/Los_Angeles';
      expect(horariosDaGrade(agora)).toEqual(grade);
      expect(grade[0]).toBe('2027-01-01T12:00:00.000Z');
      expect(grade[grade.length - 1]).toBe('2027-01-13T18:00:00.000Z');
    } finally {if (tzAnterior === undefined) delete process.env.TZ; else process.env.TZ = tzAnterior;}
  });
  test.each(['2026-09-28T12:00:00Z', '2026-09-28T09:00:00.000-03:00', '2026-02-30T12:00:00.000Z', '2026-09-28'])('recusa data não canônica ou inválida: %s', valor => {
    expect(instanteSchema.safeParse(valor).success).toBe(false);
  });
});

describe('atendimentos com JSON isolado', () => {
  let dir: string, app: ReturnType<typeof createApp>, token: string, emissaoId: string;
  const emitir = (dados = pessoa) => request(app).post('/api/emissao').set('X-Admin-Token', admin).send({...coletaTeste, ...dados});
  const reservar = (horario = horariosDaGrade()[0], bearer = token) => request(app).post('/api/atendimentos').set('Authorization', `Bearer ${bearer}`).send({horario});
  const meus = (bearer = token) => request(app).get('/api/atendimentos/meus').set('Authorization', `Bearer ${bearer}`);
  const atualizar = (id: string, status: string) => request(app).patch(`/api/atendimentos/${id}/status`).set('X-Admin-Token', admin).send({status});
  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(tmpdir(), 'facilid-atendimentos-'));
    app = createApp(dir, secret, admin);
    const chip = (await emitir().expect(201)).body;
    emissaoId = chip.emissaoId;
    token = (await loginCompleto(app, chip, pessoa.cpf)).body.token;
  });
  afterEach(() => {
    jest.restoreAllMocks();
    const absoluto = path.resolve(dir);
    if (path.dirname(absoluto) !== path.resolve(tmpdir()) || !path.basename(absoluto).startsWith('facilid-atendimentos-')) throw new Error('Pasta de teste inválida.');
    fs.rmSync(absoluto, {recursive: true, force: true});
  });
  test('reserva devolve protocolo, remove horário livre e persiste sem alterar usuarios.json', async () => {
    const usuarios = fs.readFileSync(path.join(dir, 'usuarios.json'), 'utf8');
    const lista = await request(app).get('/api/atendimentos/horarios').set('Authorization', `Bearer ${token}`).expect(200);
    const horario = lista.body.horarios[0];
    const atendimento = (await reservar(horario).expect(201)).body;
    expect(atendimento).toEqual({id: expect.any(String), protocolo: expect.stringMatching(/^FID-[A-F0-9]{12}$/), cpf: pessoa.cpf, nome: pessoa.nome, horario, status: 'agendado', criadoEm: expect.any(String), atualizadoEm: expect.any(String)});
    expect(atendimento.atualizadoEm).toBe(atendimento.criadoEm);
    expect((await request(app).get('/api/atendimentos/horarios').set('Authorization', `Bearer ${token}`).expect(200)).body.horarios).not.toContain(horario);
    expect(fs.readFileSync(path.join(dir, 'usuarios.json'), 'utf8')).toBe(usuarios);
    app = createApp(dir, secret, admin);
    expect((await meus().expect(200)).body).toEqual([atendimento]);
    expect((await request(app).get('/api/atendimentos').set('X-Admin-Token', admin).expect(200)).body).toEqual([atendimento]);
    await reservar(horario).expect(409);
  });
  test('consulta isola CPFs e recusa injeção de CPF no corpo e na consulta', async () => {
    const grade = horariosDaGrade();
    await reservar(grade[0]).expect(201);
    const chip = (await emitir(outra).expect(201)).body;
    const outraSessao = (await loginCompleto(app, chip, outra.cpf)).body.token;
    const segundo = (await reservar(grade[1], outraSessao).expect(201)).body;
    expect((await meus(outraSessao).expect(200)).body).toEqual([segundo]);
    expect((await meus().expect(200)).body).toEqual([expect.objectContaining({cpf: pessoa.cpf})]);
    await request(app).post('/api/atendimentos').set('Authorization', `Bearer ${token}`).send({horario: grade[2], cpf: outra.cpf}).expect(400);
    await meus().query({cpf: outra.cpf}).expect(400);
    expect((await request(app).get('/api/atendimentos').set('X-Admin-Token', admin).expect(200)).body).toHaveLength(2);
  });
  test('cartão de segunda via mantém histórico do CPF e revoga consulta da sessão anterior', async () => {
    const atendimento = (await reservar().expect(201)).body;
    const chip = (await emitir().expect(201)).body;
    await meus().expect(401);
    token = (await loginCompleto(app, chip, pessoa.cpf)).body.token;
    expect((await meus().expect(200)).body).toEqual([atendimento]);
  });
  test('sessão ausente, inválida, expirada e cartão bloqueado não consultam nem reservam', async () => {
    await request(app).get('/api/atendimentos/horarios').expect(401);
    await meus('invalido').expect(401);
    const horario = horariosDaGrade()[0];
    const agora = Date.now();
    const relogio = jest.spyOn(Date, 'now').mockReturnValue(agora + 16 * 60_000);
    await meus().expect(401);
    relogio.mockRestore();
    await request(app).post(`/api/cartoes/${emissaoId}/bloquear`).set('X-Admin-Token', admin).expect(200);
    await meus().expect(401);
    await request(app).get('/api/atendimentos/horarios').set('Authorization', `Bearer ${token}`).expect(401);
    await reservar(horario).expect(401);
    expect(fs.existsSync(path.join(dir, 'atendimentos.json'))).toBe(false);
  });
  test('JWT não concede administração e chave administrativa não concede sessão cidadã', async () => {
    const atendimento = (await reservar().expect(201)).body;
    await request(app).get('/api/atendimentos').expect(401);
    await request(app).get('/api/atendimentos').set('Authorization', `Bearer ${token}`).expect(401);
    await request(app).patch(`/api/atendimentos/${atendimento.id}/status`).set('Authorization', `Bearer ${token}`).send({status: 'confirmado'}).expect(401);
    await request(app).post('/api/atendimentos').set('X-Admin-Token', admin).send({horario: horariosDaGrade()[1]}).expect(401);
    await request(app).get('/api/atendimentos/meus').set('X-Admin-Token', admin).expect(401);
  });
  test('recusa horário passado, fora da grade e corpo com campos não permitidos', async () => {
    const horario = horariosDaGrade()[0];
    for (const dados of [{horario: '2020-01-01T12:00:00.000Z'}, {horario: new Date(Date.parse(horario) + 30 * 60_000).toISOString()}, {horario: '2099-01-01T12:00:00.000Z'}, {horario, nome: 'Pessoa manipulada'}, {horario, status: 'confirmado'}, {}]) {
      await request(app).post('/api/atendimentos').set('Authorization', `Bearer ${token}`).send(dados).expect(400);
    }
    expect((await meus().expect(200)).body).toEqual([]);
  });
  test('reservas concorrentes e repetição do POST criam só um atendimento por horário', async () => {
    const horario = horariosDaGrade()[0];
    const respostas = await Promise.all([reservar(horario), reservar(horario), reservar(horario)]);
    expect(respostas.map(item => item.status).sort()).toEqual([201, 409, 409]);
    await reservar(horario).expect(409);
    expect((await meus().expect(200)).body).toHaveLength(1);
  });
  test('status avança em etapas, repetir é idempotente e estado persiste após reinício', async () => {
    const atendimento = (await reservar().expect(201)).body;
    await atualizar(atendimento.id, 'concluido').expect(409);
    const confirmado = (await atualizar(atendimento.id, 'confirmado').expect(200)).body;
    expect(confirmado.status).toBe('confirmado');
    expect((await atualizar(atendimento.id, 'confirmado').expect(200)).body).toEqual(confirmado);
    const concluido = (await atualizar(atendimento.id, 'concluido').expect(200)).body;
    expect(concluido.status).toBe('concluido');
    expect((await atualizar(atendimento.id, 'concluido').expect(200)).body).toEqual(concluido);
    await atualizar(atendimento.id, 'confirmado').expect(409);
    await atualizar(atendimento.id, 'agendado').expect(400);
    await atualizar('nao-e-uuid', 'confirmado').expect(400);
    await atualizar(randomUUID(), 'confirmado').expect(404);
    app = createApp(dir, secret, admin);
    expect((await meus().expect(200)).body).toEqual([concluido]);
  });
  test('falha de armazenamento assíncrono é 500 sanitizado, sem invalidar sessão', async () => {
    const base = new JsonAtendimentosRepository(path.join(dir, 'atendimentos.json'));
    const repo: AtendimentosRepository = {
      listar: jest.fn().mockRejectedValueOnce(new Error('senha-e-sql-privados')).mockResolvedValue([]),
      horariosOcupados: async (inicio, fim) => base.horariosOcupados(inicio, fim),
      reservar: async item => base.reservar(item), atualizarStatus: async (id, status) => base.atualizarStatus(id, status)
    };
    app = createApp(dir, secret, admin, {atendimentosRepo: repo});
    const falha = await meus().expect(500);
    expect(falha.body.mensagem).toBe('Não foi possível concluir. Tente novamente.');
    expect(JSON.stringify(falha.body)).not.toContain('privados');
    await meus().expect(200);
    const atendimento = (await reservar().expect(201)).body;
    await atualizar(atendimento.id, 'confirmado').expect(200);
  });
  test('falha de escrita JSON preserva estado em memória e arquivo anterior', () => {
    const file = path.join(dir, 'atendimentos.json'), repo = new JsonAtendimentosRepository(file);
    const grade = horariosDaGrade();
    const original = repo.reservar(novoAtendimento(pessoa, grade[0]));
    const bytes = fs.readFileSync(file, 'utf8');
    const renomear = jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => {throw new Error('Falha simulada de disco.');});
    expect(() => repo.reservar(novoAtendimento(pessoa, grade[1]))).toThrow('Falha simulada');
    renomear.mockRestore();
    expect(repo.listar()).toEqual([original]);
    expect(fs.readFileSync(file, 'utf8')).toBe(bytes);
    expect(new JsonAtendimentosRepository(file).listar()).toEqual([original]);
    repo.reservar(novoAtendimento(pessoa, grade[1]));
    expect(repo.listar()).toHaveLength(2);
  });
});
