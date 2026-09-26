import { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { cadastroSchema, Chip, chipSchema } from '../schemas/payload';
import { RegistroCartao, registroCartaoSchema, ResumoCartao, UsuariosRepository } from './usuarios.repository';

const colunas = 'emissao_id, cpf, nome, idade, versao, rosto_hash, digital_template, assinatura_svg, assinatura_digital_orgao, estado';
const resumoSchema = cadastroSchema.extend({emissaoId: chipSchema.shape.emissaoId, estado: registroCartaoSchema.shape.estado});
function converter(row: RowDataPacket): RegistroCartao {
  return registroCartaoSchema.parse({estado: row.estado, chip: {
    emissaoId: row.emissao_id, cpf: row.cpf, nome: row.nome, idade: Number(row.idade), versao: Number(row.versao),
    rosto_hash: row.rosto_hash, digital_template: row.digital_template, assinatura_svg: row.assinatura_svg,
    assinatura_digital_orgao: row.assinatura_digital_orgao
  }});
}

// Helpers usados pela migração dentro da mesma conexão/transação, sem reemitir ou reassinar.
export async function carregarRegistrosMySql(conexao: Pool | PoolConnection, bloquear = false): Promise<RegistroCartao[]> {
  const [rows] = await conexao.execute<RowDataPacket[]>(`SELECT ${colunas} FROM facilid_cartoes ORDER BY ordem${bloquear ? ' FOR UPDATE' : ''}`);
  return rows.map(converter);
}

export async function inserirRegistroMySql(conexao: Pool | PoolConnection, registro: RegistroCartao): Promise<void> {
  const {chip, estado} = registroCartaoSchema.parse(registro);
  await conexao.execute(`INSERT INTO facilid_cartoes (${colunas}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    chip.emissaoId, chip.cpf, chip.nome, chip.idade, chip.versao, chip.rosto_hash,
    chip.digital_template, chip.assinatura_svg, chip.assinatura_digital_orgao, estado
  ]);
}

export class MysqlUsuariosRepository implements UsuariosRepository {
  constructor(private pool: Pool) {}

  async listar(): Promise<ResumoCartao[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>('SELECT emissao_id, cpf, nome, idade, estado FROM facilid_cartoes ORDER BY ordem');
    return rows.map(row => resumoSchema.parse({emissaoId: row.emissao_id, cpf: row.cpf, nome: row.nome, idade: Number(row.idade), estado: row.estado}));
  }

  async buscar(cpf: string): Promise<Chip | undefined> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(`SELECT ${colunas} FROM facilid_cartoes WHERE cpf = ? AND estado = 'ativo' LIMIT 1`, [cpf]);
    return rows[0] ? converter(rows[0]).chip : undefined;
  }

  async buscarEmissao(emissaoId: string): Promise<RegistroCartao | undefined> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(`SELECT ${colunas} FROM facilid_cartoes WHERE emissao_id = ?`, [emissaoId]);
    return rows[0] ? converter(rows[0]) : undefined;
  }

  async salvar(chip: Chip): Promise<void> {
    const validado = chipSchema.parse(chip), conexao = await this.pool.getConnection();
    try {
      await conexao.beginTransaction();
      // Uma linha estável por CPF serializa inclusive emissões simultâneas de pessoa nova.
      // O UPSERT toma lock exclusivo também na linha existente. INSERT IGNORE
      // tomaria locks compartilhados que podem disputar a promoção para escrita.
      await conexao.execute('INSERT INTO facilid_pessoas (cpf) VALUES (?) ON DUPLICATE KEY UPDATE cpf = VALUES(cpf)', [validado.cpf]);
      await conexao.execute("UPDATE facilid_cartoes SET estado = 'substituido' WHERE cpf = ?", [validado.cpf]);
      await inserirRegistroMySql(conexao, {chip: validado, estado: 'ativo'});
      await conexao.commit();
    } catch (error) {
      await conexao.rollback().catch(() => {});
      throw error;
    } finally {conexao.release();}
  }

  async bloquear(emissaoId: string): Promise<RegistroCartao | undefined> {
    const conexao = await this.pool.getConnection();
    try {
      await conexao.beginTransaction();
      // O primeiro SELECT localiza o CPF imutável; os locks seguem a mesma ordem de salvar.
      const [identidades] = await conexao.execute<RowDataPacket[]>('SELECT cpf FROM facilid_cartoes WHERE emissao_id = ?', [emissaoId]);
      if (!identidades[0]) {await conexao.commit(); return undefined;}
      await conexao.execute('SELECT cpf FROM facilid_pessoas WHERE cpf = ? FOR UPDATE', [identidades[0].cpf]);
      const [rows] = await conexao.execute<RowDataPacket[]>(`SELECT ${colunas} FROM facilid_cartoes WHERE emissao_id = ? FOR UPDATE`, [emissaoId]);
      const registro = rows[0] ? converter(rows[0]) : undefined;
      if (registro?.estado === 'ativo') {
        await conexao.execute("UPDATE facilid_cartoes SET estado = 'bloqueado' WHERE emissao_id = ? AND estado = 'ativo'", [emissaoId]);
        registro.estado = 'bloqueado';
      }
      await conexao.commit(); return registro;
    } catch (error) {
      await conexao.rollback().catch(() => {});
      throw error;
    } finally {conexao.release();}
  }
}
