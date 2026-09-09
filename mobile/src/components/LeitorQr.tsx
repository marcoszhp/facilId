import React,{useState} from 'react';
import { View,Text } from 'react-native';
import { CameraView,useCameraPermissions } from 'expo-camera';
import { Botao } from './Ui';
import { styles as s } from '../theme';
export function LeitorQr({onRead,onClose}:{onRead:(text:string)=>void;onClose:()=>void}) {
  const [permission,requestPermission]=useCameraPermissions(); const [lido,setLido]=useState(false);
  return <View style={{gap:16}}><Text style={s.text}>Aponte a câmera para o código do cartão.</Text>{!permission?.granted?<Botao title="Permitir câmera" onPress={()=>{void requestPermission();}}/>:<CameraView style={{height:320}} barcodeScannerSettings={{barcodeTypes:['qr']}} onBarcodeScanned={lido?undefined:({data})=>{setLido(true);onRead(data);}}/>}<Botao title="Fechar câmera" secondary onPress={onClose}/></View>;
}
