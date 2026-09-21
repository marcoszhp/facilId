import React,{useEffect,useRef,useState} from 'react';
import { AppState,Image,Linking,Platform,Text,View } from 'react-native';
import { CameraCapturedPicture,CameraView,useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { Aviso,Botao } from './Ui';
import { styles as s } from '../theme';

export type FotoCapturada={base64:string;mimeType:'image/jpeg'|'image/png'};
const MAX_BYTES=2*1024*1024;
export function escolherTamanhoFoto(tamanhos:string[]):string|undefined{
  const opcoes=tamanhos.map(valor=>({valor,partes:valor.split('x').map(Number)})).filter(({partes})=>partes.length===2&&partes.every(numero=>Number.isFinite(numero)&&numero>0));
  const preferidos=opcoes.filter(({partes:[largura,altura]})=>Math.max(largura,altura)<=1920);
  return (preferidos.length?preferidos.sort((a,b)=>b.partes[0]*b.partes[1]-a.partes[0]*a.partes[1]):opcoes.sort((a,b)=>a.partes[0]*a.partes[1]-b.partes[0]*b.partes[1]))[0]?.valor;
}
export function dadosDaFoto(foto:CameraCapturedPicture):FotoCapturada{
  const origem=foto.base64||'';
  const mimeType=foto.format==='png'||origem.startsWith('data:image/png;')?'image/png':'image/jpeg';
  const base64=origem.replace(/^data:image\/(?:jpeg|png);base64,/,'');
  if(!base64||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))throw new Error('Não foi possível preparar a foto. Tire outra foto.');
  const tamanho=base64.length*3/4-(base64.endsWith('==')?2:base64.endsWith('=')?1:0);
  if(tamanho>MAX_BYTES)throw new Error('A foto ficou muito grande. Tire outra foto ou use o modo demonstração sem câmera.');
  if(foto.width>4096||foto.height>4096||foto.width*foto.height>12_000_000)throw new Error('A câmera retornou uma foto grande demais. Use uma resolução menor ou o modo demonstração sem câmera.');
  return {base64,mimeType};
}
async function apagarTemporario(uri:string){
  if(Platform.OS==='web')return;
  if(!FileSystem.cacheDirectory||!uri.startsWith(FileSystem.cacheDirectory))throw new Error('Não foi possível limpar a foto temporária do aparelho. Cancele a captura e tente novamente.');
  await FileSystem.deleteAsync(uri,{idempotent:true});
}
export function CapturaFoto({onConfirm,onCancel}:{onConfirm:(foto:FotoCapturada)=>void;onCancel:()=>void}){
  const [permissao,solicitarPermissao,consultarPermissao]=useCameraPermissions();
  const camera=useRef<CameraView>(null),montada=useRef(false),operacao=useRef(0),ocupada=useRef(false),configurando=useRef(false);
  const [tamanhoFoto,setTamanhoFoto]=useState<string|undefined>();
  const [pronta,setPronta]=useState(false),[busy,setBusy]=useState(false),[foto,setFoto]=useState<FotoCapturada|null>(null),[erro,setErro]=useState(''),[falhaCamera,setFalhaCamera]=useState(false);
  useEffect(()=>{
    montada.current=true;
    const sub=AppState.addEventListener('change',estado=>{if(estado==='active'&&consultarPermissao)void consultarPermissao().catch(()=>{if(montada.current)setErro('Não foi possível verificar a câmera. Cancele e tente novamente.');});});
    return()=>{montada.current=false;operacao.current++;sub.remove();};
  },[consultarPermissao]);
  async function permitir(){setErro('');try{await solicitarPermissao();}catch{if(montada.current)setErro('Não foi possível solicitar a câmera. Cancele e use o modo demonstração sem câmera.');}}
  async function prepararCamera(){
    if(configurando.current)return;
    configurando.current=true;
    try{
      if(!tamanhoFoto&&camera.current?.getAvailablePictureSizesAsync){
        const tamanhos=await camera.current.getAvailablePictureSizesAsync();if(!montada.current)return;
        setTamanhoFoto(escolherTamanhoFoto(tamanhos));
      }
      if(montada.current)setPronta(true);
    }catch{if(montada.current){setPronta(true);setErro('Não foi possível ajustar a resolução. A foto será conferida antes do envio.');}}
    finally{configurando.current=false;}
  }
  async function capturar(){
    if(ocupada.current||!pronta||!camera.current)return;
    ocupada.current=true;setBusy(true);setErro('');const chamada=++operacao.current;
    try{
      const captura=await camera.current.takePictureAsync({base64:true,quality:0.35,exif:false,imageType:'jpg',skipProcessing:false});
      let dados:FotoCapturada;
      try{dados=dadosDaFoto(captura);}finally{await apagarTemporario(captura.uri);}
      if(montada.current&&chamada===operacao.current)setFoto(dados);
    }catch(e){if(montada.current&&chamada===operacao.current)setErro(e instanceof Error?e.message:'Não foi possível tirar a foto. Tente novamente.');}
    finally{if(montada.current&&chamada===operacao.current){ocupada.current=false;setBusy(false);}}
  }
  function cancelar(){operacao.current++;setFoto(null);onCancel();}
  // Expo Camera web pode informar canAskAgain=true mesmo após bloqueio do site.
  const bloqueada=permissao&&(!permissao.canAskAgain||(Platform.OS==='web'&&permissao.status==='denied'));
  return <View style={{gap:16}}>
    <Text style={s.label}>Foto autorizada para o cadastro</Text>
    <Text style={s.text}>Enquadre somente o rosto de quem concordou com a captura. A foto será guardada no cadastro; não há reconhecimento facial.</Text>
    {foto?<>
      <Image testID="preview-foto" accessibilityLabel="Prévia da foto capturada" source={{uri:`data:${foto.mimeType};base64,${foto.base64}`}} style={{width:'100%',height:280}} resizeMode="contain"/>
      <Botao title="Refazer foto" secondary onPress={()=>{setFoto(null);setPronta(false);setErro('');}}/>
      <Botao title="Confirmar foto" onPress={()=>{const escolhida=foto;setFoto(null);onConfirm(escolhida);}}/>
    </>:!permissao?<Text style={s.text}>Verificando permissão da câmera…</Text>:!permissao.granted?<>
      <Text style={s.text}>{!bloqueada?'Permita a câmera para tirar a foto. Você pode cancelar e escolher a demonstração sem câmera.':Platform.OS==='web'?'A câmera está bloqueada. Libere a câmera nas configurações deste site no navegador, ou cancele e escolha a demonstração.':'A câmera está bloqueada. Libere a câmera nas configurações do aparelho, ou cancele e escolha a demonstração.'}</Text>
      {!bloqueada?<Botao title="Permitir câmera para foto" onPress={()=>void permitir()}/>:Platform.OS!=='web'&&<Botao title="Abrir configurações da câmera" onPress={()=>{void Linking.openSettings().catch(()=>{if(montada.current)setErro('Abra as configurações do aparelho para permitir a câmera.');});}}/>}
    </>:!falhaCamera?<>
      <CameraView ref={camera} testID="camera-foto" facing="front" mode="picture" pictureSize={tamanhoFoto} style={{height:320}} onCameraReady={()=>void prepararCamera()} onMountError={()=>{if(montada.current){setFalhaCamera(true);setErro('A câmera não iniciou. Cancele e tente novamente, ou use o modo demonstração.');}}}/>
      <Botao title={busy?'Preparando foto…':'Tirar foto'} disabled={!pronta||busy} onPress={()=>void capturar()}/>
    </>:null}
    <Aviso texto={erro}/><Botao title="Cancelar captura" secondary onPress={cancelar}/>
  </View>;
}
