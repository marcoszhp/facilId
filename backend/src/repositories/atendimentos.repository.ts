import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { Atendimento, atendimentoSchema, AtualizacaoAtendimento } from '../schemas/atendimento';
import { conferirTransicao, ErroAtendimento } from '../services/atendimento.service';
import { Awaitable } from './usuarios.repository';

export interface AtendimentosRepository {
  listar(cpf?: string): Awaitable<Atendimento[]>;
  horariosOcupados(inicio: string, fim: string): Awaitable<string[]>;
  reservar(atendimento: Atendimento): Awaitable<Atendimento>;
  atualizarStatus(id: string, status: AtualizacaoAtendimento): Awaitable<Atendimento | undefined>;
}
const arquivoSchema = z.object({versao: z.literal(1), atendimentos: atendimentoSchema.array()}).strict().superRefine((arquivo, contexto) => {
  for (const campo of ['id', 'protocolo', 'horario'] as const) {
    if (new Set(arquivo.atendimentos.map(item => item[campo])).size !== arquivo.atendimentos.length) {
      contexto.addIssue({code: z.ZodIssueCode.custom, message: `Atendimentos com ${campo} duplicado.`});
    }
  }
});
type Arquivo = z.infer<typeof arquivoSchema>;

// Uma instância por processo, como o adaptador de cartões. Nenhum await entre
// conferir exclusividade e gravar: reservas concorrentes no processo são serializadas.
export class JsonAtendimentosRepository implements AtendimentosRepository {
  private dados: Arquivo;
  constructor(private file: string) {
    mkdirSync(path.dirname(file), {recursive: true});
    this.dados = existsSync(file) ? arquivoSchema.parse(JSON.parse(readFileSync(file, 'utf8'))) : {versao: 1, atendimentos: []};
  }
  listar(cpf?: string): Atendimento[] {
    return structuredClone(this.dados.atendimentos.filter(item => cpf === undefined || item.cpf === cpf)
      .sort((a, b) => a.horario.localeCompare(b.horario)));
  }
  horariosOcupados(inicio: string, fim: string): string[] {
    return this.dados.atendimentos.filter(item => item.horario >= inicio && item.horario <= fim).map(item => item.horario);
  }
  reservar(atendimento: Atendimento): Atendimento {
    const novo = atendimentoSchema.parse(atendimento);
    if (this.dados.atendimentos.some(item => item.horario === novo.horario)) throw new ErroAtendimento(409, 'Este horário acabou de ser reservado. Escolha outro horário.');
    if (this.dados.atendimentos.some(item => item.id === novo.id || item.protocolo === novo.protocolo)) throw new ErroAtendimento(409, 'Não foi possível gerar um protocolo exclusivo. Tente novamente.');
    this.persistir({versao: 1, atendimentos: [...this.dados.atendimentos, novo]});
    return structuredClone(novo);
  }
  atualizarStatus(id: string, status: AtualizacaoAtendimento): Atendimento | undefined {
    const next = structuredClone(this.dados), atendimento = next.atendimentos.find(item => item.id === id);
    if (!atendimento) return undefined;
    conferirTransicao(atendimento.status, status);
    if (atendimento.status !== status) {
      atendimento.status = status;
      atendimento.atualizadoEm = new Date(Date.now()).toISOString();
      this.persistir(next);
    }
    return structuredClone(atendimento);
  }
  private persistir(next: Arquivo): void {
    writeFileSync(this.file + '.tmp', JSON.stringify(next, null, 2), {mode: 0o600});
    renameSync(this.file + '.tmp', this.file);
    this.dados = next;
  }
}
