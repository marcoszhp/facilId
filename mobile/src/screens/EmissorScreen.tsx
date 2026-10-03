import React,{useEffect,useRef,useState} from 'react';
import { Image,Platform,Text,View,useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Botao,Campo,Aviso } from '../components/Ui';
import { useOperacao } from '../components/useOperacao';
import { AssinaturaManuscrita } from '../components/AssinaturaManuscrita';
import { CapturaFoto,FotoCapturada } from '../components/CapturaFoto';
import { AtendimentosAdmin } from '../components/AtendimentosAdmin';
import { EventosAdmin } from '../components/EventosAdmin';
import { AssinaturaDesenhada } from '../services/desenho-assinatura';
import { criarApi,erroCancelado,erroNaoAutorizado,mensagemErro } from '../services/api.service';
import { Chip,DadosEmissao,ResumoCartao,normalizarCpf } from '../services/identidade';
import { gravarNfc,cancelarNfc } from '../services/nfc.service';
import { falar,feedback,pararAudio } from '../services/feedback';
import { styles as s } from '../theme';
import { filtrarCartoes,FiltroEstadoCartao } from '../services/filtro-cartoes';
type CampoEmissao='nome'|'cpf'|'idade'|'consentimento'|'foto'|'assinatura'|'pin'|'confirmacaoPin';
type ErrosEmissao=Partial<Record<CampoEmissao,string>>;
type AcaoConfirmavel={tipo:'emitir';dados:DadosEmissao;foto:FotoCapturada|null}|{tipo:'bloquear';cartao:ResumoCartao};
export function EmissorScreen({url,onUseCard}:{url:string;onUseCard:(chip:Chip)=>void}) {
  const {width}=useWindowDimensions();
  const [buscaCartoes,setBuscaCartoes]=useState(''),[estadoCartoes,setEstadoCartoes]=useState<FiltroEstadoCartao>('todos');
  const [etapa,setEtapa]=useState<1|2|3>(1),[errosCampos,setErrosCampos]=useState<ErrosEmissao>({}),[erroEmissao,setErroEmissao]=useState('');
  const [nome,setNome]=useState(''),[cpf,setCpf]=useState(''),[idade,setIdade]=useState('');
  const [credencial,setCredencial]=useState(''),[autorizado,setAutorizado]=useState(false),[cartoes,setCartoes]=useState<ResumoCartao[]>([]),[cartao,setCartao]=useState<Chip|null>(null);
  const [erro,setErro]=useState(''),[busy,setBusy]=useState(false),[gravando,setGravando]=useState(false),[notice,setNotice]=useState('');
  const [modo,setModo]=useState<'real'|'demonstracao'>('real'),[consentimento,setConsentimento]=useState(false),[capturando,setCapturando]=useState(false);
  const [foto,setFoto]=useState<FotoCapturada|null>(null),[fotoId,setFotoId]=useState<string|undefined>(),[assinatura,setAssinatura]=useState<AssinaturaDesenhada|null>(null),[edicao,setEdicao]=useState(0);
  const [pin,setPin]=useState(''),[confirmacaoPin,setConfirmacaoPin]=useState('');
  const [confirmacao,setConfirmacao]=useState<AcaoConfirmavel|null>(null),acaoPendente=useRef<AcaoConfirmavel|null>(null);
  const ocupado=useRef(false),{iniciar,vigente,cancelar}=useOperacao();
  const bloqueado=busy||!!confirmacao;
  const json=cartao?JSON.stringify(cartao):'';
  const cartoesVisiveis=filtrarCartoes(cartoes,buscaCartoes,estadoCartoes);
  function limparFiltros(){setBuscaCartoes('');setEstadoCartoes('todos');}
  useEffect(()=>{falar('Área do responsável. Informe a credencial fornecida pelo professor.');return()=>{acaoPendente.current=null;void cancelarNfc();pararAudio();};},[]);
  async function executar(action:(controle:AbortController)=>Promise<void>,emissao=false){
    if(ocupado.current)return;
    ocupado.current=true;const controle=iniciar();setBusy(true);setErro('');setErroEmissao('');setNotice('');
    try{await action(controle);}
    catch(e){if(vigente(controle)&&!erroCancelado(e)){
      if(erroNaoAutorizado(e)){limparFiltros();setAutorizado(false);setCredencial('');setCartoes([]);setCartao(null);limparCapturas();}
      const msg=mensagemErro(e);if(emissao&&!erroNaoAutorizado(e))setErroEmissao(msg);else setErro(msg);feedback(msg,false);
    }}finally{if(vigente(controle)){ocupado.current=false;setBusy(false);setGravando(false);}}
  }
  function limparConfirmacao(){acaoPendente.current=null;setConfirmacao(null);}
  function limparCapturas(){limparConfirmacao();setEtapa(1);setErrosCampos({});setErroEmissao('');setCapturando(false);setFoto(null);setFotoId(undefined);setAssinatura(null);setEdicao(valor=>valor+1);setPin('');setConfirmacaoPin('');setConsentimento(false);}
  function mudarModo(proximo:'real'|'demonstracao'){limparCapturas();setModo(proximo);setErro('');setNotice('');}
  function encerrar(){limparFiltros();cancelar();ocupado.current=false;setBusy(false);setGravando(false);void cancelarNfc();setAutorizado(false);setCredencial('');setCartao(null);setCartoes([]);limparCapturas();setNome('');setCpf('');setIdade('');setErro('');setNotice('Acesso do responsável encerrado.');}
  async function atualizar(controle:AbortController){const lista=await criarApi(url).usuarios(credencial,controle.signal);if(vigente(controle))setCartoes(lista);}
  function descricaoConfirmacao(acao:AcaoConfirmavel){
    const pessoa=acao.tipo==='emitir'?acao.dados:acao.cartao;
    const identidade=`${pessoa.nome}, CPF: ***.***.***-${normalizarCpf(pessoa.cpf).slice(-2)}.`;
    return acao.tipo==='emitir'
      ?`Gerar cartão para ${identidade} Qualquer cartão anterior deste CPF será substituído e deixará de permitir acesso. Confirme também se esta for a primeira emissão.${acao.dados.modo==='real'?' A foto e a assinatura confirmadas serão enviadas ao servidor.':''}`
      :`Bloquear o cartão de ${identidade} O acesso com este cartão será encerrado. A pessoa precisará de uma nova emissão para entrar novamente.`;
  }
  function pedirConfirmacao(acao:AcaoConfirmavel){
    if(acaoPendente.current)return;
    acaoPendente.current=acao;setConfirmacao(acao);setErro('');setNotice('');falar(descricaoConfirmacao(acao));
  }
  function limparErro(campo:CampoEmissao){setErrosCampos(anteriores=>({...anteriores,[campo]:undefined}));setErroEmissao('');}
  function errosDaEtapa(numero:1|2|3):ErrosEmissao{
    const erros:ErrosEmissao={};
    if(numero===1){
      if(nome.trim().length<2||nome.trim().length>100)erros.nome='Nome: informe entre 2 e 100 caracteres.';
      if(!/^\d{11}$/.test(normalizarCpf(cpf)))erros.cpf='CPF: informe os 11 números.';
      if(!/^\d{1,3}$/.test(idade)||Number(idade)>130)erros.idade='Idade: informe um número de 0 a 130.';
      if(modo==='real'&&!consentimento)erros.consentimento='Confirme o consentimento para coletar foto e assinatura, ou use o modo demonstração.';
    }else if(numero===2){
      if(modo==='real'&&!foto)erros.foto='Capture e confirme a foto antes de gerar o cartão.';
      if(!assinatura)erros.assinatura='Desenhe e confirme a assinatura antes de gerar o cartão.';
    }else{
      if(!/^\d{6}$/.test(pin))erros.pin='Escolha um PIN com 6 números.';
      if(pin!==confirmacaoPin||!confirmacaoPin)erros.confirmacaoPin='Os PINs não conferem. Digite os mesmos 6 números nos dois campos.';
    }
    return erros;
  }
  function validar(numero:1|2|3){
    const erros=errosDaEtapa(numero);setErrosCampos(erros);
    if(Object.keys(erros).length){setEtapa(numero);feedback(Object.values(erros)[0]!,false);return false;}
    return true;
  }
  function avancar(numero:1|2){if(bloqueado||!validar(numero))return;setEtapa(numero===1?2:3);setErroEmissao('');}
  function voltar(numero:1|2){if(bloqueado)return;setCapturando(false);setEtapa(numero);setErroEmissao('');}
  function pedirEmissao(){
    if(ocupado.current||acaoPendente.current)return;
    setErro('');setErroEmissao('');setNotice('');
    if(!validar(1)||!validar(2)||!validar(3)||!assinatura)return;
    pedirConfirmacao({tipo:'emitir',dados:{nome:nome.trim(),cpf,idade:Number(idade),modo,assinatura,pin,...(modo==='real'?{fotoId,consentimento:true}:{})},foto});
  }
  function confirmarAcao(){
    const acao=acaoPendente.current;
    if(!acao||ocupado.current)return;
    limparConfirmacao();
    void executar(async controle=>{
      const api=criarApi(url);
      if(acao.tipo==='bloquear'){
        await api.bloquear(acao.cartao.emissaoId,credencial,controle.signal);if(!vigente(controle))return;
        if(cartao?.emissaoId===acao.cartao.emissaoId)setCartao(null);
        setNotice('Cartão bloqueado. O acesso com esse cartão foi encerrado.');await atualizar(controle);return;
      }
      let referencia=acao.dados.fotoId;
      if(acao.dados.modo==='real'&&acao.foto&&!referencia){
        const enviada=await api.foto(acao.foto.base64,acao.foto.mimeType,credencial,controle.signal);if(!vigente(controle))return;
        referencia=enviada.id;setFotoId(referencia);
      }
      const emitido=await api.emitir({...acao.dados,...(acao.dados.modo==='real'?{fotoId:referencia}:{})},credencial,controle.signal);if(!vigente(controle))return;
      setCartao(emitido);limparCapturas();setNome('');setCpf('');setIdade('');feedback('Cartão gerado. Guarde o PIN escolhido.',true);
      try{await atualizar(controle);}catch(e){
        if(!vigente(controle)||erroCancelado(e))return;
        if(erroNaoAutorizado(e))throw e;
        const msg='Cartão gerado, mas não foi possível atualizar a lista. Use Atualizar lista para tentar novamente. Não é necessário gerar o cartão outra vez.';
        setErro(msg);feedback(msg,false);
      }
    },acao.tipo==='emitir');
  }
  const painelConfirmacao=confirmacao&&<View style={s.card}>
    <Text accessibilityRole="header" style={s.label}>{confirmacao.tipo==='emitir'?'Confirmar emissão ou segunda via':'Confirmar bloqueio'}</Text>
    <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={s.text}>{descricaoConfirmacao(confirmacao)}</Text>
    <Botao title="Cancelar" secondary onPress={()=>{limparConfirmacao();setNotice('Ação cancelada. Nenhuma alteração foi enviada.');}}/>
    <Botao title="Confirmar" disabled={busy} onPress={confirmarAcao}/>
  </View>;
  return <View style={{gap:20}}>
    <Text style={s.title}>Área do responsável</Text>
    {!autorizado?<>
      <Text style={s.text}>A emissão e a gestão de cartões exigem a credencial fornecida pelo professor. Ela fica apenas na memória durante este acesso.</Text>
      <Campo label="Credencial do responsável" value={credencial} onChangeText={setCredencial} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!bloqueado}/>
      <Botao title={busy?'Verificando credencial…':'Acessar área do responsável'} disabled={bloqueado} onPress={()=>void executar(async controle=>{
        if(!credencial.trim())throw new Error('Informe a credencial do responsável.');
        const lista=await criarApi(url).usuarios(credencial,controle.signal);if(!vigente(controle))return;
        setCartoes(lista);setAutorizado(true);falar('Acesso do responsável liberado. Escolha a coleta autorizada ou o modo demonstração sem câmera.');
      })}/>
    </>:<>
      <Botao title="Encerrar acesso do responsável" secondary onPress={encerrar}/>
      <AtendimentosAdmin url={url} credencial={credencial} disabled={bloqueado} onUnauthorized={()=>{encerrar();setErro('Acesso do responsável encerrado. Informe uma credencial válida para entrar novamente.');}}/>
      <EventosAdmin url={url} credencial={credencial} disabled={bloqueado} onUnauthorized={()=>{encerrar();setErro('Acesso do responsável encerrado. Informe uma credencial válida para entrar novamente.');}}/>
      <Text style={s.title}>Emitir cartão</Text>
      <Text style={s.text}>Use CPF fictício nos testes. A coleta real exige uma pessoa voluntária que concorde. Nunca fotografe terceiros sem autorização. Emitir novamente para o mesmo CPF substitui o cartão anterior.</Text>
      <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={s.label}>Etapa {etapa} de 3: {etapa===1?'Dados':etapa===2?'Foto e assinatura':'PIN e revisão'}</Text>
      <Botao title="Ouvir instruções" secondary onPress={()=>falar('Preencha nome, CPF e idade. Na coleta autorizada, confirme o consentimento antes de tirar a foto e desenhar a assinatura. Escolha um PIN com seis números e confirme. A demonstração também funciona sem câmera.')}/>
      <View style={{gap:16,display:etapa===1?'flex':'none'}} accessibilityElementsHidden={etapa!==1} importantForAccessibility={etapa===1?'auto':'no-hide-descendants'}>
        <Text style={s.label}>{modo==='real'?'Modo: coleta autorizada de foto e assinatura':'Modo: demonstração com dados fictícios'}</Text>
        <Botao title={modo==='real'?'Usar modo demonstração sem câmera':'Usar coleta autorizada de foto e assinatura'} secondary disabled={bloqueado} onPress={()=>mudarModo(modo==='real'?'demonstracao':'real')}/>
        <View style={{gap:8}}><Campo label="Nome" value={nome} onChangeText={valor=>{setNome(valor);limparErro('nome');}} editable={!bloqueado}/><Aviso texto={errosCampos.nome||''}/></View>
        <View style={{gap:8}}><Campo label="CPF" value={cpf} onChangeText={valor=>{setCpf(valor);limparErro('cpf');}} keyboardType="number-pad" maxLength={14} editable={!bloqueado}/><Aviso texto={errosCampos.cpf||''}/></View>
        <View style={{gap:8}}><Campo label="Idade" value={idade} onChangeText={valor=>{setIdade(valor);limparErro('idade');}} keyboardType="number-pad" maxLength={3} editable={!bloqueado}/><Aviso texto={errosCampos.idade||''}/></View>
        {modo==='real'&&<View style={s.card}>
          <Text style={s.text}>A foto e o desenho da assinatura serão guardados no servidor deste protótipo, com acesso restrito. Eles não reconhecem o rosto nem comprovam a autoria. A participação é voluntária; você pode usar a demonstração sem coleta real.</Text>
          {!consentimento?<Botao title="Concordo com a captura para esta demonstração" disabled={bloqueado} onPress={()=>{setConsentimento(true);limparErro('consentimento');}}/>:<>
            <Text style={s.text} accessibilityLiveRegion="polite">Consentimento confirmado para esta emissão.</Text>
            <Botao title="Cancelar coleta autorizada" secondary disabled={bloqueado} onPress={limparCapturas}/>
          </>}
          <Aviso texto={errosCampos.consentimento||''}/>
        </View>}
        <Botao title="Continuar para foto e assinatura" disabled={bloqueado} onPress={()=>avancar(1)}/>
      </View>
      <View style={{gap:16,display:etapa===2?'flex':'none'}} accessibilityElementsHidden={etapa!==2} importantForAccessibility={etapa===2?'auto':'no-hide-descendants'}>
        {modo==='real'&&consentimento&&<View style={s.card}>
          {capturando&&etapa===2?<CapturaFoto onCancel={()=>setCapturando(false)} onConfirm={capturada=>{setFoto(capturada);setFotoId(undefined);setCapturando(false);limparErro('foto');}}/>:<>
            {foto&&<><Image accessibilityLabel="Foto confirmada para esta emissão" source={{uri:`data:${foto.mimeType};base64,${foto.base64}`}} style={{width:'100%',height:180}} resizeMode="contain"/><Text style={s.text}>Foto confirmada. Ela será enviada ao gerar o cartão.</Text></>}
            <Botao title={foto?'Refazer foto do cadastro':'Capturar foto do rosto'} disabled={bloqueado} onPress={()=>{setFoto(null);setFotoId(undefined);setAssinatura(null);setEdicao(valor=>valor+1);setCapturando(true);}}/>
          </>}
          <Aviso texto={errosCampos.foto||''}/>
        </View>}
        {modo==='demonstracao'&&<Text style={s.text}>Sem foto real: o sistema usará uma imagem de exemplo identificada como fictícia. Você pode desenhar ou usar uma assinatura fictícia. Isso não cadastra nem reconhece um rosto.</Text>}
        {(modo==='demonstracao'||consentimento)&&!capturando&&<AssinaturaManuscrita key={edicao} disabled={bloqueado||etapa!==2} demonstracao={modo==='demonstracao'} onConfirm={valor=>{setAssinatura(valor);limparErro('assinatura');}} onClear={()=>setAssinatura(null)}/>}
        <Aviso texto={errosCampos.assinatura||''}/>
        <Botao title="Voltar para dados" secondary disabled={bloqueado} onPress={()=>voltar(1)}/>
        <Botao title="Continuar para PIN e revisão" disabled={bloqueado||capturando} onPress={()=>avancar(2)}/>
      </View>
      <View style={{gap:16,display:etapa===3?'flex':'none'}} accessibilityElementsHidden={etapa!==3} importantForAccessibility={etapa===3?'auto':'no-hide-descendants'}>
        <View style={{gap:8}}><Campo label="PIN de acesso (6 números)" value={pin} onChangeText={valor=>{setPin(valor.replace(/\D/g,''));limparErro('pin');}} secureTextEntry keyboardType="number-pad" maxLength={6} autoComplete="off" editable={!bloqueado}/><Aviso texto={errosCampos.pin||''}/></View>
        <View style={{gap:8}}><Campo label="Confirme o PIN" value={confirmacaoPin} onChangeText={valor=>{setConfirmacaoPin(valor.replace(/\D/g,''));limparErro('confirmacaoPin');}} secureTextEntry keyboardType="number-pad" maxLength={6} autoComplete="off" editable={!bloqueado}/><Aviso texto={errosCampos.confirmacaoPin||''}/></View>
        <Text style={s.text}>Guarde seu PIN. Ele não aparece no cartão e permite entrar quando a biometria do aparelho não estiver disponível.</Text>
        <View style={s.card}>
          <Text accessibilityRole="header" style={s.label}>Revise antes de gerar o cartão</Text>
          <Text style={s.text}>Nome: {nome}</Text><Text style={s.text}>CPF: ***.***.***-{normalizarCpf(cpf).slice(-2)}</Text><Text style={s.text}>Idade: {idade} anos</Text>
          <Text style={s.text}>{modo==='real'?'Coleta autorizada: foto e assinatura confirmadas.':'Demonstração: foto de exemplo e assinatura confirmada.'}</Text>
          <Text style={s.text}>O PIN permanece oculto. Confira os dados e confirme a emissão na próxima mensagem.</Text>
        </View>
        <Botao title="Voltar para foto e assinatura" secondary disabled={bloqueado} onPress={()=>voltar(2)}/>
        <Botao title={busy?'Aguarde…':'Gerar cartão'} disabled={bloqueado} onPress={pedirEmissao}/>
        <Aviso texto={erroEmissao}/>
        {confirmacao?.tipo==='emitir'&&painelConfirmacao}
      </View>
      {cartao&&<View style={s.card}>
        <Text style={s.label}>Seu cartão de demonstração</Text>
        <Botao title="Usar este cartão na demonstração" disabled={bloqueado} onPress={()=>onUseCard(cartao)}/>
        <View accessible accessibilityLabel="QR Code do cartão. O mesmo código está no campo abaixo." style={{alignItems:'center'}}><QRCode value={json} size={Math.min(240,Math.max(100,width-128))} quietZone={12}/></View>
        <Campo label="Código para testar em outro aparelho" value={json} multiline editable={false} selectTextOnFocus style={{minHeight:160}}/>
        {Platform.OS!=='web'&&<Botao title="Gravar na tag NFC" disabled={bloqueado} onPress={()=>void executar(async controle=>{
          setGravando(true);await gravarNfc(json);if(!vigente(controle))return;
          setNotice('Cartão gravado.');feedback('Cartão gravado.',true);
        })}/>}
        {gravando&&<><Text style={s.text} accessibilityLiveRegion="polite">Aguardando cartão para gravar…</Text><Botao title="Cancelar gravação" secondary onPress={()=>{cancelar();ocupado.current=false;setBusy(false);setGravando(false);void cancelarNfc();setNotice('Gravação cancelada.');}}/></>}
        <Text style={s.text}>A assinatura exige espaço suficiente na tag NDEF. Tags NTAG213/215 são pequenas para este formato. QR Code e texto funcionam sem hardware.</Text>
      </View>}
      <Text style={s.title}>Cartões emitidos</Text>
      <Botao title="Atualizar lista" secondary disabled={bloqueado} onPress={()=>void executar(atualizar)}/>
      <Campo label="Buscar cartão por nome ou CPF" value={buscaCartoes} onChangeText={setBuscaCartoes} editable={!bloqueado} autoCapitalize="none" autoCorrect={false}/>
      <Text style={s.label}>Filtrar por estado</Text>
      {([
        ['todos','Todos'],['ativo','Ativos'],['bloqueado','Bloqueados'],['substituido','Substituídos'],
      ] as const).map(([valor,rotulo])=><Botao key={valor} title={`${rotulo}${estadoCartoes===valor?' (selecionado)':''}`} secondary={estadoCartoes!==valor} disabled={bloqueado} onPress={()=>setEstadoCartoes(valor)}/>)}
      <Botao title="Limpar busca e filtros" secondary disabled={bloqueado||(!buscaCartoes&&estadoCartoes==='todos')} onPress={limparFiltros}/>
      <Text style={s.text} accessibilityLiveRegion="polite">Exibindo {cartoesVisiveis.length} de {cartoes.length} cartões.</Text>
      {!cartoes.length&&<Text style={s.text}>Nenhum cartão emitido nesta versão. Se você tinha um cartão antigo, emita uma nova via.</Text>}
      {!!cartoes.length&&!cartoesVisiveis.length&&<Text accessibilityLiveRegion="polite" style={s.text}>Nenhum cartão corresponde à busca e ao estado escolhidos. Limpe ou altere os filtros.</Text>}
      {cartoesVisiveis.map(item=><View key={item.emissaoId} style={s.card}>
        <Text style={s.label}>{item.nome}</Text><Text style={s.text}>CPF: ***.***.***-{item.cpf.slice(-2)} • {item.estado==='substituido'?'substituído':item.estado}</Text>
        {item.estado==='ativo'&&<>
          <Botao title={`Preparar demonstração de ${item.nome}`} secondary disabled={bloqueado} onPress={()=>void executar(async controle=>{
            const escolhido=await criarApi(url).cartao(item.emissaoId,credencial,controle.signal);if(!vigente(controle))return;
            setCartao(escolhido);setNotice('Cartão preparado. Use o botão de demonstração acima.');
          })}/>
          <Botao title={`Bloquear cartão de ${item.nome}`} secondary disabled={bloqueado} onPress={()=>pedirConfirmacao({tipo:'bloquear',cartao:item})}/>
          {confirmacao?.tipo==='bloquear'&&confirmacao.cartao.emissaoId===item.emissaoId&&painelConfirmacao}
        </>}
      </View>)}
    </>}
    <Aviso texto={erro}/>{notice&&<Text accessibilityLiveRegion="polite" style={s.text}>{notice}</Text>}
  </View>;
}

