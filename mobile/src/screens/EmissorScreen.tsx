import React,{useEffect,useState} from 'react';
import { Platform,Text,View,useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Botao,Campo,Aviso } from '../components/Ui';
import { criarApi,mensagemErro } from '../services/api.service';
import { gravarNfc,cancelarNfc } from '../services/nfc.service';
import { falar,feedback } from '../services/feedback';
import { styles as s } from '../theme';
export function EmissorScreen({url}:{url:string}) {
  const {width}=useWindowDimensions();
  const [nome,setNome]=useState(''),[cpf,setCpf]=useState(''),[idade,setIdade]=useState(''),[json,setJson]=useState(''),[erro,setErro]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  useEffect(()=>{falar('Emissão de cartão. Preencha nome, CPF e idade com dados fictícios.');return()=>{void cancelarNfc();};},[]);
  async function executar(action:()=>Promise<void>){setBusy(true);setErro('');setNotice('');try{await action();}catch(e){const msg=mensagemErro(e);setErro(msg);feedback(msg,false);}finally{setBusy(false);}}
  return <View style={{gap:20}}><Text style={s.title}>Emitir cartão</Text><Text style={s.text}>Área do responsável. Use somente dados fictícios nesta demonstração. Emitir novamente substitui o cartão anterior.</Text><Botao title="Ouvir instruções" secondary onPress={()=>falar('Preencha nome, CPF e idade. Toque em gerar cartão. Guarde o código para testar o acesso.')}/><Campo label="Nome" value={nome} onChangeText={setNome} editable={!busy}/><Campo label="CPF" value={cpf} onChangeText={setCpf} keyboardType="number-pad" maxLength={14} editable={!busy}/><Campo label="Idade" value={idade} onChangeText={setIdade} keyboardType="number-pad" maxLength={3} editable={!busy}/><Botao title={busy?'Aguarde…':'Gerar cartão'} disabled={busy} onPress={()=>void executar(async()=>{if(!/^\d{1,3}$/.test(idade))throw new Error('Informe a idade em números.');setJson('');setJson(JSON.stringify(await criarApi(url).emitir({nome,cpf,idade:Number(idade)})));feedback('Cartão gerado.',true);})}/><Aviso texto={erro}/>{notice&&<Text accessibilityLiveRegion="polite" style={s.text}>{notice}</Text>}{json&&<View style={s.card}><Text style={s.label}>Seu cartão de demonstração</Text><View accessible accessibilityLabel="QR Code do cartão. O mesmo código está no campo abaixo." style={{alignItems:'center'}}><QRCode value={json} size={Math.min(240,Math.max(100,width-128))} quietZone={12}/></View><Campo label="Copie este código para entrar" value={json} multiline editable={false} selectTextOnFocus style={{minHeight:160}}/>{Platform.OS!=='web'&&<><Botao title="Gravar na tag NFC" disabled={busy} onPress={()=>void executar(async()=>{await gravarNfc(json);setNotice('Cartão gravado.');feedback('Cartão gravado.',true);})}/>{busy&&<Botao title="Cancelar gravação" secondary onPress={()=>void cancelarNfc()}/>}</>}<Text style={s.text}>O cartão com assinatura precisa de uma tag NDEF com espaço suficiente. Tags NTAG213/215 são pequenas para este formato.</Text></View>}</View>;
}

