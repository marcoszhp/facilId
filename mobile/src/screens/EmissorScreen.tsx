import React,{useEffect,useRef,useState} from 'react';
import { Platform,Text,View,useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Botao,Campo,Aviso } from '../components/Ui';
import { useOperacao } from '../components/useOperacao';
import { criarApi,erroCancelado,erroNaoAutorizado,mensagemErro } from '../services/api.service';
import { Chip,ResumoCartao } from '../services/identidade';
import { gravarNfc,cancelarNfc } from '../services/nfc.service';
import { falar,feedback,pararAudio } from '../services/feedback';
import { styles as s } from '../theme';
export function EmissorScreen({url,onUseCard}:{url:string;onUseCard:(chip:Chip)=>void}) {
  const {width}=useWindowDimensions();
  const [nome,setNome]=useState(''),[cpf,setCpf]=useState(''),[idade,setIdade]=useState('');
  const [credencial,setCredencial]=useState(''),[autorizado,setAutorizado]=useState(false),[cartoes,setCartoes]=useState<ResumoCartao[]>([]),[cartao,setCartao]=useState<Chip|null>(null);
  const [erro,setErro]=useState(''),[busy,setBusy]=useState(false),[gravando,setGravando]=useState(false),[notice,setNotice]=useState('');
  const ocupado=useRef(false),{iniciar,vigente,cancelar}=useOperacao();
  const json=cartao?JSON.stringify(cartao):'';
  useEffect(()=>{falar('Área do responsável. Informe a credencial fornecida pelo professor.');return()=>{void cancelarNfc();pararAudio();};},[]);
  async function executar(action:(controle:AbortController)=>Promise<void>){
    if(ocupado.current)return;
    ocupado.current=true;const controle=iniciar();setBusy(true);setErro('');setNotice('');
    try{await action(controle);}
    catch(e){if(vigente(controle)&&!erroCancelado(e)){
      if(erroNaoAutorizado(e)){setAutorizado(false);setCredencial('');setCartoes([]);setCartao(null);}
      const msg=mensagemErro(e);setErro(msg);feedback(msg,false);
    }}finally{if(vigente(controle)){ocupado.current=false;setBusy(false);setGravando(false);}}
  }
  function encerrar(){cancelar();ocupado.current=false;setBusy(false);setGravando(false);void cancelarNfc();setAutorizado(false);setCredencial('');setCartao(null);setCartoes([]);setErro('');setNotice('Acesso do responsável encerrado.');}
  async function atualizar(controle:AbortController){const lista=await criarApi(url).usuarios(credencial,controle.signal);if(vigente(controle))setCartoes(lista);}
  return <View style={{gap:20}}>
    <Text style={s.title}>Área do responsável</Text>
    {!autorizado?<>
      <Text style={s.text}>A emissão e a gestão de cartões exigem a credencial fornecida pelo professor. Ela fica apenas na memória durante este acesso.</Text>
      <Campo label="Credencial do responsável" value={credencial} onChangeText={setCredencial} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy}/>
      <Botao title={busy?'Verificando credencial…':'Acessar área do responsável'} disabled={busy} onPress={()=>void executar(async controle=>{
        if(!credencial.trim())throw new Error('Informe a credencial do responsável.');
        const lista=await criarApi(url).usuarios(credencial,controle.signal);if(!vigente(controle))return;
        setCartoes(lista);setAutorizado(true);falar('Acesso do responsável liberado. Preencha nome, CPF e idade para emitir um cartão fictício.');
      })}/>
    </>:<>
      <Botao title="Encerrar acesso do responsável" secondary onPress={encerrar}/>
      <Text style={s.title}>Emitir cartão</Text>
      <Text style={s.text}>Use somente dados fictícios. Emitir novamente para o mesmo CPF substitui o cartão anterior e encerra os acessos associados a ele.</Text>
      <Botao title="Ouvir instruções" secondary onPress={()=>falar('Preencha nome, CPF e idade. Toque em gerar cartão. Depois, use este cartão na demonstração.')}/>
      <Campo label="Nome" value={nome} onChangeText={setNome} editable={!busy}/><Campo label="CPF" value={cpf} onChangeText={setCpf} keyboardType="number-pad" maxLength={14} editable={!busy}/><Campo label="Idade" value={idade} onChangeText={setIdade} keyboardType="number-pad" maxLength={3} editable={!busy}/>
      <Botao title={busy?'Aguarde…':'Gerar cartão'} disabled={busy} onPress={()=>void executar(async controle=>{
        if(!/^\d{1,3}$/.test(idade))throw new Error('Informe a idade em números.');
        const emitido=await criarApi(url).emitir({nome,cpf,idade:Number(idade)},credencial,controle.signal);if(!vigente(controle))return;
        setCartao(emitido);feedback('Cartão gerado.',true);await atualizar(controle);
      })}/>
      {cartao&&<View style={s.card}>
        <Text style={s.label}>Seu cartão de demonstração</Text>
        <Botao title="Usar este cartão na demonstração" disabled={busy} onPress={()=>onUseCard(cartao)}/>
        <View accessible accessibilityLabel="QR Code do cartão. O mesmo código está no campo abaixo." style={{alignItems:'center'}}><QRCode value={json} size={Math.min(240,Math.max(100,width-128))} quietZone={12}/></View>
        <Campo label="Código para testar em outro aparelho" value={json} multiline editable={false} selectTextOnFocus style={{minHeight:160}}/>
        {Platform.OS!=='web'&&<Botao title="Gravar na tag NFC" disabled={busy} onPress={()=>void executar(async controle=>{
          setGravando(true);await gravarNfc(json);if(!vigente(controle))return;
          setNotice('Cartão gravado.');feedback('Cartão gravado.',true);
        })}/>}
        {gravando&&<><Text style={s.text} accessibilityLiveRegion="polite">Aguardando cartão para gravar…</Text><Botao title="Cancelar gravação" secondary onPress={()=>{cancelar();ocupado.current=false;setBusy(false);setGravando(false);void cancelarNfc();setNotice('Gravação cancelada.');}}/></>}
        <Text style={s.text}>A assinatura exige espaço suficiente na tag NDEF. Tags NTAG213/215 são pequenas para este formato. QR Code e texto funcionam sem hardware.</Text>
      </View>}
      <Text style={s.title}>Cartões emitidos</Text>
      <Botao title="Atualizar lista" secondary disabled={busy} onPress={()=>void executar(atualizar)}/>
      {!cartoes.length&&<Text style={s.text}>Nenhum cartão emitido nesta versão. Se você tinha um cartão antigo, emita uma nova via.</Text>}
      {cartoes.map(item=><View key={item.emissaoId} style={s.card}>
        <Text style={s.label}>{item.nome}</Text><Text style={s.text}>CPF: ***.***.***-{item.cpf.slice(-2)} • {item.estado==='substituido'?'substituído':item.estado}</Text>
        {item.estado==='ativo'&&<>
          <Botao title={`Preparar demonstração de ${item.nome}`} secondary disabled={busy} onPress={()=>void executar(async controle=>{
            const escolhido=await criarApi(url).cartao(item.emissaoId,credencial,controle.signal);if(!vigente(controle))return;
            setCartao(escolhido);setNotice('Cartão preparado. Use o botão de demonstração acima.');
          })}/>
          <Botao title={`Bloquear cartão de ${item.nome}`} secondary disabled={busy} onPress={()=>void executar(async controle=>{
            await criarApi(url).bloquear(item.emissaoId,credencial,controle.signal);if(!vigente(controle))return;
            if(cartao?.emissaoId===item.emissaoId)setCartao(null);
            setNotice('Cartão bloqueado. O acesso com esse cartão foi encerrado.');await atualizar(controle);
          })}/>
        </>}
      </View>)}
    </>}
    <Aviso texto={erro}/>{notice&&<Text accessibilityLiveRegion="polite" style={s.text}>{notice}</Text>}
  </View>;
}

