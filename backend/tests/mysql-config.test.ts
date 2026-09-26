import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createConnection, createPool, Pool } from 'mysql2/promise';
import { criarBanco, criarPoolMySql, lerConfigMySql, MYSQL_SCHEMA, prepararSchema, validarSchema } from '../src/db/mysql';
import { mensagemBanco } from '../src/config';

jest.mock('mysql2/promise', () => ({createConnection: jest.fn(), createPool: jest.fn()}));
const connectionMock = createConnection as jest.MockedFunction<typeof createConnection>;
const poolMock = createPool as jest.MockedFunction<typeof createPool>;
beforeEach(() => {jest.resetAllMocks();});

test('configuração padrão aponta para o MySQL local do FácilID sem ler arquivos privados', () => {
  expect(lerConfigMySql({})).toEqual({host: '127.0.0.1', port: 3306, database: 'facilid', user: 'root', password: ''});
});

test('configuração explícita preserva host, porta, banco e credenciais fornecidos', () => {
  const env = {DB_HOST:'localhost', DB_PORT:'3307', DB_NAME:'facilid_teste_2', DB_USER:'usuario_teste', DB_PASSWORD:'senha-ficticia-apenas-teste'};
  const config = lerConfigMySql(env);
  expect(config.host).toBe(env.DB_HOST); expect(config.port).toBe(3307);
  expect(config.database).toBe(env.DB_NAME); expect(config.user).toBe(env.DB_USER); expect(config.password).toBe(env.DB_PASSWORD);
});

test.each(['banco;DROP DATABASE outro', 'nome`injetado', '../facilid', 'facil-id', '9facilid', 'a'.repeat(65), 'banco com espaço'])('nome de banco inválido é recusado antes de conectar: caso %#', async database => {
  expect(() => lerConfigMySql({DB_NAME: database})).toThrow(/DB_NAME/);
  await expect(criarBanco({...lerConfigMySql({}), database})).rejects.toThrow(/DB_NAME/);
  expect(connectionMock).not.toHaveBeenCalled();
});

test.each(['0', '-1', '65536', '3306.5', 'abc', 'Infinity'])('porta inválida é recusada: caso %#', port => {
  expect(() => lerConfigMySql({DB_PORT: port})).toThrow(/DB_PORT/);
});

test.each([{DB_HOST:'   '}, {DB_USER:'   '}])('host ou usuário somente com espaços é recusado: caso %#', env => {
  expect(() => lerConfigMySql(env)).toThrow(/DB_HOST e DB_USER/);
});

test('pool limita conexões e filas, desativa múltiplas instruções e não cria o banco', () => {
  const pool = {} as Pool; poolMock.mockReturnValue(pool);
  expect(criarPoolMySql(lerConfigMySql({}))).toBe(pool);
  expect(poolMock).toHaveBeenCalledWith(expect.objectContaining({
    database:'facilid', multipleStatements:false, connectionLimit:5, queueLimit:100, waitForConnections:true
  }));
  expect(connectionMock).not.toHaveBeenCalled();
});

test('criação explícita usa somente nome validado e encerra a conexão', async () => {
  const query = jest.fn().mockResolvedValue([[],[]]), end = jest.fn().mockResolvedValue(undefined);
  connectionMock.mockResolvedValue({query,end} as never);
  await criarBanco(lerConfigMySql({DB_NAME:'facilid_unit_test'}));
  expect(connectionMock).toHaveBeenCalledWith(expect.not.objectContaining({database:expect.anything()}));
  expect(query).toHaveBeenCalledWith('CREATE DATABASE IF NOT EXISTS `facilid_unit_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  expect(end).toHaveBeenCalledTimes(1);
});

test('falha ao criar banco fecha conexão e propaga erro sem usar outro armazenamento', async () => {
  const erro = new Error('Falha controlada do driver para o teste.');
  const query = jest.fn().mockRejectedValue(erro), end = jest.fn().mockResolvedValue(undefined);
  connectionMock.mockResolvedValue({query,end} as never);
  await expect(criarBanco(lerConfigMySql({}))).rejects.toBe(erro);
  expect(end).toHaveBeenCalledTimes(1); expect(poolMock).not.toHaveBeenCalled();
});

test('SQL para importação manual coincide com o esquema usado no código compilado', () => {
  const texto = readFileSync(path.join(__dirname,'../src/db/schema-mysql.sql'),'utf8');
  const normalizar = (sql: string) => sql.replace(/--[^\r\n]*/g,'').replace(/\s+/g,' ').trim();
  const externo = texto.split(';').map(normalizar).filter(Boolean);
  expect(externo).toEqual(MYSQL_SCHEMA.map(normalizar));
  expect(externo).toHaveLength(4);
  for (const sql of externo) {
    expect(sql).toMatch(/^CREATE TABLE IF NOT EXISTS facilid_/);
    expect(sql).toContain('ENGINE=InnoDB'); expect(sql).toContain('CHARSET=utf8mb4');
  }
});

test('preparo de tabelas não cria ou escolhe outro banco e falha interrompe o preparo', async () => {
  const query = jest.fn().mockResolvedValue([[],[]]);
  await prepararSchema({query} as unknown as Pool);
  expect(query.mock.calls.map(([sql])=>sql)).toEqual(MYSQL_SCHEMA);
  query.mockReset().mockRejectedValueOnce(new Error('Falha controlada de preparo.'));
  await expect(prepararSchema({query} as unknown as Pool)).rejects.toThrow('Falha controlada');
  expect(query).toHaveBeenCalledTimes(1);
});

test('verificação de prontidão não precisa DDL nem lê registros pessoais', async () => {
  const query = jest.fn().mockResolvedValue([[],[]]);
  await validarSchema({query} as unknown as Pool);
  expect(query).toHaveBeenCalledTimes(4);
  for (const [sql] of query.mock.calls) expect(sql).toMatch(/^SELECT .+ FROM facilid_[a-z]+ LIMIT 0$/);
  query.mockRejectedValueOnce(new Error('Esquema ausente.'));
  await expect(validarSchema({query} as unknown as Pool)).rejects.toThrow('Esquema ausente.');
});

test.each([
  ['ECONNREFUSED', 'Inicie MySQL'], ['ER_ACCESS_DENIED_ERROR', 'DB_USER e DB_PASSWORD'],
  ['ER_BAD_DB_ERROR', 'db:setup'], ['ER_NO_SUCH_TABLE', 'db:setup'], ['ER_UNKNOWN_TEST', 'db:check']
])('diagnóstico %s não expõe erro, SQL ou credenciais do driver', (code, orientacao) => {
  const detalhe = 'conteudo-privado-ficticio-do-teste';
  const resultado = mensagemBanco({code,message:detalhe,sql:detalhe,password:detalhe,host:detalhe,stack:detalhe});
  expect(resultado).toContain(orientacao); expect(resultado).not.toContain(detalhe); expect(resultado).not.toContain(code);
});

test.each([null, undefined, 'erro-bruto-ficticio', 123, new Error('erro-bruto-ficticio')])('erro desconhecido usa mensagem genérica sem imprimir seu conteúdo: caso %#', erro => {
  expect(mensagemBanco(erro)).toBe('Não foi possível preparar o armazenamento. Confira backend/.env, a disponibilidade do banco e execute npm run db:check.');
});
