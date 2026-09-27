import { Pool, RowDataPacket } from 'mysql2/promise';
import { Atendimento, atendimentoSchema, AtualizacaoAtendimento } from '../schemas/atendimento';
import { conferirTransicao, ErroAtendimento } from '../services/atendimento.service';
import { AtendimentosRepository } from './atendimentos.repository';

const colunas = 'id, protocolo, cpf, nome, horario, status, criado_em, atualizado_em';
function converter(row: RowDataPacket): Atendimento {
  return atendimentoSchema.parse({id: row.id, protocolo: row.protocolo, cpf: row.cpf, nome: row.nome,
    horario: row.horario.toISOString(), status: row.status, criadoEm: row.criado_em.toISOString(), atualizadoEm: row.atualizado_em.toISOString()});
}
export class MysqlAtendimentosRepository implements AtendimentosRepository {
  constructor(private pool: Pool) {}
  async listar(cpf?: string): Promise<Atendimento[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(`SELECT ${colunas} FROM facilid_atendimentos${cpf === undefined ? '' : ' WHERE cpf = ?'} ORDER BY horario`, cpf === undefined ? [] : [cpf]);
    return rows.map(converter);
  }
  async horariosOcupados(inicio: string, fim: string): Promise<string[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>('SELECT horario FROM facilid_atendimentos WHERE horario >= ? AND horario <= ?', [new Date(inicio), new Date(fim)]);
    return rows.map(row => row.horario.toISOString());
  }
  async reservar(atendimento: Atendimento): Promise<Atendimento> {
    const novo = atendimentoSchema.parse(atendimento);
    try {
      // UNIQUE(horario) é a decisão atômica; não há consulta prévia vulnerável a corrida.
      await this.pool.execute(`INSERT INTO facilid_atendimentos (${colunas}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
        novo.id, novo.protocolo, novo.cpf, novo.nome, new Date(novo.horario), novo.status, new Date(novo.criadoEm), new Date(novo.atualizadoEm)
      ]);
    } catch (error) {
      if ((error as {code?: string}).code === 'ER_DUP_ENTRY') {
        const ocupados = await this.horariosOcupados(novo.horario, novo.horario);
        throw new ErroAtendimento(409, ocupados.length ? 'Este horário acabou de ser reservado. Escolha outro horário.' : 'Não foi possível gerar um protocolo exclusivo. Tente novamente.');
      }
      throw error;
    }
    return novo;
  }
  async atualizarStatus(id: string, status: AtualizacaoAtendimento): Promise<Atendimento | undefined> {
    const conexao = await this.pool.getConnection();
    try {
      await conexao.beginTransaction();
      const [rows] = await conexao.execute<RowDataPacket[]>(`SELECT ${colunas} FROM facilid_atendimentos WHERE id = ? FOR UPDATE`, [id]);
      if (!rows[0]) {await conexao.commit(); return undefined;}
      const atendimento = converter(rows[0]);
      conferirTransicao(atendimento.status, status);
      if (atendimento.status !== status) {
        atendimento.status = status;
        atendimento.atualizadoEm = new Date(Date.now()).toISOString();
        await conexao.execute('UPDATE facilid_atendimentos SET status = ?, atualizado_em = ? WHERE id = ?', [status, new Date(atendimento.atualizadoEm), id]);
      }
      await conexao.commit();
      return atendimento;
    } catch (error) {
      await conexao.rollback().catch(() => {});
      throw error;
    } finally {conexao.release();}
  }
}
