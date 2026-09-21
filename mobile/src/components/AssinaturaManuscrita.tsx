import React,{useMemo,useRef,useState} from 'react';
import { GestureResponderEvent,PanResponder,Platform,Text,View,ViewStyle } from 'react-native';
import Svg,{Path} from 'react-native-svg';
import { AssinaturaDesenhada,assinaturaDemonstracao,caminhoDoTraco,LIMITE_PONTOS,LIMITE_PONTOS_POR_TRACO,LIMITE_TRACOS,PontoAssinatura,pontoNoQuadro,possuiDesenho } from '../services/desenho-assinatura';
import { Aviso,Botao } from './Ui';
import { styles as s } from '../theme';

type Props={onConfirm:(assinatura:AssinaturaDesenhada)=>void;onClear:()=>void;disabled?:boolean;demonstracao?:boolean};
export function AssinaturaManuscrita({onConfirm,onClear,disabled=false,demonstracao=false}:Props){
  const [tracos,setTracos]=useState<PontoAssinatura[][]>([]),[confirmada,setConfirmada]=useState(false),[ficticia,setFicticia]=useState(false),[erro,setErro]=useState('');
  const desenho=useRef<PontoAssinatura[][]>([]),dimensoes=useRef({largura:320,altura:180}),emGesto=useRef(false);
  const bloqueado=useRef(false);bloqueado.current=disabled||confirmada;
  function atualizar(proximo:PontoAssinatura[][]){desenho.current=proximo;setTracos(proximo);}
  const gestos=useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>!bloqueado.current,
    onMoveShouldSetPanResponder:()=>!bloqueado.current,
    onPanResponderTerminationRequest:()=>false,
    onShouldBlockNativeResponder:()=>true,
    onPanResponderGrant:(event:GestureResponderEvent)=>{
      if(bloqueado.current)return;
      const total=desenho.current.reduce((soma,traco)=>soma+traco.length,0);
      if(desenho.current.length>=LIMITE_TRACOS||total>=LIMITE_PONTOS){setErro('O desenho atingiu o limite. Confirme ou limpe para desenhar novamente.');return;}
      const {locationX,locationY}=event.nativeEvent;
      emGesto.current=true;setErro('');
      atualizar([...desenho.current,[pontoNoQuadro(locationX,locationY,dimensoes.current.largura,dimensoes.current.altura)]]);
    },
    onPanResponderMove:(event:GestureResponderEvent)=>{
      if(bloqueado.current||!emGesto.current)return;
      const total=desenho.current.reduce((soma,traco)=>soma+traco.length,0);if(total>=LIMITE_PONTOS)return;
      const {locationX,locationY}=event.nativeEvent;
      const ponto=pontoNoQuadro(locationX,locationY,dimensoes.current.largura,dimensoes.current.altura);
      const ultimo=desenho.current.at(-1);if(!ultimo||ultimo.length>=LIMITE_PONTOS_POR_TRACO)return;
      const anterior=ultimo.at(-1)!;if(Math.hypot(anterior.x-ponto.x,anterior.y-ponto.y)<1)return;
      atualizar([...desenho.current.slice(0,-1),[...ultimo,ponto]]);
    },
    onPanResponderRelease:()=>{emGesto.current=false;atualizar(desenho.current.filter(traco=>traco.length>=2));},
    onPanResponderTerminate:()=>{emGesto.current=false;atualizar(desenho.current.filter(traco=>traco.length>=2));},
  }),[]);
  function limpar(){atualizar([]);emGesto.current=false;setConfirmada(false);setFicticia(false);setErro('');onClear();}
  function confirmar(){
    const validos=desenho.current.filter(traco=>traco.length>=2);
    if(!possuiDesenho(validos)){setErro('Desenhe sua assinatura antes de confirmar. Um toque sozinho não é uma assinatura.');return;}
    atualizar(validos);setErro('');setConfirmada(true);onConfirm({largura:320,altura:180,tracos:validos.map(traco=>traco.map(ponto=>({...ponto})))});
  }
  return <View style={{gap:16}}>
    <Text style={s.label}>Assinatura manuscrita</Text>
    <Text style={s.text}>Desenhe com o dedo ou o mouse no quadro. O sistema guarda o desenho; não verifica quem o assinou.</Text>
    <View testID="quadro-assinatura" accessibilityLabel="Área para desenhar a assinatura" {...gestos.panHandlers} onLayout={event=>{dimensoes.current={largura:event.nativeEvent.layout.width,altura:event.nativeEvent.layout.height};}} style={[{width:'100%',aspectRatio:320/180,borderWidth:2,borderColor:'#527266',borderRadius:12,backgroundColor:'#FFFFFF',overflow:'hidden'},Platform.OS==='web'&&({touchAction:'none'} as ViewStyle)]}>
      <Svg width="100%" height="100%" viewBox="0 0 320 180" pointerEvents="none">
        {tracos.map((traco,index)=><Path key={index} d={caminhoDoTraco(traco)} fill="none" stroke="#193D32" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"/>)}
      </Svg>
    </View>
    {confirmada&&<Text style={s.text} accessibilityLiveRegion="polite">{ficticia?'Assinatura fictícia confirmada — modo demonstração.':'Assinatura desenhada confirmada.'}</Text>}
    <Botao title="Limpar assinatura" secondary disabled={disabled} onPress={limpar}/>
    <Botao title="Confirmar assinatura" disabled={disabled||confirmada} onPress={confirmar}/>
    {demonstracao&&<Botao title="Usar assinatura fictícia" secondary disabled={disabled||confirmada} onPress={()=>{
      const exemplo=assinaturaDemonstracao();atualizar(exemplo.tracos);setConfirmada(true);setFicticia(true);setErro('');onConfirm(exemplo);
    }}/>}
    <Aviso texto={erro}/>
  </View>;
}
