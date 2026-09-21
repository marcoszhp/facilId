import { randomUUID } from 'node:crypto';
import { DadosEmissao } from '../schemas/coleta';
import { assinaturaService } from './assinatura.service';
import { UsuariosRepository } from '../repositories/usuarios.repository';
import { ColetasRepository } from '../repositories/coletas.repository';
import { FOTO_DEMONSTRACAO, gerarSvg } from './coleta.service';
export function emitirPessoa(dados:DadosEmissao, assinatura:ReturnType<typeof assinaturaService>, repo:UsuariosRepository, coletas:ColetasRepository) {
  const svg = gerarSvg(dados.assinatura), emissaoId = randomUUID();
  const foto = dados.modo === 'real' ? coletas.obterFoto(dados.fotoId!) : {bytes: FOTO_DEMONSTRACAO, mimeType: 'image/png' as const};
  const coleta = coletas.criar(emissaoId, {modo: dados.modo, foto: foto.bytes, mimeType: foto.mimeType, svg, pin: dados.pin, consentimento: dados.consentimento === true, fotoId: dados.fotoId});
  try {
    const chip = assinatura.assinar({cpf: dados.cpf, nome: dados.nome, idade: dados.idade, versao:2, emissaoId,
      rosto_hash: coleta.fotoHash, digital_template: dados.modo === 'real' ? 'BIOMETRIA_LOCAL_NAO_COLETADA' : 'DEMONSTRACAO_SEM_BIOMETRIA',
      assinatura_svg: 'sha256:' + coleta.assinaturaHash});
    repo.salvar(chip); return chip;
  } catch (error) {coletas.remover(emissaoId); throw error;}
}
