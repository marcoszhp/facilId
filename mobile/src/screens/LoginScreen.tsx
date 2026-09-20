import React,{useEffect,useRef,useState} from 'react';
import { Platform,Text,View } from 'react-native';
import { Botao,Campo,Aviso } from '../components/Ui';
import { LeitorQr } from '../components/LeitorQr';
import { useOperacao } from '../components/useOperacao';
import { criarApi,erroCancelado,mensagemErro } from '../services/api.service';
import { Chip,Sessao,normalizarCpf } from '../services/identidade';
import { cancelarNfc,lerNfc } from '../services/nfc.service';
import { feedback,falar,pararAudio } from '../services/feedback';
import { styles as s } from '../theme';

type Props={url:string;onSuccess:(data:Sessao)=>void;cartaoDemonstracao?:Chip|null;mensagem?:string};
export function LoginScreen({url,onSuccess,cartaoDemonstracao,mensagem=''}:Props) {
  const [cpf,setCpf]=useState(cartaoDemonstracao?.cpf||''),[texto,setTexto]=useState('');
  const [etapa,setEtapa]=useState<1|2>(1),[opcoes,setOpcoes]=useState(false),[manual,setManual]=useState(false),[camera,setCamera]=useState(false);
  const [fase,setFase]=useState<'parado'|'lendo'|'verificando'>('parado'),[erro,setErro]=useState(''),[aviso,setAviso]=useState(mensagem);
  const ocupado=useRef(false),{iniciar,vigente,cancelar}=useOperacao();
  const busy=fase!=='parado';
  useEffect(()=>{falar(mensagem||'Bem-vindo. Digite seu CPF. Depois, leia seu cartão.');return()=>{void cancelarNfc();pararAudio();};},[url,mensagem]);
  function continuar(){
    if(!/^\d{11}$/.test(normalizarCpf(cpf))){setErro('Informe os 11 números do CPF para continuar.');falar('Informe os onze números do CPF para continuar.');return;}
    setErro('');setAviso('');setEtapa(2);falar('Agora leia seu cartão. Para testar sem cartão físico, abra as opções da demonstração.');
  }
  function interromper(){cancelar();ocupado.current=false;setFase('parado');void cancelarNfc();setAviso('Leitura cancelada. Você pode tentar novamente.');}
  async function entrar(origem:()=>Promise<string>,nfc=false){
    if(ocupado.current)return;
    ocupado.current=true;const controle=iniciar();setErro('');setAviso('');setFase(nfc?'lendo':'verificando');
    try{
      const conteudo=await origem();if(!vigente(controle))return;
      setFase('verificando');const data=await criarApi(url).entrar(cpf,conteudo,controle.signal);
      if(!vigente(controle))return;
      feedback('Acesso liberado.',true);onSuccess(data);
    }catch(e){if(vigente(controle)&&!erroCancelado(e)){const msg=mensagemErro(e);setErro(msg);feedback(msg,false);}}
    finally{if(vigente(controle)){ocupado.current=false;setFase('parado');}}
  }
  return <View style={{gap:20}}>
    <Text style={s.text}>Passo {etapa} de 2</Text>
    <Text style={s.title}>{etapa===1?'Informe seu CPF':'Leia seu cartão'}</Text>
    <Botao title="Ouvir instruções" secondary onPress={()=>falar(etapa===1?'Digite os onze números do CPF e toque em continuar.':'Aproxime o cartão do celular. Ou abra as opções da demonstração para usar QR Code ou texto.')}/>
    {etapa===1?<>
      {cartaoDemonstracao&&<Text style={s.text}>Cartão de demonstração preparado. Confira o CPF e continue.</Text>}
      <Campo label="Seu CPF" value={cpf} onChangeText={setCpf} keyboardType="number-pad" maxLength={14}/>
      <Botao title="Continuar" onPress={continuar}/>
    </>:<>
      <Text style={s.text}>CPF informado: ***.***.***-{normalizarCpf(cpf).slice(-2)}</Text>
      <Botao title="Corrigir CPF" secondary disabled={busy} onPress={()=>{setCamera(false);setEtapa(1);setErro('');}}/>
      {cartaoDemonstracao&&<Botao title="Entrar com o cartão preparado" disabled={busy||camera} onPress={()=>void entrar(async()=>JSON.stringify(cartaoDemonstracao))}/>}
      {Platform.OS!=='web'&&<Botao title="Aproximar cartão" disabled={busy||camera} onPress={()=>void entrar(lerNfc,true)}/>}
      {Platform.OS==='web'&&<Text style={s.text}>Neste navegador, use QR Code ou texto nas opções abaixo.</Text>}
      {busy&&<><Text style={s.label} accessibilityLiveRegion="polite">{fase==='lendo'?'Aguardando cartão…':'Verificando acesso…'}</Text><Botao title={fase==='lendo'?'Cancelar leitura':'Cancelar verificação'} secondary onPress={interromper}/></>}
      <Botao title={opcoes?'Fechar opções da demonstração':'Opções da demonstração'} secondary disabled={busy} onPress={()=>{setOpcoes(!opcoes);setCamera(false);}}/>
      {opcoes&&<View style={s.card}>
        <Text style={s.text}>Teste sem hardware usando um cartão preparado pelo responsável.</Text>
        <Botao title="Ler QR Code" secondary disabled={busy} onPress={()=>{setManual(false);setCamera(true);}}/>
        <Botao title="Digitar ou colar código" secondary disabled={busy} onPress={()=>{setCamera(false);setManual(true);}}/>
        {cartaoDemonstracao?<Botao title="Usar exemplo preparado" secondary disabled={busy} onPress={()=>{setTexto(JSON.stringify(cartaoDemonstracao));setManual(true);setCamera(false);}}/>:<Text style={s.text}>Para preparar um exemplo, peça ao responsável para emitir um cartão.</Text>}
        {camera&&<LeitorQr onClose={()=>setCamera(false)} onManual={()=>{setCamera(false);setManual(true);}} onRead={data=>{setCamera(false);void entrar(async()=>data);}}/>}
        {manual&&<><Campo label="Código do cartão" value={texto} onChangeText={setTexto} multiline style={{minHeight:120}} editable={!busy}/><Botao title="Entrar com o código" disabled={busy} onPress={()=>void entrar(async()=>texto)}/></>}
      </View>}
    </>}
    {aviso&&<Text accessibilityLiveRegion="polite" style={s.text}>{aviso}</Text>}<Aviso texto={erro}/>
  </View>;
}
