import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { ErroColeta, hashBytes } from '../services/coleta.service';

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const uploadSchema = z.object({hash: hashSchema, mimeType: z.enum(['image/jpeg', 'image/png']), expiraEm: z.number()}).strict();
const registroSchema = z.object({
  modo: z.enum(['real', 'demonstracao']), fotoHash: hashSchema, assinaturaHash: hashSchema,
  mimeType: z.enum(['image/jpeg', 'image/png']), coletadoEm: z.number(), consentimento: z.boolean(),
  pinSalt: z.string().regex(/^[a-f0-9]{32}$/), pinHash: hashSchema, dispositivos: z.array(hashSchema).max(5),
  falhas: z.number().int().min(0).max(5), primeiraFalhaEm: z.number(), bloqueadoAte: z.number()
}).strict();
const indiceSchema = z.object({versao: z.literal(1), uploads: z.record(z.string().uuid(), uploadSchema), emissoes: z.record(z.string().uuid(), registroSchema)}).strict();
type Indice = z.infer<typeof indiceSchema>;
type Registro = z.infer<typeof registroSchema>;
type Mime = 'image/jpeg' | 'image/png';
export type MetadadosColeta = Pick<Registro, 'modo' | 'fotoHash' | 'assinaturaHash' | 'mimeType' | 'coletadoEm' | 'consentimento'>;
export interface ColetasRepository {
  guardarFoto(bytes: Buffer, mimeType: Mime): {id: string; hash: string};
  obterFoto(id: string): {bytes: Buffer; mimeType: Mime};
  criar(emissaoId: string, dados: {modo: 'real' | 'demonstracao'; foto: Buffer; mimeType: Mime; svg: string; pin: string; consentimento: boolean; fotoId?: string}): MetadadosColeta;
  remover(emissaoId: string): void;
  obter(emissaoId: string): MetadadosColeta | undefined;
  verificarFator(emissaoId: string, fator: {pin?: string; credencialDispositivo?: string}, registrar: boolean): {status: 'ok' | 'invalido' | 'limitado'; credencialDispositivo?: string; tentarEm?: number};
}

// Fotos, SVG e índice (incluindo hashes/salts do PIN) são cifrados separadamente.
// Uma instância por processo; uma futura implementação SQLite deve preservar as transações.
export class ArquivosColetasRepository implements ColetasRepository {
  private chave: Buffer;
  private indice: Indice;
  constructor(private dir: string) {
    mkdirSync(dir, {recursive: true, mode: 0o700});
    const chaveFile = path.join(dir, 'coleta.key');
    if (!existsSync(chaveFile)) {
      if (existsSync(path.join(dir, 'indice.bin'))) throw new Error('Chave da coleta ausente. Restaure o armazenamento original.');
      writeFileSync(chaveFile, randomBytes(32), {mode: 0o600, flag: 'wx'});
    }
    this.chave = readFileSync(chaveFile);
    if (this.chave.length !== 32) throw new Error('Chave da coleta inválida.');
    this.indice = existsSync(path.join(dir, 'indice.bin'))
      ? indiceSchema.parse(JSON.parse(this.ler('indice').toString('utf8')))
      : {versao: 1, uploads: {}, emissoes: {}};
    this.limparPendentes();
  }
  private arquivo(nome: string) {return path.join(this.dir, nome + '.bin');}
  private gravar(nome: string, bytes: Buffer) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.chave, iv);
    cipher.setAAD(Buffer.from('facilid-coleta:' + nome));
    const cifrado = Buffer.concat([cipher.update(bytes), cipher.final()]);
    const temporario = this.arquivo(nome) + '.tmp';
    try {
      writeFileSync(temporario, Buffer.concat([iv, cipher.getAuthTag(), cifrado]), {mode: 0o600});
      renameSync(temporario, this.arquivo(nome));
    } catch (error) {
      try {if (existsSync(temporario)) unlinkSync(temporario);} catch { /* Retentado na próxima limpeza. */ }
      throw error;
    }
  }
  private ler(nome: string) {
    const conteudo = readFileSync(this.arquivo(nome));
    if (conteudo.length < 28) throw new Error('Arquivo de coleta incompleto.');
    const decipher = createDecipheriv('aes-256-gcm', this.chave, conteudo.subarray(0,12));
    decipher.setAAD(Buffer.from('facilid-coleta:' + nome)); decipher.setAuthTag(conteudo.subarray(12,28));
    return Buffer.concat([decipher.update(conteudo.subarray(28)), decipher.final()]);
  }
  private excluir(nome: string) {if (existsSync(this.arquivo(nome))) unlinkSync(this.arquivo(nome));}
  private tentarExcluir(nome: string) {try {this.excluir(nome);} catch { /* A referência já foi invalidada; limpeza posterior tenta novamente. */ }}
  private salvar(next: Indice) {this.gravar('indice', Buffer.from(JSON.stringify(next))); this.indice = next;}
  private limparPendentes() {
    const expirados = Object.entries(this.indice.uploads).filter(([, u]) => u.expiraEm <= Date.now()).map(([id]) => id);
    if (expirados.length) {
      const next = structuredClone(this.indice);
      for (const id of expirados) delete next.uploads[id];
      this.salvar(next);
    }
    // Só nomes gerados pelo próprio repositório e UUIDs são elegíveis. Sem exclusão recursiva.
    // Recupera uploads consumidos e gravações interrompidas que ficaram fora do índice.
    for (const file of readdirSync(this.dir)) {
      const match = /^(pendente|foto|assinatura)-([a-f0-9-]{36})\.bin(\.tmp)?$/.exec(file);
      if (!match || !z.string().uuid().safeParse(match[2]).success) continue;
      const referenciado = match[1] === 'pendente' ? this.indice.uploads[match[2]] : this.indice.emissoes[match[2]];
      if (!referenciado || match[3]) {try {unlinkSync(path.join(this.dir, file));} catch { /* Permissão pode voltar em uma próxima operação. */ }}
    }
  }
  guardarFoto(bytes: Buffer, mimeType: Mime) {
    this.limparPendentes();
    if (Object.keys(this.indice.uploads).length >= 50) throw new ErroColeta('Há muitas fotos pendentes. Aguarde a expiração e tente novamente.', 429);
    const id = randomUUID(), hash = hashBytes(bytes), next = structuredClone(this.indice);
    this.gravar('pendente-' + id, bytes);
    next.uploads[id] = {hash, mimeType, expiraEm: Date.now() + 15 * 60_000};
    try {this.salvar(next);} catch (e) {this.tentarExcluir('pendente-' + id); throw e;}
    return {id, hash};
  }
  obterFoto(id: string) {
    this.limparPendentes();
    if (!z.string().uuid().safeParse(id).success || !this.indice.uploads[id]) throw new ErroColeta('A foto expirou ou já foi utilizada. Capture novamente.');
    const foto = this.indice.uploads[id], bytes = this.ler('pendente-' + id);
    if (hashBytes(bytes) !== foto.hash) throw new Error('Integridade da foto inválida.');
    return {bytes, mimeType: foto.mimeType};
  }
  criar(emissaoId: string, dados: {modo: 'real' | 'demonstracao'; foto: Buffer; mimeType: Mime; svg: string; pin: string; consentimento: boolean; fotoId?: string}) {
    z.string().uuid().parse(emissaoId);
    if (this.indice.emissoes[emissaoId]) throw new Error('Coleta já existente.');
    const salt = randomBytes(16), registro: Registro = {
      modo: dados.modo, fotoHash: hashBytes(dados.foto), assinaturaHash: hashBytes(dados.svg), mimeType: dados.mimeType,
      coletadoEm: Date.now(), consentimento: dados.consentimento, pinSalt: salt.toString('hex'),
      pinHash: scryptSync(dados.pin, salt, 32).toString('hex'), dispositivos: [], falhas: 0, primeiraFalhaEm: 0, bloqueadoAte: 0
    };
    const next = structuredClone(this.indice);
    next.emissoes[emissaoId] = registro;
    if (dados.fotoId) delete next.uploads[dados.fotoId];
    try {
      this.gravar('foto-' + emissaoId, dados.foto);
      this.gravar('assinatura-' + emissaoId, Buffer.from(dados.svg));
      this.salvar(next);
    } catch (e) {this.tentarExcluir('foto-' + emissaoId); this.tentarExcluir('assinatura-' + emissaoId); throw e;}
    // A referência foi consumida no índice. Falha nesta limpeza não desfaz uma emissão válida.
    if (dados.fotoId) this.tentarExcluir('pendente-' + dados.fotoId);
    return this.metadados(registro);
  }
  remover(emissaoId: string) {
    if (!z.string().uuid().safeParse(emissaoId).success) return;
    const next = structuredClone(this.indice); delete next.emissoes[emissaoId]; this.salvar(next);
    this.tentarExcluir('foto-' + emissaoId); this.tentarExcluir('assinatura-' + emissaoId);
  }
  private metadados(r: Registro): MetadadosColeta {
    return {modo: r.modo, fotoHash: r.fotoHash, assinaturaHash: r.assinaturaHash, mimeType: r.mimeType, coletadoEm: r.coletadoEm, consentimento: r.consentimento};
  }
  obter(emissaoId: string) {const registro = this.indice.emissoes[emissaoId]; return registro ? this.metadados(registro) : undefined;}
  verificarFator(emissaoId: string, fator: {pin?: string; credencialDispositivo?: string}, registrar: boolean) {
    const next = structuredClone(this.indice), registro = next.emissoes[emissaoId], agora = Date.now();
    if (!registro) return {status: 'invalido' as const};
    if (registro.bloqueadoAte > agora) return {status: 'limitado' as const, tentarEm: registro.bloqueadoAte};
    if (agora - registro.primeiraFalhaEm >= 30_000 || registro.bloqueadoAte) {registro.falhas = 0; registro.primeiraFalhaEm = 0; registro.bloqueadoAte = 0;}
    const valido = fator.pin !== undefined
      ? timingSafeEqual(scryptSync(fator.pin, Buffer.from(registro.pinSalt, 'hex'), 32), Buffer.from(registro.pinHash, 'hex'))
      : Boolean(fator.credencialDispositivo && registro.dispositivos.includes(hashBytes(fator.credencialDispositivo)));
    if (!valido) {
      if (!registro.falhas) registro.primeiraFalhaEm = agora;
      registro.falhas++;
      if (registro.falhas >= 5) registro.bloqueadoAte = agora + 30_000;
      this.salvar(next);
      return registro.bloqueadoAte ? {status: 'limitado' as const, tentarEm: registro.bloqueadoAte} : {status: 'invalido' as const};
    }
    registro.falhas = 0; registro.primeiraFalhaEm = 0; registro.bloqueadoAte = 0;
    let credencialDispositivo: string | undefined;
    if (registrar && fator.pin) {
      credencialDispositivo = randomBytes(32).toString('hex');
      registro.dispositivos = [...registro.dispositivos.slice(-4), hashBytes(credencialDispositivo)];
    }
    this.salvar(next);
    return {status: 'ok' as const, ...(credencialDispositivo ? {credencialDispositivo} : {})};
  }
}
