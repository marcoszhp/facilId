import React from 'react';
import { act,fireEvent,render,screen,waitFor } from '@testing-library/react-native';
import { EmissorScreen } from '../src/screens/EmissorScreen';
import { criarApi } from '../src/services/api.service';
import { assinaturaDemonstracao } from '../src/services/desenho-assinatura';
import { cartao,pendente } from './helpers';

jest.mock('../src/services/api.service',()=>({...jest.requireActual('../src/services/api.service'),criarApi:jest.fn()}));
jest.mock('../src/services/nfc.service',()=>({cancelarNfc:jest.fn().mockResolvedValue(undefined),gravarNfc:jest.fn()}));
jest.mock('../src/services/feedback',()=>({falar:jest.fn(),feedback:jest.fn(),pararAudio:jest.fn()}));
jest.mock('react-native-qrcode-svg',()=>()=>null);
jest.mock('../src/components/CapturaFoto',()=>({CapturaFoto:({onConfirm}:any)=>{
  const React=require('react'),{Button}=require('react-native');
  return React.createElement(Button,{title:'Confirmar foto de teste',onPress:()=>onConfirm({base64:'aW1hZ2Vt',mimeType:'image/jpeg'})});
}}));
jest.mock('../src/components/AssinaturaManuscrita',()=>({AssinaturaManuscrita:({onConfirm,demonstracao}:any)=>{
  const React=require('react'),{Button}=require('react-native'),{assinaturaDemonstracao}=require('../src/services/desenho-assinatura');
  return React.createElement(Button,{title:demonstracao?'Usar assinatura fictícia':'Confirmar desenho de teste',onPress:()=>onConfirm(assinaturaDemonstracao())});
}}));
const api={emitir:jest.fn(),usuarios:jest.fn(),foto:jest.fn(),cartao:jest.fn(),bloquear:jest.fn()};
beforeEach(()=>{
  Object.values(api).forEach(mock=>mock.mockReset());
  jest.mocked(criarApi).mockReturnValue(api as unknown as ReturnType<typeof criarApi>);
  api.usuarios.mockResolvedValue([]);api.emitir.mockResolvedValue(cartao);api.foto.mockResolvedValue({id:'foto-protegida-de-teste',hash:'hash-de-teste'});
});
async function autorizar(){
  fireEvent.changeText(screen.getByLabelText('Credencial do responsável'),'token-do-teste');
  fireEvent.press(screen.getByRole('button',{name:'Acessar área do responsável'}));
  await screen.findByRole('button',{name:'Gerar cartão'});
}
function preencher(){
  fireEvent.changeText(screen.getByLabelText('Nome'),cartao.nome);fireEvent.changeText(screen.getByLabelText('CPF'),cartao.cpf);fireEvent.changeText(screen.getByLabelText('Idade'),String(cartao.idade));
  fireEvent.changeText(screen.getByLabelText('PIN de acesso (6 números)'),'123789');fireEvent.changeText(screen.getByLabelText('Confirme o PIN'),'123789');
}
function prepararColeta(){
  fireEvent.press(screen.getByRole('button',{name:'Concordo com a captura para esta demonstração'}));
  fireEvent.press(screen.getByRole('button',{name:'Capturar foto do rosto'}));
  fireEvent.press(screen.getByRole('button',{name:'Confirmar foto de teste'}));
  fireEvent.press(screen.getByRole('button',{name:'Confirmar desenho de teste'}));
}
test('coleta real depende de consentimento e PINs iguais antes de qualquer envio',async()=>{
  render(<EmissorScreen url="http://localhost:3000" onUseCard={jest.fn()}/>);await autorizar();preencher();
  expect(screen.queryByRole('button',{name:'Capturar foto do rosto'})).toBeNull();expect(screen.queryByRole('button',{name:'Confirmar desenho de teste'})).toBeNull();
  fireEvent.press(screen.getByRole('button',{name:'Gerar cartão'}));await screen.findByText(/confirme o consentimento/i);
  expect(api.foto).not.toHaveBeenCalled();expect(api.emitir).not.toHaveBeenCalled();
  prepararColeta();fireEvent.changeText(screen.getByLabelText('Confirme o PIN'),'987321');
  fireEvent.press(screen.getByRole('button',{name:'Gerar cartão'}));await screen.findByText(/PINs não conferem/i);
  expect(api.foto).not.toHaveBeenCalled();expect(api.emitir).not.toHaveBeenCalled();
});
test('emissão real envia foto protegida antes do cartão e limpa PIN e capturas ao concluir',async()=>{
  render(<EmissorScreen url="http://localhost:3000" onUseCard={jest.fn()}/>);await autorizar();preencher();prepararColeta();
  fireEvent.press(screen.getByRole('button',{name:'Gerar cartão'}));await screen.findByRole('button',{name:'Usar este cartão na demonstração'});
  expect(api.foto).toHaveBeenCalledWith('aW1hZ2Vt','image/jpeg','token-do-teste',expect.anything());
  expect(api.emitir).toHaveBeenCalledWith(expect.objectContaining({modo:'real',fotoId:'foto-protegida-de-teste',consentimento:true,assinatura:assinaturaDemonstracao(),pin:'123789'}),'token-do-teste',expect.anything());
  expect(api.emitir.mock.calls[0][0]).not.toHaveProperty('base64');
  expect(screen.getByLabelText('PIN de acesso (6 números)').props.value).toBe('');expect(screen.getByLabelText('Confirme o PIN').props.value).toBe('');
  expect(screen.queryByLabelText('Foto confirmada para esta emissão')).toBeNull();
});
test('demonstração continua emitindo sem câmera com assinatura marcada como fictícia e PIN',async()=>{
  render(<EmissorScreen url="http://localhost:3000" onUseCard={jest.fn()}/>);await autorizar();
  fireEvent.press(screen.getByRole('button',{name:'Usar modo demonstração sem câmera'}));preencher();
  fireEvent.press(screen.getByRole('button',{name:'Usar assinatura fictícia'}));fireEvent.press(screen.getByRole('button',{name:'Gerar cartão'}));
  await screen.findByRole('button',{name:'Usar este cartão na demonstração'});
  expect(api.foto).not.toHaveBeenCalled();expect(api.emitir.mock.calls[0][0]).toEqual(expect.objectContaining({modo:'demonstracao',assinatura:assinaturaDemonstracao(),pin:'123789'}));
  expect(api.emitir.mock.calls[0][0]).not.toHaveProperty('fotoId');
});
test('sair durante upload cancela a chamada e não emite depois de resposta tardia',async()=>{
  const upload=pendente<{id:string;hash:string}>();api.foto.mockReturnValueOnce(upload.promise);
  const tela=render(<EmissorScreen url="http://localhost:3000" onUseCard={jest.fn()}/>);await autorizar();preencher();prepararColeta();
  fireEvent.press(screen.getByRole('button',{name:'Gerar cartão'}));await waitFor(()=>expect(api.foto).toHaveBeenCalledTimes(1));
  const signal=api.foto.mock.calls[0][3] as AbortSignal;tela.unmount();expect(signal.aborted).toBe(true);
  await act(async()=>{upload.resolver({id:'foto-tardia',hash:'hash-tardio'});});expect(api.emitir).not.toHaveBeenCalled();
});
test('refazer foto invalida assinatura anterior e exige confirmar o desenho novamente',async()=>{
  render(<EmissorScreen url="http://localhost:3000" onUseCard={jest.fn()}/>);await autorizar();preencher();prepararColeta();
  fireEvent.press(screen.getByRole('button',{name:'Refazer foto do cadastro'}));
  fireEvent.press(screen.getByRole('button',{name:'Confirmar foto de teste'}));
  fireEvent.press(screen.getByRole('button',{name:'Gerar cartão'}));await screen.findByText(/desenhe e confirme a assinatura/i);
  expect(api.foto).not.toHaveBeenCalled();expect(api.emitir).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button',{name:'Confirmar desenho de teste'}));fireEvent.press(screen.getByRole('button',{name:'Gerar cartão'}));
  await screen.findByRole('button',{name:'Usar este cartão na demonstração'});expect(api.emitir).toHaveBeenCalledTimes(1);
});
