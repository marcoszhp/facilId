import axios from 'axios';
import { Chip, Perfil, Sessao, lerIdentidade, normalizarCpf } from './identidade';
export function criarApi(url:string) {
  if(!/^https?:\/\/[^\s]+$/.test(url)) throw new Error('Informe o endereço completo do serviço.');
  const http=axios.create({baseURL:url.replace(/\/$/,''),timeout:10000});
  return {
    async emitir(p:Perfil) {return (await http.post<Chip>('/api/emissao',{...p,cpf:normalizarCpf(p.cpf)})).data;},
    async exemplos() {return (await http.get<Chip[]>('/api/usuarios')).data;},
    async entrar(cpf:string,texto:string) {const dadosChip=lerIdentidade(texto,cpf); return (await http.post<Sessao>('/api/autenticar-nfc',{cpfDigitado:normalizarCpf(cpf),dadosChip})).data;},
    async perfil(token:string) {return (await http.get<Perfil>('/api/perfil',{headers:{Authorization:`Bearer ${token}`}})).data;}
  };
}
export function mensagemErro(error:unknown) {
  if(axios.isAxiosError(error)) return error.response?.data?.mensagem || 'Não foi possível conectar. Confira o endereço do serviço e a conexão.';
  return error instanceof Error?error.message:'Não foi possível concluir. Tente novamente.';
}
