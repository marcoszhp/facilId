import { z } from 'zod';
import { cadastroSchema } from './payload';

const ponto = z.object({x: z.number().finite().min(0).max(320), y: z.number().finite().min(0).max(180)}).strict();
export const desenhoSchema = z.object({
  largura: z.literal(320), altura: z.literal(180), tracos: z.array(z.array(ponto).min(2).max(512)).min(1).max(32)
}).strict().refine(d => d.tracos.reduce((n, t) => n + t.length, 0) <= 1500, 'A assinatura tem pontos demais.');
export const emissaoSchema = cadastroSchema.extend({
  modo: z.enum(['real', 'demonstracao']), fotoId: z.string().uuid().optional(),
  assinatura: desenhoSchema, pin: z.string().regex(/^\d{6}$/), consentimento: z.boolean().optional()
}).strict().refine(d => d.modo === 'demonstracao' ? !d.fotoId : Boolean(d.fotoId && d.consentimento === true),
  'No modo real, confirme o consentimento e capture a foto. No modo demonstração, não envie foto.');
export const fotoSchema = z.object({
  base64: z.string().min(1).max(2_796_204), mimeType: z.enum(['image/jpeg', 'image/png'])
}).strict();
export const confirmacaoSchema = z.object({
  desafioId: z.string().uuid(), pin: z.string().regex(/^\d{6}$/).optional(),
  credencialDispositivo: z.string().regex(/^[a-f0-9]{64}$/).optional(), registrarDispositivo: z.boolean().optional()
}).strict().refine(d => Boolean(d.pin) !== Boolean(d.credencialDispositivo), 'Escolha PIN ou credencial do aparelho.')
  .refine(d => !d.registrarDispositivo || Boolean(d.pin), 'Registrar aparelho exige PIN.');
export type DadosEmissao = z.infer<typeof emissaoSchema>;
export type Desenho = z.infer<typeof desenhoSchema>;
