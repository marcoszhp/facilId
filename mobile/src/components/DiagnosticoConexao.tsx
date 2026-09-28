import React,{useRef,useState} from 'react';
import { Text,View } from 'react-native';
import { criarApi,erroCancelado } from '../services/api.service';
import { Diagnostico,textosDiagnostico } from '../services/diagnostico.service';
import { styles as s } from '../theme';
import { Botao } from './Ui';
import { useOperacao } from './useOperacao';

export function DiagnosticoConexao({url}:{url:string}){
  const [aberto,setAberto]=useState(false);
  return <View style={s.card}>
    <Botao title={aberto?'Fechar diagnóstico':'Diagnosticar conexão'} secondary onPress={()=>setAberto(!aberto)}/>
    {aberto&&<Verificacao key={url} url={url}/>}
  </View>;
}

function Verificacao({url}:{url:string}){
  const [resultado,setResultado]=useState<Diagnostico|null>(null),[busy,setBusy]=useState(false);
  const ocupado=useRef(false),{iniciar,vigente,cancelar}=useOperacao();
  async function verificar(){
    if(ocupado.current)return;
    ocupado.current=true;const controle=iniciar();setBusy(true);setResultado(null);
    try {
      const resposta=await criarApi(url).saude(controle.signal);
      if(vigente(controle))setResultado(resposta);
    }catch(error){
      if(vigente(controle)&&!erroCancelado(error))setResultado({api:'sem_resposta'});
    }finally{if(vigente(controle)){ocupado.current=false;setBusy(false);}}
  }
  const textos=resultado?textosDiagnostico(resultado):null;
  return <View style={{gap:16}}>
    <Text accessibilityRole="header" style={s.label}>Diagnóstico da conexão</Text>
    <Text style={s.text}>Verifica o serviço configurado, sem enviar credenciais. O resultado vale para o momento da consulta.</Text>
    <Botao title="Verificar conexão" disabled={busy} onPress={()=>void verificar()}/>
    {busy&&<>
      <Text accessibilityLiveRegion="polite" style={s.text}>Verificando conexão…</Text>
      <Botao title="Cancelar verificação" secondary onPress={()=>{cancelar();ocupado.current=false;setBusy(false);}}/>
    </>}
    {textos&&<View accessibilityLiveRegion="polite" style={{gap:8}}>
      <Text style={s.text}>{textos.api}</Text><Text style={s.text}>{textos.banco}</Text><Text style={s.text}>{textos.orientacao}</Text>
    </View>}
  </View>;
}
