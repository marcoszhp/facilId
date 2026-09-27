import { z } from 'zod';
import { cadastroSchema, cpfSchema } from './payload';

// Uma única representação impede variantes do mesmo instante na persistência JSON.
export const instanteSchema = z.string().datetime().refine(valor => {
  const instante = new Date(valor);
  return Number.isFinite(instante.getTime()) && instante.toISOString() === valor;
}, 'Use data ISO UTC canônica, com milissegundos e Z.');
export const statusAtendimentoSchema = z.enum(['agendado', 'confirmado', 'concluido']);
export const agendamentoSchema = z.object({horario: instanteSchema}).strict();
export const atualizacaoAtendimentoSchema = z.object({status: z.enum(['confirmado', 'concluido'])}).strict();
export const atendimentoSchema = z.object({
  id: z.string().uuid(), protocolo: z.string().regex(/^FID-[A-F0-9]{12}$/),
  cpf: cpfSchema, nome: cadastroSchema.shape.nome, horario: instanteSchema,
  status: statusAtendimentoSchema, criadoEm: instanteSchema, atualizadoEm: instanteSchema
}).strict();
export type Atendimento = z.infer<typeof atendimentoSchema>;
export type AtualizacaoAtendimento = z.infer<typeof atualizacaoAtendimentoSchema>['status'];
