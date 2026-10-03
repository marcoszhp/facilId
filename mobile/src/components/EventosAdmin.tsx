import React,{useEffect,useRef,useState} from 'react';
import { Text,View } from 'react-native';
import { criarApi,erroCancelado,erroNaoAutorizado,mensagemErro } from '../services/api.service';
import { EventoAdministrativo,TipoEventoAdministrativo } from '../services/identidade';
import { styles as s } from '../theme';
import { Aviso,Botao } from './Ui';
import { useOperacao } from './useOperacao';

type Props={url:string;credencial:string;disabled?:boolean;onUnauthorized:()=>void};
const tipos:Record<TipoEventoAdministrativo,string>={emissao:'Emissão',bloqueio:'Bloqueio',substituicao:'Substituição'};
const dataBrasilia=new Intl.DateTimeFormat('pt-BR',{
  timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,
});

export function EventosAdmin(props:Props){
  return <PainelEventos key={JSON.stringify([props.url,props.credencial])} {...props}/>;
}

function PainelEventos(props:Props){
  const [aberto,setAberto]=useState(false);
  return <View style={s.card}>
    <Text accessibilityRole="header" style={s.title}>Histórico administrativo</Text>
    <Text style={s.text}>Emissões, bloqueios e substituições de cartões, do mais recente ao mais antigo. Os motivos são registrados automaticamente, sem identificação individual do responsável.</Text>
    <Text style={s.text}>Depois de emitir ou bloquear um cartão, use Atualizar histórico para consultar os novos eventos.</Text>
    {aberto?<>
      <Botao title="Fechar histórico" secondary onPress={()=>setAberto(false)}/>
      <ListaEventos {...props}/>
    </>:<Botao title="Consultar histórico administrativo" secondary disabled={props.disabled} onPress={()=>setAberto(true)}/>}
  </View>;
}

function ListaEventos({url,credencial,disabled=false,onUnauthorized}:Props){
  const [eventos,setEventos]=useState<EventoAdministrativo[]>([]),[carregado,setCarregado]=useState(false);
  const [busy,setBusy]=useState(false),[erro,setErro]=useState(''),[aviso,setAviso]=useState('');
  const ocupado=useRef(false),{iniciar,vigente,cancelar}=useOperacao();

  async function atualizar(){
    if(ocupado.current||disabled)return;
    ocupado.current=true;const controle=iniciar();setBusy(true);setErro('');setAviso('');
    try{
      const lista=await criarApi(url).eventos(credencial,controle.signal);
      if(!vigente(controle))return;
      // A API fornece a ordem cronológica e o desempate estável dos eventos.
      setEventos(lista);setCarregado(true);setAviso('Histórico administrativo atualizado.');
    }catch(e){
      if(!vigente(controle)||erroCancelado(e))return;
      if(erroNaoAutorizado(e)){
        cancelar();ocupado.current=false;setBusy(false);setEventos([]);setCarregado(false);onUnauthorized();
      }else{
        setErro(mensagemErro(e));
        if(carregado)setAviso('O histórico exibido corresponde à última consulta. Atualize para conferir novos eventos.');
      }
    }finally{if(vigente(controle)){ocupado.current=false;setBusy(false);}}
  }
  useEffect(()=>{void atualizar();},[]);
  function cancelarConsulta(){
    cancelar();ocupado.current=false;setBusy(false);setErro('');setAviso('Consulta do histórico cancelada.');
  }

  return <View style={{gap:16}}>
    <Botao title="Atualizar histórico" secondary disabled={busy||disabled} onPress={()=>void atualizar()}/>
    {busy&&<>
      <Text accessibilityLiveRegion="polite" style={s.text}>Aguarde. Consultando histórico administrativo.</Text>
      <Botao title="Cancelar consulta do histórico" secondary onPress={cancelarConsulta}/>
    </>}
    <Aviso texto={erro}/>
    {!!aviso&&<Text accessibilityLiveRegion="polite" style={s.text}>{aviso}</Text>}
    {carregado&&!eventos.length&&<Text style={s.text}>Nenhum evento administrativo registrado.</Text>}
    {eventos.map(item=><View key={item.id} style={s.card}>
      <Text style={s.label}>{item.nome}</Text>
      <Text style={s.text}>CPF: ***.***.***-{item.cpf.slice(-2)}</Text>
      <Text style={s.text}>Tipo: {tipos[item.tipo]}</Text>
      <Text style={s.text}>Data: {dataBrasilia.format(new Date(item.ocorridoEm))} (horário de Brasília)</Text>
      <Text style={s.text}>Motivo: {item.motivo}</Text>
    </View>)}
  </View>;
}
