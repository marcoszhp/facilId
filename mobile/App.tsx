import React,{useCallback,useState} from 'react';
import { Platform,SafeAreaView,ScrollView,Text,View } from 'react-native';
import { LoginScreen } from './src/screens/LoginScreen';
import { EmissorScreen } from './src/screens/EmissorScreen';
import { SucessoScreen } from './src/screens/SucessoScreen';
import { Botao,Campo } from './src/components/Ui';
import { Sessao } from './src/services/identidade';
import { styles as s } from './src/theme';
export default function App() {
  const [page,setPage]=useState<'login'|'emissor'>('login'),[sessao,setSessao]=useState<Sessao|null>(null),[settings,setSettings]=useState(false);
  const [url,setUrl]=useState(process.env.EXPO_PUBLIC_API_URL || (Platform.OS==='android'?'http://10.0.2.2:3000':'http://localhost:3000'));
  const sair=useCallback(()=>{setSessao(null);setPage('login');},[]);
  return <SafeAreaView style={s.page}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.container}><Text style={s.title}>FácilID</Text><Text style={s.text}>AcessoSênior • seu acesso, mais simples</Text>{sessao?<SucessoScreen sessao={sessao} url={url} onExit={sair}/>:<>{page==='login'?<LoginScreen url={url} onSuccess={setSessao}/>:<EmissorScreen url={url}/>}<View style={{gap:16,marginTop:20}}><Botao secondary title={page==='login'?'Área de emissão':'Voltar para entrar'} onPress={()=>setPage(page==='login'?'emissor':'login')}/><Botao secondary title={settings?'Fechar ajustes':'Ajustar conexão'} onPress={()=>setSettings(!settings)}/>{settings&&<Campo label="Endereço do serviço" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url"/>}</View></>}</ScrollView></SafeAreaView>;
}
