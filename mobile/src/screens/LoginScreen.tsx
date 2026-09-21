import React,{useEffect,useRef,useState} from 'react';
import { Platform,Text,View,Switch } from 'react-native';
import { Botao,Campo,Aviso } from '../components/Ui';
import { LeitorQr } from '../components/LeitorQr';
import { useOperacao } from '../components/useOperacao';
import { criarApi,erroCancelado,mensagemErro } from '../services/api.service';
import { Chip,Desafio,Sessao,lerIdentidade,normalizarCpf } from '../services/identidade';
import { cancelarNfc,lerNfc } from '../services/nfc.service';
import { disponibilidadeBiometria,lerCredencialBiometrica,guardarCredencialBiometrica } from '../services/biometria.service';
import { feedback,falar,pararAudio } from '../services/feedback';
import { styles as s } from '../theme';

type Props={url:string;onSuccess:(data:Sessao)=>void;cartaoDemonstracao?:Chip|null;mensagem?:string};
export function LoginScreen({url,onSuccess,cartaoDemonstracao,mensagem=''}:Props) {
  const [cpf,setCpf]=useState(cartaoDemonstracao?.cpf||''),[texto,setTexto]=useState('');
  const [etapa,setEtapa]=useState<1|2|3>(1),[opcoes,setOpcoes]=useState(false),[manual,setManual]=useState(false),[camera,setCamera]=useState(false);
  const [fase,setFase]=useState<'parado'|'lendo'|'verificando'>('parado'),[erro,setErro]=useState(''),[aviso,setAviso]=useState(mensagem);
  const [desafio,setDesafio]=useState<(Desafio&{emissaoId:string})|null>(null),[pin,setPin]=useState(''),[usarPin,setUsarPin]=useState(false);
  const [biometria,setBiometria]=useState(false),[registrar,setRegistrar]=useState(false),[sessaoPronta,setSessaoPronta]=useState<Sessao|null>(null);
  const ocupado=useRef(false),{iniciar,vigente,cancelar}=useOperacao();
  const busy=fase!=='parado';
  useEffect(()=>{
    let ativo=true;
    falar(mensagem||'Bem-vindo. Digite seu CPF. Depois, leia seu cartão.');
    void disponibilidadeBiometria().then(r=>{if(ativo){setBiometria(r.disponivel);setUsarPin(!r.disponivel);}});
    return()=>{ativo=false;void cancelarNfc();pararAudio();};
  },[url,mensagem]);
  function continuar(){
    if(!/^\d{11}$/.test(normalizarCpf(cpf))){setErro('Informe os 11 números do CPF para continuar.');falar('Informe os onze números do CPF para continuar.');return;}
    setErro('');setAviso('');setEtapa(2);falar('Agora leia seu cartão. Para testar sem cartão físico, abra as opções da demonstração.');
  }
  function interromper(){cancelar();ocupado.current=false;setFase('parado');void cancelarNfc();setAviso('Operação cancelada. Você pode tentar novamente.');}
  function reler(){interromper();setDesafio(null);setPin('');setRegistrar(false);setSessaoPronta(null);setEtapa(2);setErro('');setAviso('Leia seu cartão para começar novamente.');}
  async function entrar(origem:()=>Promise<string>,nfc=false){
    if(ocupado.current)return;
    ocupado.current=true;const controle=iniciar();setErro('');setAviso('');setFase(nfc?'lendo':'verificando');
    try{
      const conteudo=await origem();if(!vigente(controle))return;
      const chip=lerIdentidade(conteudo,cpf);
      setFase('verificando');const data=await criarApi(url).entrar(cpf,conteudo,controle.signal);
      if(!vigente(controle))return;
      setDesafio({...data,emissaoId:chip.emissaoId});setEtapa(3);setPin('');setUsarPin(!biometria);
      falar('Cartão conferido. Confirme seu acesso com a biometria deste aparelho ou seu PIN.');
    }catch(e){if(vigente(controle)&&!erroCancelado(e)){const msg=mensagemErro(e);setErro(msg);feedback(msg,false);}}
    finally{if(vigente(controle)){ocupado.current=false;setFase('parado');}}
  }
  async function confirmar(comBiometria:boolean){
    if(ocupado.current||!desafio)return;
    if(!comBiometria&&!/^\d{6}$/.test(pin)){setErro('Informe seu PIN de 6 números.');return;}
    if(Date.now()>=desafio.expiraEm){setErro('Esta confirmação expirou. Toque em Ler cartão novamente.');return;}
    ocupado.current=true;const controle=iniciar();setErro('');setAviso('');setFase('verificando');
    try{
      let credencial:string|undefined;
      if(comBiometria){
        const leitura=await lerCredencialBiometrica(url,desafio.emissaoId);
        if(!vigente(controle))return;
        if(!leitura.credencial){setUsarPin(true);setAviso(leitura.mensagem||'Use o PIN para continuar.');return;}
        credencial=leitura.credencial;
      }
      const resposta=await criarApi(url).confirmar(comBiometria?{desafioId:desafio.desafioId,credencialDispositivo:credencial}:{desafioId:desafio.desafioId,pin,registrarDispositivo:registrar&&biometria},controle.signal);
      if(!vigente(controle))return;
      const {credencialDispositivo,...sessao}=resposta;
      setPin('');
      if(credencialDispositivo){
        const salva=await guardarCredencialBiometrica(url,desafio.emissaoId,credencialDispositivo);
        if(!vigente(controle))return;
        if(!salva){setSessaoPronta(sessao);setAviso('PIN confirmado. Não foi possível habilitar a biometria. Nos próximos acessos, use seu PIN.');return;}
      }
      feedback('Acesso liberado.',true);onSuccess(sessao);
    }catch(e){if(vigente(controle)&&!erroCancelado(e)){if(comBiometria)setUsarPin(true);const msg=mensagemErro(e);setErro(msg);feedback(msg,false);}}
    finally{if(vigente(controle)){ocupado.current=false;setFase('parado');}}
  }
  return <View style={{gap:20}}>
    <Text style={s.text}>Passo {etapa} de 3</Text>
    <Text style={s.title}>{etapa===1?'Informe seu CPF':etapa===2?'Leia seu cartão':'Confirme seu acesso'}</Text>
    <Botao title="Ouvir instruções" secondary onPress={()=>falar(etapa===1?'Digite os onze números do CPF e toque em continuar.':etapa===2?'Aproxime o cartão do celular. Ou abra as opções da demonstração para usar QR Code ou texto.':'Confirme com a biometria habilitada neste aparelho ou informe o PIN de seis números criado na emissão do cartão.')}/>
    {etapa===1?<>
      {cartaoDemonstracao&&<Text style={s.text}>Cartão de demonstração preparado. Confira o CPF e continue.</Text>}
      <Campo label="Seu CPF" value={cpf} onChangeText={setCpf} keyboardType="number-pad" maxLength={14}/>
      <Botao title="Continuar" onPress={continuar}/>
    </>:etapa===2?<>
      <Text style={s.text}>CPF informado: ***.***.***-{normalizarCpf(cpf).slice(-2)}</Text>
      <Botao title="Corrigir CPF" secondary disabled={busy} onPress={()=>{setCamera(false);setEtapa(1);setErro('');}}/>
      {cartaoDemonstracao&&<Botao title="Entrar com o cartão preparado" disabled={busy||camera} onPress={()=>void entrar(async()=>JSON.stringify(cartaoDemonstracao))}/>}
      {Platform.OS!=='web'&&<Botao title="Aproximar cartão" disabled={busy||camera} onPress={()=>void entrar(lerNfc,true)}/>}
      {Platform.OS==='web'&&<Text style={s.text}>Neste navegador, use QR Code ou texto nas opções abaixo.</Text>}
      <Botao title={opcoes?'Fechar opções da demonstração':'Opções da demonstração'} secondary disabled={busy} onPress={()=>{setOpcoes(!opcoes);setCamera(false);}}/>
      {opcoes&&<View style={s.card}>
        <Text style={s.text}>Teste sem hardware usando um cartão preparado pelo responsável.</Text>
        <Botao title="Ler QR Code" secondary disabled={busy} onPress={()=>{setManual(false);setCamera(true);}}/>
        <Botao title="Digitar ou colar código" secondary disabled={busy} onPress={()=>{setCamera(false);setManual(true);}}/>
        {cartaoDemonstracao?<Botao title="Usar exemplo preparado" secondary disabled={busy} onPress={()=>{setTexto(JSON.stringify(cartaoDemonstracao));setManual(true);setCamera(false);}}/>:<Text style={s.text}>Para preparar um exemplo, peça ao responsável para emitir um cartão.</Text>}
        {camera&&<LeitorQr onClose={()=>setCamera(false)} onManual={()=>{setCamera(false);setManual(true);}} onRead={data=>{setCamera(false);void entrar(async()=>data);}}/>}
        {manual&&<><Campo label="Código do cartão" value={texto} onChangeText={setTexto} multiline style={{minHeight:120}} editable={!busy}/><Botao title="Entrar com o código" disabled={busy} onPress={()=>void entrar(async()=>texto)}/></>}
      </View>}
    </>:<>
      <Text style={s.text}>A biometria confirma o uso deste aparelho. Ela não comprova que pertence ao CPF informado.</Text>
      {sessaoPronta?<Botao title="Continuar para meu acesso" onPress={()=>{feedback('Acesso liberado.',true);onSuccess(sessaoPronta);}}/>:<>
        {biometria?<>
          <Botao title="Confirmar com biometria" disabled={busy} onPress={()=>void confirmar(true)}/>
          <Botao title="Usar PIN" secondary disabled={busy} onPress={()=>{setUsarPin(true);setErro('');}}/>
        </>:<Text style={s.text}>Biometria indisponível ou não configurada. Use seu PIN para continuar.</Text>}
        {usarPin&&<View style={s.card}>
          <Text style={s.text}>Use o PIN criado na emissão do cartão. Se esqueceu, peça uma segunda via ao responsável.</Text>
          <Campo label="PIN de 6 números" value={pin} onChangeText={v=>setPin(v.replace(/\D/g,''))} keyboardType="number-pad" maxLength={6} secureTextEntry editable={!busy}/>
          {biometria&&<View><Text style={s.label}>Habilitar biometria neste aparelho</Text><Text style={s.text}>Ative somente em um celular de confiança. Nos acessos com biometria, o sistema do aparelho pedirá a confirmação.</Text><Switch accessibilityLabel="Habilitar biometria neste aparelho" value={registrar} onValueChange={setRegistrar} disabled={busy}/></View>}
          <Botao title="Confirmar PIN" disabled={busy} onPress={()=>void confirmar(false)}/>
        </View>}
      </>}
      <Botao title="Ler cartão novamente" secondary disabled={busy} onPress={reler}/>
    </>}
    {busy&&<><Text style={s.label} accessibilityLiveRegion="polite">{fase==='lendo'?'Aguardando cartão…':'Verificando acesso…'}</Text><Botao title={fase==='lendo'?'Cancelar leitura':'Cancelar verificação'} secondary onPress={interromper}/></>}
    {aviso&&<Text accessibilityLiveRegion="polite" style={s.text}>{aviso}</Text>}<Aviso texto={erro}/>
  </View>;
}
