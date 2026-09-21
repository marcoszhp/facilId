import type { AssinaturaCapturada } from './identidade';
export type PontoAssinatura={x:number;y:number};
export type AssinaturaDesenhada=AssinaturaCapturada;
export const LIMITE_TRACOS=32;
export const LIMITE_PONTOS=1500;
export const LIMITE_PONTOS_POR_TRACO=512;
export function pontoNoQuadro(x:number,y:number,largura:number,altura:number):PontoAssinatura {
  const limitar=(valor:number,maximo:number)=>Math.round(Math.min(maximo,Math.max(0,Number.isFinite(valor)?valor:0))*100)/100;
  return {x:limitar(x*320/Math.max(1,largura),320),y:limitar(y*180/Math.max(1,altura),180)};
}
export function possuiDesenho(tracos:PontoAssinatura[][]){
  return tracos.some(traco=>traco.length>=2&&traco.reduce((total,ponto,index)=>index?total+Math.hypot(ponto.x-traco[index-1].x,ponto.y-traco[index-1].y):0,0)>=8);
}
export const caminhoDoTraco=(traco:PontoAssinatura[])=>traco.map((ponto,index)=>`${index?'L':'M'} ${ponto.x} ${ponto.y}`).join(' ');
export const assinaturaDemonstracao=():AssinaturaDesenhada=>({largura:320,altura:180,tracos:[[{x:32,y:110},{x:90,y:42},{x:140,y:122},{x:200,y:48},{x:280,y:110}]]});
