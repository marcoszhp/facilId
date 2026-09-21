import React from 'react';
import { PanResponder } from 'react-native';
import { fireEvent,render,screen } from '@testing-library/react-native';
import { AssinaturaManuscrita } from '../src/components/AssinaturaManuscrita';

beforeEach(()=>{
  jest.spyOn(PanResponder,'create').mockImplementation(config=>({panHandlers:{
    onResponderGrant:config.onPanResponderGrant,
    onResponderMove:config.onPanResponderMove,
    onResponderRelease:config.onPanResponderRelease,
  }} as unknown as ReturnType<typeof PanResponder.create>));
});
function gesto(pontos:Array<[number,number]>){
  const quadro=screen.getByTestId('quadro-assinatura');
  pontos.forEach(([locationX,locationY],index)=>fireEvent(quadro,index?'responderMove':'responderGrant',{nativeEvent:{locationX,locationY}}));
  fireEvent(quadro,'responderRelease');
}
test('assinatura vazia ou apenas um toque não pode ser confirmada',()=>{
  const confirmar=jest.fn();render(<AssinaturaManuscrita onConfirm={confirmar} onClear={jest.fn()}/>);
  fireEvent.press(screen.getByRole('button',{name:'Confirmar assinatura'}));
  expect(screen.getByText(/desenhe sua assinatura antes/i)).toBeTruthy();expect(confirmar).not.toHaveBeenCalled();
  gesto([[10,10]]);fireEvent.press(screen.getByRole('button',{name:'Confirmar assinatura'}));
  expect(confirmar).not.toHaveBeenCalled();
});
test('gesto real é normalizado, limitado ao quadro e confirmado sem aceitar SVG arbitrário',()=>{
  const confirmar=jest.fn();render(<AssinaturaManuscrita onConfirm={confirmar} onClear={jest.fn()}/>);
  fireEvent(screen.getByTestId('quadro-assinatura'),'layout',{nativeEvent:{layout:{width:640,height:360}}});
  gesto([[-10,20],[200,100],[800,500]]);
  fireEvent.press(screen.getByRole('button',{name:'Confirmar assinatura'}));
  expect(confirmar).toHaveBeenCalledWith({largura:320,altura:180,tracos:[[{x:0,y:10},{x:100,y:50},{x:320,y:180}]]});
  expect(screen.getByRole('button',{name:'Confirmar assinatura'})).toBeDisabled();
});
test('limpar invalida a confirmação e o próximo desenho é diferente',()=>{
  const confirmar=jest.fn(),limpar=jest.fn();render(<AssinaturaManuscrita onConfirm={confirmar} onClear={limpar}/>);
  gesto([[10,10],[50,50]]);fireEvent.press(screen.getByRole('button',{name:'Confirmar assinatura'}));
  fireEvent.press(screen.getByRole('button',{name:'Limpar assinatura'}));expect(limpar).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button',{name:'Confirmar assinatura'}));expect(confirmar).toHaveBeenCalledTimes(1);
  gesto([[20,10],[70,50]]);fireEvent.press(screen.getByRole('button',{name:'Confirmar assinatura'}));
  expect(confirmar.mock.calls[1][0]).not.toEqual(confirmar.mock.calls[0][0]);
});
test('assinatura fictícia só é oferecida no modo demonstração explícito',()=>{
  const confirmar=jest.fn();const tela=render(<AssinaturaManuscrita onConfirm={confirmar} onClear={jest.fn()}/>);
  expect(screen.queryByRole('button',{name:'Usar assinatura fictícia'})).toBeNull();
  tela.rerender(<AssinaturaManuscrita demonstracao onConfirm={confirmar} onClear={jest.fn()}/>);
  fireEvent.press(screen.getByRole('button',{name:'Usar assinatura fictícia'}));
  expect(confirmar).toHaveBeenCalledTimes(1);expect(screen.getByText(/assinatura fictícia confirmada/i)).toBeTruthy();
});
