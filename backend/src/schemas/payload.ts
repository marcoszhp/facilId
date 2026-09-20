import { z } from 'zod';

// O CPF é fictício: validamos formato, sem exigir dígitos verificadores reais.
export const cpfSchema = z.string().regex(/^\d{11}$/, 'Informe os 11 números do CPF.');
export const cadastroSchema = z.object({cpf: cpfSchema, nome: z.string().trim().min(2).max(100), idade: z.number().int().min(0).max(130)}).strict();
export const identidadeSchema = cadastroSchema.extend({
  versao: z.literal(2), emissaoId: z.string().uuid(),
  rosto_hash: z.string().min(1).max(128), digital_template: z.string().min(1).max(128),
  assinatura_svg: z.string().min(1).max(300)
}).strict();
export const chipSchema = identidadeSchema.extend({assinatura_digital_orgao: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).max(1024)}).strict();
export const loginSchema = z.object({cpfDigitado: cpfSchema, dadosChip: chipSchema}).strict();
export type Identidade = z.infer<typeof identidadeSchema>;
export type Chip = z.infer<typeof chipSchema>;
