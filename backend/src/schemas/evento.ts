import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { cadastroSchema, Chip } from './payload';
import { instanteSchema } from './atendimento';

export const motivosEvento = {
  emissao: 'Emissão de novo cartão pelo responsável.',
  bloqueio: 'Bloqueio de cartão solicitado pelo responsável.',
  substituicao: 'Cartão substituído após emissão de uma nova via.'
} as const;
export const eventoAdministrativoSchema = z.object({
  id: z.string().uuid(), emissaoId: z.string().uuid(),
  cpf: cadastroSchema.shape.cpf, nome: cadastroSchema.shape.nome,
  tipo: z.enum(['emissao', 'bloqueio', 'substituicao']),
  ocorridoEm: instanteSchema, motivo: z.string()
}).strict().refine(evento => evento.motivo === motivosEvento[evento.tipo], 'Motivo incompatível com o evento.');
export type EventoAdministrativo = z.infer<typeof eventoAdministrativoSchema>;

// Projeta somente identidade pública; nenhum campo livre, fator ou operador entra no histórico.
export function novoEvento(chip: Pick<Chip, 'emissaoId' | 'cpf' | 'nome'>, tipo: EventoAdministrativo['tipo'], ocorridoEm: string): EventoAdministrativo {
  return eventoAdministrativoSchema.parse({id: randomUUID(), emissaoId: chip.emissaoId,
    cpf: chip.cpf, nome: chip.nome, tipo, ocorridoEm, motivo: motivosEvento[tipo]});
}
