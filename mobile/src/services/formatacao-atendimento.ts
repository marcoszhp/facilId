import { StatusAtendimento } from './identidade';

const horarioBrasilia=new Intl.DateTimeFormat('pt-BR',{
  timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,
});

export const formatarHorarioAtendimento=(horario:string)=>`${horarioBrasilia.format(new Date(horario))} (horário de Brasília)`;
export const situacaoAtendimento:Record<StatusAtendimento,string>={agendado:'Agendado',confirmado:'Confirmado',concluido:'Concluído'};
