import React,{useEffect,useRef,useState} from 'react';
import { Text,View } from 'react-native';
import { Sessao } from '../services/identidade';
import { criarApi,erroCancelado,erroNaoAutorizado,mensagemErro } from '../services/api.service';
import { falar,pararAudio } from '../services/feedback';
import { useOperacao } from '../components/useOperacao';
import { Botao,Aviso } from '../components/Ui';
import { styles as s } from '../theme';
export function SucessoScreen({sessao,url,onExit}:{sessao:Sessao;url:string;onExit:(mensagem?:string)=>void}) {
  const [erro,setErro]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[pertoDeExpirar,setPertoDeExpirar]=useState(false);
  const encerrada=useRef(false),{iniciar,vigente,cancelar}=useOperacao();
  useEffect(()=>{
    encerrada.current=false;falar(`Acesso liberado. Bem-vindo, ${sessao.perfil.nome}.`);
    const restante=Math.max(0,sessao.expiraEm-Date.now());
    setPertoDeExpirar(restante<=60000);
    const aviso=setTimeout(()=>setPertoDeExpirar(true),Math.max(0,restante-60000));
    const fim=setTimeout(()=>{encerrada.current=true;cancelar();onExit('Sua sessão expirou. Leia seu cartão para entrar novamente.');},restante);
    return()=>{encerrada.current=true;clearTimeout(aviso);clearTimeout(fim);pararAudio();};
  },[sessao,onExit,cancelar]);
  async function consultar(){
    if(busy||encerrada.current)return;
    const controle=iniciar();setBusy(true);setErro('');setNotice('');
    try{await criarApi(url).perfil(sessao.token,controle.signal);if(vigente(controle))setNotice('Seu acesso está ativo.');}
    catch(e){
      if(!vigente(controle)||erroCancelado(e))return;
      if(erroNaoAutorizado(e)){encerrada.current=true;cancelar();onExit('Seu acesso foi encerrado. Leia um cartão ativo para entrar novamente.');}
      else setErro(mensagemErro(e));
    }finally{if(vigente(controle))setBusy(false);}
  }
  function sair(){encerrada.current=true;cancelar();onExit();}
  return <View style={{gap:20}}>
    <Text style={s.title}>Acesso liberado</Text><Text style={s.text}>Olá, {sessao.perfil.nome}.</Text>
    {pertoDeExpirar&&<Text accessibilityLiveRegion="polite" style={s.text}>Seu acesso termina em menos de um minuto. Depois, leia o cartão para entrar novamente.</Text>}
    <View style={s.card}><Text style={s.title}>Meu cartão digital</Text><Text style={s.text}>{sessao.perfil.nome}</Text><Text style={s.text}>Idade: {sessao.perfil.idade} anos</Text><Text style={s.text}>CPF: ***.***.***-{sessao.perfil.cpf.slice(-2)}</Text><Text style={s.text}>Demonstração escolar • não é documento oficial</Text></View>
    <Botao title="Ouvir meu cartão" secondary onPress={()=>falar(`${sessao.perfil.nome}. ${sessao.perfil.idade} anos. Seu acesso está liberado.`)}/>
    <Botao title={busy?'Consultando acesso…':'Consultar meu acesso'} disabled={busy} onPress={()=>void consultar()}/>
    {notice&&<Text style={s.text} accessibilityLiveRegion="polite">{notice}</Text>}<Aviso texto={erro}/><Botao title="Sair" secondary onPress={sair}/>
  </View>;
}
