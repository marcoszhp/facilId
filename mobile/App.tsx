import React,{useCallback,useState} from 'react';
import { Platform,SafeAreaView,ScrollView,Text,View } from 'react-native';
import { LoginScreen } from './src/screens/LoginScreen';
import { EmissorScreen } from './src/screens/EmissorScreen';
import { SucessoScreen } from './src/screens/SucessoScreen';
import { Botao,Campo } from './src/components/Ui';
import { ControleAudio } from './src/components/ControleAudio';
import { Chip,Sessao } from './src/services/identidade';
import { styles as s } from './src/theme';
export default function App() {
  const [page,setPage]=useState<'login'|'emissor'>('login'),[sessao,setSessao]=useState<Sessao|null>(null),[settings,setSettings]=useState(false);
  const [cartaoDemonstracao,setCartaoDemonstracao]=useState<Chip|null>(null),[mensagem,setMensagem]=useState('');
  const [url,setUrl]=useState(process.env.EXPO_PUBLIC_API_URL || (Platform.OS==='android'?'http://10.0.2.2:3000':'http://localhost:3000'));
  const sair=useCallback((aviso='')=>{setSessao(null);setCartaoDemonstracao(null);setMensagem(aviso);setPage('login');},[]);
  return <SafeAreaView style={s.page}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.container}>
    <Text style={s.title}>FácilID</Text><Text style={s.text}>AcessoSênior • seu acesso, mais simples</Text><ControleAudio/>
    {sessao?<SucessoScreen sessao={sessao} url={url} onExit={sair}/>:<>
      {page==='login'?<LoginScreen key={url} url={url} mensagem={mensagem} cartaoDemonstracao={cartaoDemonstracao} onSuccess={setSessao}/>:<EmissorScreen key={url} url={url} onUseCard={chip=>{setCartaoDemonstracao(chip);setMensagem('');setPage('login');setSettings(false);}}/>}
      <View style={{gap:16,marginTop:20}}>
        <Botao secondary title={page==='login'?'Área do responsável':'Voltar para entrar'} onPress={()=>{setPage(page==='login'?'emissor':'login');setMensagem('');setSettings(false);}}/>
        <Botao secondary title={settings?'Fechar ajustes':'Ajustar conexão'} onPress={()=>setSettings(!settings)}/>
        {settings&&<Campo label="Endereço do serviço" value={url} onChangeText={valor=>{setUrl(valor);setCartaoDemonstracao(null);}} autoCapitalize="none" autoCorrect={false} keyboardType="url"/>}
      </View>
    </>}
  </ScrollView></SafeAreaView>;
}
