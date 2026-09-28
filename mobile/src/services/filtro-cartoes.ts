import { ResumoCartao } from './identidade';

export type FiltroEstadoCartao='todos'|ResumoCartao['estado'];
const textoBusca=(texto:string)=>texto.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();

export function filtrarCartoes(cartoes:ResumoCartao[],busca:string,estado:FiltroEstadoCartao):ResumoCartao[]{
  const termo=textoBusca(busca);
  const cpf=/^[\d.\-\s]+$/.test(termo)?termo.replace(/\D/g,''):'';
  return cartoes.filter(cartao=>(estado==='todos'||cartao.estado===estado)&&
    (!termo||textoBusca(cartao.nome).includes(termo)||(!!cpf&&cartao.cpf.includes(cpf))));
}
