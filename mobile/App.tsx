import React,{useCallback,useState} from 'react';
import { Platform,SafeAreaView,ScrollView,Text,View } from 'react-native';
import { LoginScreen } from './src/screens/LoginScreen';
import { EmissorScreen } from './src/screens/EmissorScreen';
import { SucessoScreen } from './src/screens/SucessoScreen';
import { Botao,Campo,Aviso } from './src/components/Ui';
import { ControleAudio } from './src/components/ControleAudio';
import { Chip,Sessao } from './src/services/identidade';
import { styles as s } from './src/theme';
export default function App() {
  const [page,setPage]=useState<'login'|'emissor'>('login'),[sessao,setSessao]=useState<Sessao|null>(null),[settings,setSettings]=useState(false);
  const [cartaoDemonstracao,setCartaoDemonstracao]=useState<Chip|null>(null),[mensagem,setMensagem]=useState('');
  const [url,setUrl]=useState(process.env.EXPO_PUBLIC_API_URL || (Platform.OS==='android'?'http://10.0.2.2:3000':'http://localhost:3000'));
  const [rascunhoUrl,setRascunhoUrl]=useState(url),[novaUrl,setNovaUrl]=useState<string|null>(null),[erroConexao,setErroConexao]=useState('');
  const sair=useCallback((aviso='')=>{setSessao(null);setCartaoDemonstracao(null);setMensagem(aviso);setPage('login');},[]);
  function fecharAjustes(){setSettings(false);setNovaUrl(null);setErroConexao('');setRascunhoUrl(url);}
  function salvarConexao(){
    try {
      const valor=rascunhoUrl.trim().replace(/\/+$/,'');
      const parsed=new URL(valor);
      if(!['http:','https:'].includes(parsed.protocol)||!parsed.hostname||parsed.username||parsed.password||parsed.search||parsed.hash)throw new Error();
      setErroConexao('');
      if(valor===url.replace(/\/+$/,'')){fecharAjustes();return;}
      setNovaUrl(valor);
    }catch{setErroConexao('Informe um endereço HTTP ou HTTPS válido, sem senha, parâmetros ou fragmentos.');setNovaUrl(null);}
  }
  return <SafeAreaView style={s.page}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.container}>
    <Text style={s.title}>FácilID</Text><Text style={s.text}>AcessoSênior • seu acesso, mais simples</Text><ControleAudio/>
    {sessao?<SucessoScreen sessao={sessao} url={url} onExit={sair}/>:<>
      {page==='login'?<LoginScreen key={url} url={url} mensagem={mensagem} cartaoDemonstracao={cartaoDemonstracao} onSuccess={setSessao}/>:<>
        <View style={s.card}>
          <Botao secondary title={settings?'Fechar ajustes':'Ajustar conexão'} onPress={()=>{if(settings)fecharAjustes();else{setRascunhoUrl(url);setSettings(true);}}}/>
          {settings&&<>
            <Campo label="Endereço do serviço" value={rascunhoUrl} onChangeText={valor=>{setRascunhoUrl(valor);setNovaUrl(null);}} autoCapitalize="none" autoCorrect={false} keyboardType="url"/>
            <Aviso texto={erroConexao}/>
            <Botao title="Salvar conexão" onPress={salvarConexao}/>
            {novaUrl&&<View style={s.card}>
              <Text accessibilityRole="alert" style={s.text}>Mudar a conexão reinicia o formulário do responsável e descarta o cartão preparado neste aparelho. Os dados já gravados no servidor permanecem. Confirme somente se deseja usar o novo serviço.</Text>
              <Botao title="Cancelar mudança de conexão" secondary onPress={()=>setNovaUrl(null)}/>
              <Botao title="Confirmar mudança de conexão" onPress={()=>{setUrl(novaUrl);setCartaoDemonstracao(null);setMensagem('');setSettings(false);setNovaUrl(null);setErroConexao('');}}/>
            </View>}
          </>}
        </View>
        <EmissorScreen key={url} url={url} onUseCard={chip=>{setCartaoDemonstracao(chip);setMensagem('');setPage('login');fecharAjustes();}}/>
      </>}
      <View style={{gap:16,marginTop:20}}>
        <Botao secondary title={page==='login'?'Área do responsável':'Voltar para entrar'} onPress={()=>{setPage(page==='login'?'emissor':'login');setMensagem('');fecharAjustes();}}/>
      </View>
    </>}
  </ScrollView></SafeAreaView>;
}
