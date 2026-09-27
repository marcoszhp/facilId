import { randomBytes, randomUUID } from 'node:crypto';
import { Atendimento, AtualizacaoAtendimento } from '../schemas/atendimento';

export class ErroAtendimento extends Error {
  constructor(public status: 400 | 404 | 409, mensagem: string) {super(mensagem);}
}
const calendario = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});
function partes(instante: number) {
  const valores = calendario.formatToParts(instante);
  const obter = (tipo: Intl.DateTimeFormatPartTypes) => Number(valores.find(item => item.type === tipo)!.value);
  return {ano: obter('year'), mes: obter('month'), dia: obter('day'), hora: obter('hour'), minuto: obter('minute'), segundo: obter('second')};
}
function horarioEmBrasilia(dia: Date, hora: number): number {
  const local = Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), dia.getUTCDate(), hora);
  let instante = local;
  // Resolve o deslocamento pela zona nomeada; nunca depende do TZ da máquina.
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const p = partes(instante);
    const diferenca = local - Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
    if (!diferenca) return instante;
    instante += diferenca;
  }
  throw new Error('Não foi possível calcular o calendário de Brasília.');
}
// Calendário simulado: hoje até hoje+13, somente segunda a sexta, sem feriados.
export function horariosDaGrade(agora = Date.now()): string[] {
  const hoje = partes(agora), horarios: string[] = [];
  for (let deslocamento = 0; deslocamento < 14; deslocamento++) {
    const dia = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia + deslocamento));
    if (dia.getUTCDay() === 0 || dia.getUTCDay() === 6) continue;
    for (const hora of [9, 10, 11, 14, 15]) {
      const instante = horarioEmBrasilia(dia, hora);
      if (instante > agora) horarios.push(new Date(instante).toISOString());
    }
  }
  return horarios;
}
export function novoAtendimento(perfil: {cpf: string; nome: string}, horario: string): Atendimento {
  const agora = Date.now();
  if (!horariosDaGrade(agora).includes(horario)) throw new ErroAtendimento(400, 'Escolha um horário futuro disponível na grade da secretaria.');
  const instante = new Date(agora).toISOString();
  return {id: randomUUID(), protocolo: `FID-${randomBytes(6).toString('hex').toUpperCase()}`,
    cpf: perfil.cpf, nome: perfil.nome, horario, status: 'agendado', criadoEm: instante, atualizadoEm: instante};
}
export function conferirTransicao(atual: Atendimento['status'], proximo: AtualizacaoAtendimento): void {
  if (atual === proximo || (atual === 'agendado' && proximo === 'confirmado') || (atual === 'confirmado' && proximo === 'concluido')) return;
  throw new ErroAtendimento(409, 'O atendimento deve avançar de agendado para confirmado e depois para concluído.');
}
