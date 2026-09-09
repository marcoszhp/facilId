import { z } from 'zod';
export const chipSchema=z.object({cpf:z.string().regex(/^\d{11}$/),nome:z.string().min(2).max(100),idade:z.number().int().min(0).max(130),rosto_hash:z.string().min(1).max(128),digital_template:z.string().min(1).max(128),assinatura_svg:z.string().min(1).max(300),assinatura_digital_orgao:z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).max(1024)}).strict();
export type Chip=z.infer<typeof chipSchema>;
export type Perfil=Pick<Chip,'cpf'|'nome'|'idade'>;
export type Sessao={sucesso:true;token:string;perfil:Perfil};
export const normalizarCpf=(cpf:string)=>cpf.replace(/[.\-\s]/g,'');
// NFC, QR e texto passam exatamente pela mesma validação antes da API.
export function lerIdentidade(texto:string,cpf:string):Chip {
  if(texto.length>8192) throw new Error('Código muito grande. Leia o cartão novamente.');
  let chip:Chip;
  try {chip=chipSchema.parse(JSON.parse(texto));} catch {throw new Error('Código do cartão inválido. Leia ou cole novamente.');}
  if(chip.cpf!==normalizarCpf(cpf)) throw new Error('CPF não confere com o cartão.');
  return chip;
}
