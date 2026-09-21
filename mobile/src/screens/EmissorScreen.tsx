import React,{useEffect,useRef,useState} from 'react';
import { Image,Platform,Text,View,useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Botao,Campo,Aviso } from '../components/Ui';
import { useOperacao } from '../components/useOperacao';
import { AssinaturaManuscrita } from '../components/AssinaturaManuscrita';
import { CapturaFoto,FotoCapturada } from '../components/CapturaFoto';
import { AssinaturaDesenhada } from '../services/desenho-assinatura';
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
  const [modo,setModo]=useState<'real'|'demonstracao'>('real'),[consentimento,setConsentimento]=useState(false),[capturando,setCapturando]=useState(false);
  const [foto,setFoto]=useState<FotoCapturada|null>(null),[fotoId,setFotoId]=useState<string|undefined>(),[assinatura,setAssinatura]=useState<AssinaturaDesenhada|null>(null),[edicao,setEdicao]=useState(0);
  const [pin,setPin]=useState(''),[confirmacaoPin,setConfirmacaoPin]=useState('');
  const ocupado=useRef(false),{iniciar,vigente,cancelar}=useOperacao();
  const json=cartao?JSON.stringify(cartao):'';
  useEffect(()=>{falar('Área do responsável. Informe a credencial fornecida pelo professor.');return()=>{void cancelarNfc();pararAudio();};},[]);
  async function executar(action:(controle:AbortController)=>Promise<void>){
    if(ocupado.current)return;
    ocupado.current=true;const controle=iniciar();setBusy(true);setErro('');setNotice('');
    try{await action(controle);}
    catch(e){if(vigente(controle)&&!erroCancelado(e)){
      if(erroNaoAutorizado(e)){setAutorizado(false);setCredencial('');setCartoes([]);setCartao(null);limparCapturas();}
      const msg=mensagemErro(e);setErro(msg);feedback(msg,false);
    }}finally{if(vigente(controle)){ocupado.current=false;setBusy(false);setGravando(false);}}
  }
  function limparCapturas(){setCapturando(false);setFoto(null);setFotoId(undefined);setAssinatura(null);setEdicao(valor=>valor+1);setPin('');setConfirmacaoPin('');setConsentimento(false);}
  function mudarModo(proximo:'real'|'demonstracao'){limparCapturas();setModo(proximo);setErro('');setNotice('');}
  function encerrar(){cancelar();ocupado.current=false;setBusy(false);setGravando(false);void cancelarNfc();setAutorizado(false);setCredencial('');setCartao(null);setCartoes([]);limparCapturas();setNome('');setCpf('');setIdade('');setErro('');setNotice('Acesso do responsável encerrado.');}
  async function atualizar(controle:AbortController){const lista=await criarApi(url).usuarios(credencial,controle.signal);if(vigente(controle))setCartoes(lista);}
  return <View style={{gap:20}}>
    <Text style={s.title}>Área do responsável</Text>
    {!autorizado?<>
      <Text style={s.text}>A emissão e a gestão de cartões exigem a credencial fornecida pelo professor. Ela fica apenas na memória durante este acesso.</Text>
      <Campo label="Credencial do responsável" value={credencial} onChangeText={setCredencial} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy}/>
      <Botao title={busy?'Verificando credencial…':'Acessar área do responsável'} disabled={busy} onPress={()=>void executar(async controle=>{
        if(!credencial.trim())throw new Error('Informe a credencial do responsável.');
        const lista=await criarApi(url).usuarios(credencial,controle.signal);if(!vigente(controle))return;
        setCartoes(lista);setAutorizado(true);falar('Acesso do responsável liberado. Escolha a coleta autorizada ou o modo demonstração sem câmera.');
      })}/>
    </>:<>
      <Botao title="Encerrar acesso do responsável" secondary onPress={encerrar}/>
      <Text style={s.title}>Emitir cartão</Text>
      <Text style={s.text}>Use CPF fictício nos testes. A coleta real exige uma pessoa voluntária que concorde. Nunca fotografe terceiros sem autorização. Emitir novamente para o mesmo CPF substitui o cartão anterior.</Text>
      <Text style={s.label}>{modo==='real'?'Modo: coleta autorizada de foto e assinatura':'Modo: demonstração com dados fictícios'}</Text>
      <Botao title={modo==='real'?'Usar modo demonstração sem câmera':'Usar coleta autorizada de foto e assinatura'} secondary disabled={busy} onPress={()=>mudarModo(modo==='real'?'demonstracao':'real')}/>
      <Botao title="Ouvir instruções" secondary onPress={()=>falar('Preencha nome, CPF e idade. Na coleta autorizada, confirme o consentimento antes de tirar a foto e desenhar a assinatura. Escolha um PIN com seis números e confirme. A demonstração também funciona sem câmera.')}/>
      <Campo label="Nome" value={nome} onChangeText={setNome} editable={!busy}/><Campo label="CPF" value={cpf} onChangeText={setCpf} keyboardType="number-pad" maxLength={14} editable={!busy}/><Campo label="Idade" value={idade} onChangeText={setIdade} keyboardType="number-pad" maxLength={3} editable={!busy}/>
      {modo==='real'&&<View style={s.card}>
        <Text style={s.text}>A foto e o desenho da assinatura serão guardados no servidor deste protótipo, com acesso restrito. Eles não reconhecem o rosto nem comprovam a autoria. A participação é voluntária; você pode usar a demonstração sem coleta real.</Text>
        {!consentimento?<Botao title="Concordo com a captura para esta demonstração" disabled={busy} onPress={()=>setConsentimento(true)}/>:<>
          <Text style={s.text} accessibilityLiveRegion="polite">Consentimento confirmado para esta emissão.</Text>
          <Botao title="Cancelar coleta autorizada" secondary disabled={busy} onPress={limparCapturas}/>
          {capturando?<CapturaFoto onCancel={()=>setCapturando(false)} onConfirm={capturada=>{setFoto(capturada);setFotoId(undefined);setCapturando(false);}}/>:<>
            {foto&&<><Image accessibilityLabel="Foto confirmada para esta emissão" source={{uri:`data:${foto.mimeType};base64,${foto.base64}`}} style={{width:'100%',height:180}} resizeMode="contain"/><Text style={s.text}>Foto confirmada. Ela será enviada ao gerar o cartão.</Text></>}
            <Botao title={foto?'Refazer foto do cadastro':'Capturar foto do rosto'} disabled={busy} onPress={()=>{setFoto(null);setFotoId(undefined);setAssinatura(null);setEdicao(valor=>valor+1);setCapturando(true);}}/>
          </>}
        </>}
      </View>}
      {modo==='demonstracao'&&<Text style={s.text}>Sem foto real: o sistema usará uma imagem de exemplo identificada como fictícia. Você pode desenhar ou usar uma assinatura fictícia. Isso não cadastra nem reconhece um rosto.</Text>}
      {(modo==='demonstracao'||consentimento)&&!capturando&&<AssinaturaManuscrita key={edicao} disabled={busy} demonstracao={modo==='demonstracao'} onConfirm={setAssinatura} onClear={()=>setAssinatura(null)}/>}
      <Campo label="PIN de acesso (6 números)" value={pin} onChangeText={valor=>setPin(valor.replace(/\D/g,''))} secureTextEntry keyboardType="number-pad" maxLength={6} autoComplete="off" editable={!busy}/>
      <Campo label="Confirme o PIN" value={confirmacaoPin} onChangeText={valor=>setConfirmacaoPin(valor.replace(/\D/g,''))} secureTextEntry keyboardType="number-pad" maxLength={6} autoComplete="off" editable={!busy}/>
      <Text style={s.text}>Guarde seu PIN. Ele não aparece no cartão e permite entrar quando a biometria do aparelho não estiver disponível.</Text>
      <Botao title={busy?'Aguarde…':'Gerar cartão'} disabled={busy} onPress={()=>void executar(async controle=>{
        if(!/^\d{1,3}$/.test(idade))throw new Error('Informe a idade em números.');
        if(!/^\d{6}$/.test(pin))throw new Error('Escolha um PIN com 6 números.');
        if(pin!==confirmacaoPin)throw new Error('Os PINs não conferem. Digite os mesmos 6 números nos dois campos.');
        if(modo==='real'&&!consentimento)throw new Error('Confirme o consentimento para coletar foto e assinatura, ou use o modo demonstração.');
        if(modo==='real'&&!foto)throw new Error('Capture e confirme a foto antes de gerar o cartão.');
        if(!assinatura)throw new Error('Desenhe e confirme a assinatura antes de gerar o cartão.');
        const api=criarApi(url);let referencia=fotoId;
        if(modo==='real'&&foto&&!referencia){
          const enviada=await api.foto(foto.base64,foto.mimeType,credencial,controle.signal);if(!vigente(controle))return;
          referencia=enviada.id;setFotoId(referencia);
        }
        const emitido=await api.emitir({nome,cpf,idade:Number(idade),modo,assinatura,pin,...(modo==='real'?{fotoId:referencia,consentimento:true}:{})},credencial,controle.signal);if(!vigente(controle))return;
        setCartao(emitido);limparCapturas();setNome('');setCpf('');setIdade('');feedback('Cartão gerado. Guarde o PIN escolhido.',true);await atualizar(controle);
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

