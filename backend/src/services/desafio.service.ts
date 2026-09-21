import { randomUUID } from 'node:crypto';
import { ErroColeta } from './coleta.service';

type Desafio = {emissaoId: string; expiraEm: number};
export function desafioService() {
  const desafios = new Map<string, Desafio>();
  function limpar() {for (const [id, desafio] of desafios) if (desafio.expiraEm <= Date.now()) desafios.delete(id);}
  return {
    criar(emissaoId: string) {
      limpar();
      // Evita que releituras do mesmo cartão esgotem a memória; limite global adicional.
      const anteriores = [...desafios].filter(([, d]) => d.emissaoId === emissaoId);
      if (anteriores.length >= 5) desafios.delete(anteriores[0][0]);
      if (desafios.size >= 1000) throw new ErroColeta('Há muitas verificações em andamento. Tente novamente em dois minutos.', 429);
      const desafioId = randomUUID(), expiraEm = Date.now() + 2 * 60_000;
      desafios.set(desafioId, {emissaoId, expiraEm}); return {desafioId, expiraEm};
    },
    obter(id: string) {limpar(); return desafios.get(id);},
    consumir(id: string) {desafios.delete(id);}
  };
}
