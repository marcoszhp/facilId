import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { Chip, chipSchema } from '../schemas/payload';

export const registroCartaoSchema = z.object({
  chip: chipSchema,
  estado: z.enum(['ativo', 'bloqueado', 'substituido'])
}).strict();
export type RegistroCartao = z.infer<typeof registroCartaoSchema>;
export type ResumoCartao = Pick<Chip, 'emissaoId' | 'cpf' | 'nome' | 'idade'> & {estado: RegistroCartao['estado']};
const legadoSchema = chipSchema.omit({versao: true, emissaoId: true});
export const arquivoSchema = z.object({
  versao: z.literal(2), cartoes: registroCartaoSchema.array(), legados: legadoSchema.array()
}).strict();
export type Arquivo = z.infer<typeof arquivoSchema>;

export type Awaitable<T> = T | Promise<T>;

// Mantém compatibilidade com o JSON local e com repositórios de banco assíncronos.
export interface UsuariosRepository {
  listar(): Awaitable<ResumoCartao[]>;
  buscar(cpf: string): Awaitable<Chip | undefined>;
  buscarEmissao(emissaoId: string): Awaitable<RegistroCartao | undefined>;
  salvar(chip: Chip): Awaitable<void>;
  bloquear(emissaoId: string): Awaitable<RegistroCartao | undefined>;
}

// Instância única por processo. Cada mutação persiste antes de trocar o estado em memória.
export class JsonUsuariosRepository implements UsuariosRepository {
  private dados: Arquivo;
  constructor(private file: string) {
    mkdirSync(path.dirname(file), {recursive: true});
    if (!existsSync(file)) {
      this.dados = {versao: 2, cartoes: [], legados: []};
      return;
    }
    const original = readFileSync(file, 'utf8');
    const parsed: unknown = JSON.parse(original);
    if (Array.isArray(parsed)) {
      // Sem ID de emissão, cartões v1 precisam ser reemitidos por um responsável.
      const legados = legadoSchema.array().parse(parsed);
      const backup = file + '.legado-v1.json';
      if (!existsSync(backup)) writeFileSync(backup, original, {mode: 0o600, flag: 'wx'});
      else if (readFileSync(backup, 'utf8') !== original) throw new Error('Backup legado já existe com conteúdo diferente. Migração interrompida.');
      this.dados = {versao: 2, cartoes: [], legados};
      this.persistir(this.dados);
    } else {
      this.dados = arquivoSchema.parse(parsed);
    }
  }
  listar(): ResumoCartao[] {
    return this.dados.cartoes.map(({chip, estado}) => ({
      emissaoId: chip.emissaoId, cpf: chip.cpf, nome: chip.nome, idade: chip.idade, estado
    }));
  }
  buscar(cpf: string) {
    const registro = this.dados.cartoes.find(r => r.estado === 'ativo' && r.chip.cpf === cpf);
    return registro ? structuredClone(registro.chip) : undefined;
  }
  buscarEmissao(emissaoId: string) {
    const registro = this.dados.cartoes.find(r => r.chip.emissaoId === emissaoId);
    return registro ? structuredClone(registro) : undefined;
  }
  salvar(chip: Chip) {
    const validado = chipSchema.parse(chip);
    if (this.buscarEmissao(validado.emissaoId)) throw new Error('Identificador de emissão já utilizado.');
    const next = structuredClone(this.dados);
    for (const registro of next.cartoes) {
      if (registro.chip.cpf === validado.cpf) registro.estado = 'substituido';
    }
    next.cartoes.push({chip: validado, estado: 'ativo'});
    this.persistir(next);
  }
  bloquear(emissaoId: string) {
    const next = structuredClone(this.dados);
    const registro = next.cartoes.find(r => r.chip.emissaoId === emissaoId);
    if (!registro) return undefined;
    if (registro.estado === 'ativo') {
      registro.estado = 'bloqueado';
      this.persistir(next);
    }
    return structuredClone(registro);
  }
  private persistir(next: Arquivo) {
    writeFileSync(this.file + '.tmp', JSON.stringify(next, null, 2), {mode: 0o600});
    renameSync(this.file + '.tmp', this.file);
    this.dados = next;
  }
}
