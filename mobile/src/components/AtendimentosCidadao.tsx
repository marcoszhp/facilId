import React,{useEffect,useRef,useState} from 'react';
import { Text,View } from 'react-native';
import axios from 'axios';
import { criarApi,erroCancelado,erroNaoAutorizado,mensagemErro } from '../services/api.service';
import { Atendimento } from '../services/identidade';
import { formatarHorarioAtendimento,situacaoAtendimento } from '../services/formatacao-atendimento';
import { styles as s } from '../theme';
import { Aviso,Botao } from './Ui';
import { useOperacao } from './useOperacao';

type Props={url:string;token:string;onExit:(mensagem?:string)=>void};

export function AtendimentosCidadao(props:Props){
  const [aberto,setAberto]=useState(false);
  return <View style={s.card}>
    <Text accessibilityRole="header" style={s.title}>Atendimento na secretaria</Text>
    <Text style={s.text}>Simulação escolar. Este agendamento não reserva atendimento em um serviço público real.</Text>
    {aberto?<>
      <Botao title="Fechar agendamentos" secondary onPress={()=>setAberto(false)}/>
      <AgendaCidadao key={`${props.url}:${props.token}`} {...props}/>
    </>:<Botao title="Agendar atendimento na secretaria" onPress={()=>setAberto(true)}/>}
  </View>;
}

function AgendaCidadao({url,token,onExit}:Props){
  const [horarios,setHorarios]=useState<string[]>([]),[meus,setMeus]=useState<Atendimento[]>([]);
  const [escolhido,setEscolhido]=useState(''),[erro,setErro]=useState(''),[aviso,setAviso]=useState('');
  const [busy,setBusy]=useState(false),[carregado,setCarregado]=useState(false);
  const [precisaConferir,setPrecisaConferir]=useState(false);
  const ocupado=useRef(false),{iniciar,vigente,cancelar}=useOperacao();

  async function executar(acao:(controle:AbortController)=>Promise<void>){
    if(ocupado.current)return;
    ocupado.current=true;const controle=iniciar();setBusy(true);setErro('');setAviso('');
    try{await acao(controle);}
    catch(e){
      if(!vigente(controle)||erroCancelado(e))return;
      if(erroNaoAutorizado(e)){
        cancelar();onExit('Seu acesso foi encerrado. Leia um cartão ativo para entrar novamente.');
      }else setErro(mensagemErro(e));
    }finally{if(vigente(controle)){ocupado.current=false;setBusy(false);}}
  }

  function atualizar(){
    void executar(async controle=>{
      const api=criarApi(url);
      const [oferta,agendados]=await Promise.all([api.horarios(token,controle.signal),api.meusAtendimentos(token,controle.signal)]);
      if(!vigente(controle))return;
      setHorarios(oferta.horarios);setMeus(agendados);setCarregado(true);
      setPrecisaConferir(false);
      setEscolhido(anterior=>oferta.horarios.includes(anterior)?anterior:'');
      setAviso('Horários e situação dos seus agendamentos atualizados.');
    });
  }

  useEffect(()=>{atualizar();},[]);

  function agendar(){
    if(!escolhido||ocupado.current||precisaConferir)return;
    const horario=escolhido;
    void executar(async controle=>{
      const api=criarApi(url);
      try{
        const atendimento=await api.agendar(horario,token,controle.signal);
        if(!vigente(controle))return;
        setMeus(anteriores=>[atendimento,...anteriores.filter(item=>item.id!==atendimento.id)]);
        setHorarios(anteriores=>anteriores.filter(item=>item!==horario));setEscolhido('');setCarregado(true);
        setAviso(`Agendamento simulado realizado. Guarde o protocolo: ${atendimento.protocolo}.`);
      }catch(e){
        if(!vigente(controle)||erroCancelado(e))return;
        if(axios.isAxiosError(e)&&e.response?.status===409){
          setEscolhido('');setHorarios(anteriores=>anteriores.filter(item=>item!==horario));
          const conflito='Esse horário não está mais disponível. Escolha outro horário.';
          setErro(conflito);
          try{
            const [oferta,agendados]=await Promise.all([api.horarios(token,controle.signal),api.meusAtendimentos(token,controle.signal)]);
            if(!vigente(controle))return;
            setHorarios(oferta.horarios);setMeus(agendados);
            const anterior=agendados.find(item=>item.horario===horario);
            if(anterior){setErro('');setAviso(`Você já tem um atendimento nesse horário. Guarde o protocolo: ${anterior.protocolo}.`);}
          }catch(atualizacao){
            if(!vigente(controle)||erroCancelado(atualizacao))return;
            if(erroNaoAutorizado(atualizacao))throw atualizacao;
            setPrecisaConferir(true);
            setErro('Não foi possível conferir seus agendamentos após a disputa por esse horário. Atualize seus agendamentos antes de escolher outro.');
          }
        }else{
          if(!erroNaoAutorizado(e)){setPrecisaConferir(true);setAviso('Se a conexão caiu ao confirmar, atualize seus agendamentos antes de tentar de novo.');}
          throw e;
        }
      }
    });
  }

  return <View style={{gap:16}}>
    <Botao title="Atualizar meus agendamentos e horários" secondary disabled={busy} onPress={atualizar}/>
    {busy&&<Text accessibilityLiveRegion="polite" style={s.text}>Aguarde. Consultando ou salvando seu atendimento…</Text>}
    <Aviso texto={erro}/>
    {!!aviso&&<Text accessibilityLiveRegion="polite" style={s.text}>{aviso}</Text>}
    <Text accessibilityRole="header" style={s.label}>Meus agendamentos</Text>
    {carregado&&!meus.length&&<Text style={s.text}>Você ainda não tem agendamentos.</Text>}
    {meus.map(item=><View key={item.id} style={s.card}>
      <Text style={s.label}>Protocolo: {item.protocolo}</Text>
      <Text style={s.text}>{formatarHorarioAtendimento(item.horario)}</Text>
      <Text accessibilityLiveRegion="polite" style={s.text}>Situação: {situacaoAtendimento[item.status]}</Text>
    </View>)}
    <Text accessibilityRole="header" style={s.label}>Escolha um horário</Text>
    <Text style={s.text}>Calendário simulado: dias úteis, sem considerar feriados. Todos os horários seguem Brasília.</Text>
    {carregado&&!horarios.length&&<Text style={s.text}>Nenhum horário disponível agora. Atualize para consultar novamente.</Text>}
    {horarios.map(horario=><Botao key={horario} title={`${horario===escolhido?'Selecionado: ':'Selecionar: '}${formatarHorarioAtendimento(horario)}`} secondary={horario!==escolhido} disabled={busy||precisaConferir} onPress={()=>{setEscolhido(horario);setErro('');setAviso('');}}/>)}
    {!!escolhido&&<>
      <Text accessibilityLiveRegion="polite" style={s.text}>Horário escolhido: {formatarHorarioAtendimento(escolhido)}. Confirme para receber seu protocolo.</Text>
      <Botao title="Confirmar agendamento" disabled={busy||precisaConferir} onPress={agendar}/>
      <Botao title="Cancelar escolha do horário" secondary disabled={busy} onPress={()=>setEscolhido('')}/>
    </>}
  </View>;
}
