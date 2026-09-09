import React,{useEffect,useState} from 'react';
import { Platform, Switch, Text, View } from 'react-native';
import { Botao,Campo,Aviso } from '../components/Ui';
import { LeitorQr } from '../components/LeitorQr';
import { criarApi,mensagemErro } from '../services/api.service';
import { Sessao } from '../services/identidade';
import { cancelarNfc,lerNfc } from '../services/nfc.service';
import { feedback,falar } from '../services/feedback';
import { styles as s } from '../theme';
export function LoginScreen({url,onSuccess}:{url:string;onSuccess:(data:Sessao)=>void}) {
  const [cpf,setCpf]=useState(''),[texto,setTexto]=useState(''),[simulado,setSimulado]=useState(true),[camera,setCamera]=useState(false),[busy,setBusy]=useState(false),[erro,setErro]=useState('');
  useEffect(()=>{falar('Bem-vindo. Digite seu CPF. Depois, leia seu cartão.');return ()=>{void cancelarNfc();};},[]);
  async function entrar(origem:()=>Promise<string>) {
    if(busy)return;setBusy(true);setErro('');
    try {const data=await criarApi(url).entrar(cpf,await origem());feedback('Acesso liberado.',true);onSuccess(data);}
    catch(e) {const msg=mensagemErro(e);setErro(msg);feedback(msg,false);} finally {setBusy(false);}
  }
  async function exemplo() {setBusy(true);setErro('');try {const cards=await criarApi(url).exemplos();if(!cards[0])throw new Error('Cadastre uma pessoa na tela de emissão.');setCpf(cards[0].cpf);setTexto(JSON.stringify(cards[0]));falar('Exemplo carregado. Toque em entrar com o código.');}catch(e){setErro(mensagemErro(e));}finally{setBusy(false);}}
  return <View style={{gap:20}}><Text style={s.title}>Entre com seu cartão</Text><Text style={s.text}>1. Digite seu CPF.{ '\n' }2. Leia seu cartão.{ '\n' }3. Acesse seu cartão digital.</Text><Botao title="Ouvir instruções" secondary onPress={()=>falar('Digite os onze números do CPF. Leia seu cartão ou cole o código. Depois toque em entrar.')}/><Campo label="Seu CPF" value={cpf} onChangeText={setCpf} keyboardType="number-pad" maxLength={14} editable={!busy}/><View style={s.row}><Switch accessibilityLabel="Usar modo simulado" disabled={busy||Platform.OS==='web'} value={simulado} onValueChange={v=>{setSimulado(v);setCamera(false);}}/><Text style={s.text}>Modo simulado</Text></View>{simulado?<><Campo label="Código do cartão" value={texto} onChangeText={setTexto} multiline style={{minHeight:120}} editable={!busy}/><Botao title={busy?'Aguarde…':'Entrar com o código'} disabled={busy} onPress={()=>void entrar(async()=>texto)}/><Botao title="Ler QR Code" secondary disabled={busy} onPress={()=>setCamera(true)}/>{camera&&<LeitorQr onClose={()=>setCamera(false)} onRead={data=>{setCamera(false);setTexto(data);void entrar(async()=>data);}}/>}<Botao title="Usar exemplo fictício" secondary disabled={busy} onPress={()=>void exemplo()}/></>:<><Botao title={busy?'Aproxime seu cartão…':'Aproximar cartão'} disabled={busy} onPress={()=>void entrar(lerNfc)}/>{busy&&<Botao title="Cancelar leitura" secondary onPress={()=>void cancelarNfc()}/>}</>}<Aviso texto={erro}/></View>;
}
