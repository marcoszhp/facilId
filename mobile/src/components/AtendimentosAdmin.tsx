import React,{useEffect,useRef,useState} from 'react';
import { Text,View } from 'react-native';
import { criarApi,erroCancelado,erroNaoAutorizado,mensagemErro } from '../services/api.service';
import { Atendimento,StatusAtendimento } from '../services/identidade';
import { formatarHorarioAtendimento,situacaoAtendimento } from '../services/formatacao-atendimento';
import { styles as s } from '../theme';
import { Aviso,Botao } from './Ui';
import { useOperacao } from './useOperacao';

type Props={url:string;credencial:string;disabled?:boolean;onUnauthorized:()=>void};

export function AtendimentosAdmin(props:Props){
  const [aberto,setAberto]=useState(false);
  return <View style={s.card}>
    <Text accessibilityRole="header" style={s.title}>Atendimentos da secretaria</Text>
    <Text style={s.text}>Simulação escolar. Os agendamentos e suas situações não correspondem a um serviço público real.</Text>
    {aberto?<>
      <Botao title="Fechar atendimentos" secondary onPress={()=>setAberto(false)}/>
      <AgendaAdmin key={`${props.url}:${props.credencial}`} {...props}/>
    </>:<Botao title="Consultar atendimentos da secretaria" secondary disabled={props.disabled} onPress={()=>setAberto(true)}/>}
  </View>;
}

function AgendaAdmin({url,credencial,disabled=false,onUnauthorized}:Props){
  const [atendimentos,setAtendimentos]=useState<Atendimento[]>([]),[carregado,setCarregado]=useState(false);
  const [busy,setBusy]=useState(false),[erro,setErro]=useState(''),[aviso,setAviso]=useState('');
  const ocupado=useRef(false),{iniciar,vigente,cancelar}=useOperacao();

  async function executar(acao:(controle:AbortController)=>Promise<void>){
    if(ocupado.current||disabled)return;
    ocupado.current=true;const controle=iniciar();setBusy(true);setErro('');setAviso('');
    try{await acao(controle);}
    catch(e){
      if(!vigente(controle)||erroCancelado(e))return;
      if(erroNaoAutorizado(e)){cancelar();onUnauthorized();}
      else setErro(mensagemErro(e));
    }finally{if(vigente(controle)){ocupado.current=false;setBusy(false);}}
  }

  function atualizar(){
    void executar(async controle=>{
      const lista=await criarApi(url).atendimentos(credencial,controle.signal);
      if(!vigente(controle))return;
      setAtendimentos(lista);setCarregado(true);setAviso('Situação dos atendimentos atualizada.');
    });
  }
  useEffect(()=>{atualizar();},[]);

  function alterar(item:Atendimento,status:Exclude<StatusAtendimento,'agendado'>){
    void executar(async controle=>{
      const atualizado=await criarApi(url).atualizarAtendimento(item.id,status,credencial,controle.signal);
      if(!vigente(controle))return;
      setAtendimentos(anteriores=>anteriores.map(anterior=>anterior.id===atualizado.id?atualizado:anterior));
      setAviso(`Atendimento de ${atualizado.nome}, protocolo ${atualizado.protocolo}: ${situacaoAtendimento[atualizado.status]}.`);
    });
  }

  return <View style={{gap:16}}>
    <Botao title="Atualizar atendimentos" secondary disabled={busy||disabled} onPress={atualizar}/>
    {busy&&<Text accessibilityLiveRegion="polite" style={s.text}>Aguarde. Consultando ou atualizando atendimentos…</Text>}
    <Aviso texto={erro}/>
    {!!aviso&&<Text accessibilityLiveRegion="polite" style={s.text}>{aviso}</Text>}
    {carregado&&!atendimentos.length&&<Text style={s.text}>Nenhum atendimento agendado.</Text>}
    {atendimentos.map(item=><View key={item.id} style={s.card}>
      <Text style={s.label}>{item.nome}</Text>
      <Text style={s.text}>CPF: ***.***.***-{item.cpf.slice(-2)}</Text>
      <Text style={s.text}>Protocolo: {item.protocolo}</Text>
      <Text style={s.text}>{formatarHorarioAtendimento(item.horario)}</Text>
      <Text accessibilityLiveRegion="polite" style={s.text}>Situação: {situacaoAtendimento[item.status]}</Text>
      {item.status!=='concluido'&&<Botao
        title={`${item.status==='agendado'?'Confirmar':'Concluir'} atendimento de ${item.nome}, CPF final ${item.cpf.slice(-2)}, protocolo ${item.protocolo}`}
        disabled={busy||disabled} onPress={()=>alterar(item,item.status==='agendado'?'confirmado':'concluido')}/>}
    </View>)}
  </View>;
}
