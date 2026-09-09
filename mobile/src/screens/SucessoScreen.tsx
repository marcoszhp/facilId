import React,{useEffect,useState} from 'react';
import { Text,View } from 'react-native';
import { Sessao } from '../services/identidade';
import { criarApi,mensagemErro } from '../services/api.service';
import { falar } from '../services/feedback';
import { Botao,Aviso } from '../components/Ui';
import { styles as s } from '../theme';
export function SucessoScreen({sessao,url,onExit}:{sessao:Sessao;url:string;onExit:()=>void}) {
  const [erro,setErro]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{falar(`Acesso liberado. Bem-vindo, ${sessao.perfil.nome}.`);const timer=setTimeout(onExit,15*60*1000);return()=>clearTimeout(timer);},[sessao,onExit]);
  return <View style={{gap:20}}><Text style={s.title}>Acesso liberado</Text><Text style={s.text}>Olá, {sessao.perfil.nome}.</Text><View style={s.card}><Text style={s.title}>Meu cartão digital</Text><Text style={s.text}>{sessao.perfil.nome}</Text><Text style={s.text}>Idade: {sessao.perfil.idade} anos</Text><Text style={s.text}>CPF: ***.***.***-{sessao.perfil.cpf.slice(-2)}</Text><Text style={s.text}>Demonstração escolar • não é documento oficial</Text></View><Botao title="Ouvir meu cartão" secondary onPress={()=>falar(`${sessao.perfil.nome}. ${sessao.perfil.idade} anos. Seu acesso está liberado.`)}/><Botao title="Consultar meu acesso" onPress={()=>{setErro('');setNotice('');void criarApi(url).perfil(sessao.token).then(()=>setNotice('Seu acesso está ativo.')).catch(e=>setErro(mensagemErro(e)));}}/>{notice&&<Text style={s.text} accessibilityLiveRegion="polite">{notice}</Text>}<Aviso texto={erro}/><Botao title="Sair" secondary onPress={onExit}/></View>;
}
