import { createConnection, createPool, Pool } from 'mysql2/promise';

export type MySqlConfig = {host: string; port: number; database: string; user: string; password: string};

function validarConfig(config: MySqlConfig) {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(config.database)) throw new Error('DB_NAME deve ter até 64 letras, números ou sublinhado, começando por letra.');
  if (!config.host.trim() || !config.user.trim()) throw new Error('DB_HOST e DB_USER são obrigatórios.');
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error('DB_PORT deve ser uma porta de 1 a 65535.');
  return config;
}

export function lerConfigMySql(env: NodeJS.ProcessEnv = process.env): MySqlConfig {
  return validarConfig({
    host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || '3306'),
    database: env.DB_NAME || 'facilid', user: env.DB_USER || 'root', password: env.DB_PASSWORD ?? ''
  });
}

function opcoes(config: MySqlConfig) {
  validarConfig(config);
  return {host: config.host, port: config.port, user: config.user, password: config.password,
    charset: 'utf8mb4', timezone: 'Z', connectTimeout: 10000, multipleStatements: false,
    supportBigNumbers: true, bigNumberStrings: true};
}

export function criarPoolMySql(config: MySqlConfig): Pool {
  return createPool({...opcoes(config), database: config.database, waitForConnections: true,
    connectionLimit: 5, queueLimit: 100, enableKeepAlive: true});
}

// Apenas o comando explícito de preparo chama esta função; servidor não cria banco.
export async function criarBanco(config: MySqlConfig): Promise<void> {
  const connection = await createConnection(opcoes(config));
  try {
    // Identificadores não aceitam placeholders; o nome passou pela lista estrita acima.
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {await connection.end();}
}

// Espelho legível em schema-mysql.sql; um teste impede divergência entre os dois.
// Mantido aqui para que dist/ funcione sem copiar arquivos de fonte durante o build.
export const MYSQL_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS facilid_pessoas (
    cpf CHAR(11) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    PRIMARY KEY (cpf)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS facilid_cartoes (
    emissao_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    cpf CHAR(11) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    nome VARCHAR(100) NOT NULL,
    idade TINYINT UNSIGNED NOT NULL,
    versao TINYINT UNSIGNED NOT NULL,
    rosto_hash VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    digital_template VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    assinatura_svg VARCHAR(300) COLLATE utf8mb4_bin NOT NULL,
    assinatura_digital_orgao VARCHAR(1024) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    estado ENUM('ativo','bloqueado','substituido') NOT NULL,
    ordem BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    cpf_ativo CHAR(11) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (CASE WHEN estado = 'ativo' THEN cpf ELSE NULL END) STORED,
    PRIMARY KEY (emissao_id),
    UNIQUE KEY facilid_ordem (ordem),
    UNIQUE KEY facilid_um_cartao_ativo (cpf_ativo),
    KEY facilid_cartoes_cpf (cpf),
    CONSTRAINT facilid_cartoes_pessoa FOREIGN KEY (cpf) REFERENCES facilid_pessoas(cpf),
    CONSTRAINT facilid_idade_valida CHECK (idade <= 130),
    CONSTRAINT facilid_versao_valida CHECK (versao = 2)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS facilid_legados (
    conteudo_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    cpf CHAR(11) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    identidade_json LONGTEXT COLLATE utf8mb4_bin NOT NULL,
    PRIMARY KEY (conteudo_hash),
    KEY facilid_legados_cpf (cpf),
    CONSTRAINT facilid_legado_json_valido CHECK (JSON_VALID(identidade_json))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS facilid_migracoes (
    fonte_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    cartoes_importados INT UNSIGNED NOT NULL,
    legados_importados INT UNSIGNED NOT NULL,
    aplicada_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (fonte_hash)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

export async function prepararSchema(pool: Pool): Promise<void> {
  for (const sql of MYSQL_SCHEMA) await pool.query(sql);
}

// Verifica contrato sem ler registros e sem exigir privilégio CREATE no servidor.
export async function validarSchema(pool: Pool): Promise<void> {
  await pool.query('SELECT cpf FROM facilid_pessoas LIMIT 0');
  await pool.query('SELECT emissao_id, cpf, nome, idade, versao, rosto_hash, digital_template, assinatura_svg, assinatura_digital_orgao, estado, ordem, cpf_ativo, criado_em FROM facilid_cartoes LIMIT 0');
  await pool.query('SELECT conteudo_hash, cpf, identidade_json FROM facilid_legados LIMIT 0');
  await pool.query('SELECT fonte_hash, cartoes_importados, legados_importados, aplicada_em FROM facilid_migracoes LIMIT 0');
}
