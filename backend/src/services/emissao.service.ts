import { createHash } from 'node:crypto';
import { z } from 'zod';
import { cadastroSchema } from '../schemas/payload';
import { assinaturaService } from './assinatura.service';
import { UsuariosRepository } from '../repositories/usuarios.repository';
export function emitirPessoa(dados:z.infer<typeof cadastroSchema>, assinatura:ReturnType<typeof assinaturaService>, repo:UsuariosRepository) {
  // Dados artificiais para demonstração; nenhuma biometria é capturada.
  const hash = (tipo:string)=>createHash('sha256').update(`FICTICIO:${tipo}:${dados.cpf}`).digest('hex');
  const chip = assinatura.assinar({...dados,rosto_hash:hash('rosto'),digital_template:hash('digital'),assinatura_svg:'M10 80 Q 52 10 100 80 T 190 80'});
  repo.salvar(chip); return chip;
}
