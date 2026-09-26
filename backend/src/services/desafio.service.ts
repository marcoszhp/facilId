import { randomUUID } from 'node:crypto';
import { ErroColeta } from './coleta.service';

type Desafio = {emissaoId: string; expiraEm: number; reserva?: symbol};
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
    obter(id: string) {limpar(); const desafio = desafios.get(id); return desafio ? {emissaoId: desafio.emissaoId, expiraEm: desafio.expiraEm} : undefined;},
    reservar(id: string) {
      limpar();
      const desafio = desafios.get(id);
      if (!desafio) return undefined;
      if (desafio.reserva) throw new ErroColeta('Esta verificação já está em andamento. Aguarde a resposta antes de tentar novamente.', 409);
      // Reserva síncrona antes de qualquer consulta assíncrona. Duas requisições
      // nunca podem confirmar o mesmo desafio enquanto o banco está respondendo.
      const reserva = Symbol('confirmacao');
      desafio.reserva = reserva;
      const pertence = () => desafios.get(id) === desafio && desafio.reserva === reserva;
      return {
        emissaoId: desafio.emissaoId,
        vigente: () => pertence() && desafio.expiraEm > Date.now(),
        consumir: () => {if (pertence()) desafios.delete(id);},
        liberar: () => {
          if (!pertence()) return;
          if (desafio.expiraEm <= Date.now()) desafios.delete(id);
          else delete desafio.reserva;
        }
      };
    },
    consumir(id: string) {desafios.delete(id);}
  };
}
