import axios from 'axios';
import { Chip, Perfil, ResumoCartao, Sessao, lerIdentidade, normalizarCpf } from './identidade';
export function criarApi(url:string) {
  if(!/^https?:\/\/[^\s]+$/.test(url)) throw new Error('Informe o endereço completo do serviço.');
  const http=axios.create({baseURL:url.replace(/\/$/,''),timeout:10000});
  const admin=(token:string,signal?:AbortSignal)=>({headers:{'X-Admin-Token':token},signal});
  // Futuras operações autenticadas reutilizam este transporte com cancelamento.
  const sessao=(token:string,signal?:AbortSignal)=>({headers:{Authorization:`Bearer ${token}`},signal});
  return {
    async emitir(p:Perfil,token:string,signal?:AbortSignal) {return (await http.post<Chip>('/api/emissao',{...p,cpf:normalizarCpf(p.cpf)},admin(token,signal))).data;},
    async usuarios(token:string,signal?:AbortSignal) {return (await http.get<ResumoCartao[]>('/api/usuarios',admin(token,signal))).data;},
    async cartao(emissaoId:string,token:string,signal?:AbortSignal) {return (await http.get<Chip>(`/api/cartoes/${encodeURIComponent(emissaoId)}`,admin(token,signal))).data;},
    async bloquear(emissaoId:string,token:string,signal?:AbortSignal) {await http.post(`/api/cartoes/${encodeURIComponent(emissaoId)}/bloquear`,{},admin(token,signal));},
    async entrar(cpf:string,texto:string,signal?:AbortSignal) {const dadosChip=lerIdentidade(texto,cpf);return (await http.post<Sessao>('/api/autenticar-nfc',{cpfDigitado:normalizarCpf(cpf),dadosChip},{signal})).data;},
    async perfil(token:string,signal?:AbortSignal) {return (await http.get<Perfil>('/api/perfil',sessao(token,signal))).data;}
  };
}
export const erroNaoAutorizado=(error:unknown)=>axios.isAxiosError(error)&&error.response?.status===401;
export const erroCancelado=(error:unknown)=>axios.isCancel(error)||(error instanceof Error&&error.name==='AbortError');
export function mensagemErro(error:unknown) {
  if(axios.isAxiosError(error)) return error.response?.data?.mensagem || 'Não foi possível conectar. Confira o endereço do serviço e a conexão.';
  return error instanceof Error?error.message:'Não foi possível concluir. Tente novamente.';
}
