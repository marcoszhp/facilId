import React,{useEffect,useRef,useState} from 'react';
import { AppState,Linking,Platform,View,Text } from 'react-native';
import { CameraView,useCameraPermissions } from 'expo-camera';
import { Aviso,Botao } from './Ui';
import { styles as s } from '../theme';
export function LeitorQr({onRead,onClose,onManual=onClose}:{onRead:(text:string)=>void;onClose:()=>void;onManual?:()=>void}) {
  const [permission,requestPermission,getPermission]=useCameraPermissions();
  const [erro,setErro]=useState(''),[solicitando,setSolicitando]=useState(false),[falhaCamera,setFalhaCamera]=useState(false);
  const montado=useRef(true),lido=useRef(false);
  useEffect(()=>{
    montado.current=true;
    const sub=AppState.addEventListener('change',estado=>{if(estado==='active'&&getPermission)void getPermission().catch(()=>{if(montado.current)setErro('Não foi possível verificar a câmera. Use o código em texto.');});});
    return()=>{montado.current=false;sub.remove();};
  },[getPermission]);
  async function permitir(){
    setSolicitando(true);setErro('');
    try{await requestPermission();}catch{if(montado.current)setErro('Não foi possível abrir a câmera. Tente novamente ou use o código em texto.');}
    finally{if(montado.current)setSolicitando(false);}
  }
  async function abrirConfiguracoes(){try{await Linking.openSettings();}catch{if(montado.current)setErro('Abra as configurações do celular e permita a câmera para o FácilID. Você também pode usar o código em texto.');}}
  const permanente=permission&&!permission.granted&&!permission.canAskAgain;
  return <View style={{gap:16}}>
    <Text style={s.text}>Aponte a câmera para o código do cartão.</Text>
    {!permission?<Text style={s.text} accessibilityLiveRegion="polite">Verificando permissão da câmera…</Text>:permission.granted&&!falhaCamera?<CameraView testID="leitor-camera" style={{height:320}} barcodeScannerSettings={{barcodeTypes:['qr']}} onMountError={()=>{if(montado.current){setFalhaCamera(true);setErro('Não foi possível iniciar a câmera. Use o código em texto.');}}} onBarcodeScanned={({data})=>{if(!montado.current||lido.current)return;lido.current=true;onRead(data);}}/>:permanente?<>
      <Text style={s.text}>{Platform.OS==='web'?'A câmera está bloqueada. Altere a permissão de câmera nas configurações deste site no navegador e reabra o leitor.':'A câmera está bloqueada. Abra as configurações do celular e permita o acesso à câmera.'}</Text>
      {Platform.OS!=='web'&&<Botao title="Abrir configurações" onPress={()=>void abrirConfiguracoes()}/>}
    </>:!falhaCamera?<><Text style={s.text}>Precisamos da sua permissão para ler o QR Code. Você também pode usar texto.</Text><Botao title={solicitando?'Aguardando permissão…':'Permitir câmera'} disabled={solicitando} onPress={()=>void permitir()}/></>:null}
    <Aviso texto={erro}/><Botao title="Usar código em texto" secondary onPress={onManual}/><Botao title="Fechar câmera" secondary onPress={onClose}/>
  </View>;
}
