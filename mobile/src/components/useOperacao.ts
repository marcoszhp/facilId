import { useCallback,useEffect,useRef } from 'react';

// AbortSignal interrompe a rede; a identidade da operação também impede respostas
// tardias de leituras NFC e de transportes que não respeitam cancelamento.
export function useOperacao() {
  const montada=useRef(false),atual=useRef<AbortController|null>(null);
  const cancelar=useCallback(()=>{atual.current?.abort();atual.current=null;},[]);
  useEffect(()=>{montada.current=true;return()=>{montada.current=false;cancelar();};},[cancelar]);
  const iniciar=useCallback(()=>{cancelar();const controle=new AbortController();atual.current=controle;return controle;},[cancelar]);
  const vigente=useCallback((controle:AbortController)=>montada.current&&atual.current===controle&&!controle.signal.aborted,[]);
  return {iniciar,vigente,cancelar};
}
