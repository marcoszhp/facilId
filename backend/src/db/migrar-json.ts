import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { chipSchema } from '../schemas/payload';
import { arquivoSchema, registroCartaoSchema } from '../repositories/usuarios.repository';
import { carregarRegistrosMySql, inserirRegistroMySql } from '../repositories/mysql-usuarios.repository';

const legadoSchema = chipSchema.omit({versao: true, emissaoId: true});
type CodigoMigracao = 'FACILID_MIGRATION_INVALID' | 'FACILID_MIGRATION_CONFLICT';
export class ErroMigracao extends Error {
  constructor(public readonly code: CodigoMigracao, mensagem: string) {super(mensagem); this.name = 'ErroMigracao';}
}
export type ResultadoMigracao = {cartoesImportados: number; legadosImportados: number; jaAplicada: boolean};
const hash = (valor: Buffer | string) => createHash('sha256').update(valor).digest('hex');
const conflito = () => new ErroMigracao('FACILID_MIGRATION_CONFLICT', 'O MySQL possui dados diferentes da origem. A migração foi cancelada sem sobrescrever o banco.');

/** Importação explícita. Não abre o repositório JSON, pois seu construtor migra arquivos v1. */
export async function migrarJson(file: string, pool: Pool): Promise<ResultadoMigracao> {
  const original = await readFile(file);
  let arquivo: z.infer<typeof arquivoSchema>;
  try {
    const dados: unknown = JSON.parse(original.toString('utf8').replace(/^\uFEFF/, ''));
    arquivo = Array.isArray(dados)
      ? {versao: 2, cartoes: [], legados: legadoSchema.array().parse(dados)}
      : arquivoSchema.parse(dados);
    const ids = new Set<string>(), ativos = new Set<string>();
    for (const registro of arquivo.cartoes) {
      if (ids.has(registro.chip.emissaoId)) throw new Error();
      ids.add(registro.chip.emissaoId);
      if (registro.estado === 'ativo') {
        if (ativos.has(registro.chip.cpf)) throw new Error();
        ativos.add(registro.chip.cpf);
      }
    }
  } catch {
    throw new ErroMigracao('FACILID_MIGRATION_INVALID', 'O arquivo de usuários não é um JSON v1/v2 válido ou tem emissões inconsistentes. A origem permanece intacta.');
  }

  const registros = new Map(arquivo.cartoes.map(registro => [registro.chip.emissaoId, registro]));
  const ocorrencias = new Map<string, number>();
  const legados = new Map<string, {cpf: string; identidade: string}>();
  for (const legado of arquivo.legados) {
    const identidade = JSON.stringify(legado), numero = ocorrencias.get(identidade) || 0;
    ocorrencias.set(identidade, numero + 1);
    // A ocorrência preserva registros idênticos repetidos na origem, sem duplicá-los na reexecução.
    legados.set(hash(identidade + '\0' + numero), {cpf: legado.cpf, identidade});
  }

  const conexao = await pool.getConnection();
  let lock: string | undefined;
  try {
    const [bancos] = await conexao.query<RowDataPacket[]>('SELECT DATABASE() AS banco');
    if (typeof bancos[0]?.banco !== 'string') throw new ErroMigracao('FACILID_MIGRATION_INVALID', 'Selecione o banco de destino antes da migração.');
    lock = 'facilid_migracao_' + hash(bancos[0].banco).slice(0, 32);
    const [bloqueio] = await conexao.execute<RowDataPacket[]>('SELECT GET_LOCK(?, 10) AS adquirido', [lock]);
    if (bloqueio[0]?.adquirido !== 1) throw new ErroMigracao('FACILID_MIGRATION_CONFLICT', 'Outra migração está em andamento. Aguarde e tente novamente com a API parada.');

    await conexao.beginTransaction();
    // A API deve ficar parada durante a migração. Os bloqueios também serializam gravações
    // concorrentes nas tabelas consultadas; nenhuma DDL ou alteração da origem é executada aqui.
    await conexao.query('SELECT cpf FROM facilid_pessoas FOR UPDATE');
    const existentes = await carregarRegistrosMySql(conexao, true);
    const idsExistentes = new Set(existentes.map(registro => registro.chip.emissaoId));
    for (const existente of existentes) {
      const origem = registros.get(existente.chip.emissaoId);
      if (!origem || JSON.stringify(registroCartaoSchema.parse(existente)) !== JSON.stringify(origem)) throw conflito();
    }
    const [legadosExistentes] = await conexao.query<RowDataPacket[]>(
      'SELECT conteudo_hash, cpf, identidade_json FROM facilid_legados FOR UPDATE'
    );
    const hashesExistentes = new Set<string>();
    for (const existente of legadosExistentes) {
      const origem = legados.get(existente.conteudo_hash);
      let identidade: string;
      try {identidade = JSON.stringify(legadoSchema.parse(JSON.parse(existente.identidade_json)));} catch {throw conflito();}
      if (!origem || origem.cpf !== existente.cpf || origem.identidade !== identidade) throw conflito();
      hashesExistentes.add(existente.conteudo_hash);
    }
    const fonteHash = hash(original);
    const [anteriores] = await conexao.execute<RowDataPacket[]>(
      'SELECT fonte_hash FROM facilid_migracoes WHERE fonte_hash = ? FOR UPDATE', [fonteHash]
    );
    // Histórico sem seus registros indica exclusão/edição posterior. Não recriar credenciais.
    if (anteriores.length && (existentes.length !== arquivo.cartoes.length || legadosExistentes.length !== legados.size)) throw conflito();

    let cartoesImportados = 0, legadosImportados = 0;
    for (const registro of arquivo.cartoes) {
      if (idsExistentes.has(registro.chip.emissaoId)) continue;
      await conexao.execute('INSERT IGNORE INTO facilid_pessoas (cpf) VALUES (?)', [registro.chip.cpf]);
      await inserirRegistroMySql(conexao, registro);
      cartoesImportados++;
    }
    for (const [id, legado] of legados) {
      if (hashesExistentes.has(id)) continue;
      await conexao.execute('INSERT INTO facilid_legados (conteudo_hash, cpf, identidade_json) VALUES (?, ?, ?)', [id, legado.cpf, legado.identidade]);
      legadosImportados++;
    }
    if (!anteriores.length) await conexao.execute(
      'INSERT INTO facilid_migracoes (fonte_hash, cartoes_importados, legados_importados) VALUES (?, ?, ?)',
      [fonteHash, cartoesImportados, legadosImportados]
    );
    await conexao.commit();
    return {cartoesImportados, legadosImportados, jaAplicada: anteriores.length > 0};
  } catch (erro) {
    await conexao.rollback().catch(() => {});
    throw erro;
  } finally {
    if (lock) await conexao.execute('SELECT RELEASE_LOCK(?)', [lock]).catch(() => {});
    conexao.release();
  }
}
