import React,{useEffect,useState} from 'react';
import { observarAudio,pararAudio } from '../services/feedback';
import { Botao } from './Ui';
export function ControleAudio(){
  const [ativo,setAtivo]=useState(false);
  useEffect(()=>observarAudio(setAtivo),[]);
  return ativo?<Botao title="Parar áudio" secondary onPress={pararAudio}/>:null;
}
