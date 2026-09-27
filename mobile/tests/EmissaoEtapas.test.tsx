import React from 'react';
import { PanResponder } from 'react-native';
import { act,fireEvent,render,screen } from '@testing-library/react-native';
import { EmissorScreen } from '../src/screens/EmissorScreen';
import { criarApi } from '../src/services/api.service';
import { cartao } from './helpers';

jest.mock('../src/services/api.service',()=>({...jest.requireActual('../src/services/api.service'),criarApi:jest.fn()}));
jest.mock('../src/services/nfc.service',()=>({cancelarNfc:jest.fn().mockResolvedValue(undefined),gravarNfc:jest.fn()}));
jest.mock('../src/services/feedback',()=>({falar:jest.fn(),feedback:jest.fn(),pararAudio:jest.fn()}));
jest.mock('react-native-qrcode-svg',()=>()=>null);
jest.mock('../src/components/CapturaFoto',()=>({CapturaFoto:({onConfirm,onCancel}:any)=>{
  const React=require('react'),{Button}=require('react-native');
  return React.createElement(React.Fragment,null,
    React.createElement(Button,{title:'Confirmar foto de teste',onPress:()=>onConfirm({base64:'aW1hZ2Vt',mimeType:'image/jpeg'})}),
    React.createElement(Button,{title:'Cancelar captura de teste',onPress:onCancel}));
}}));
const api={usuarios:jest.fn(),emitir:jest.fn(),foto:jest.fn()};
const pressionar=(name:string)=>fireEvent.press(screen.getByRole('button',{name}));
function dados(){
  fireEvent.changeText(screen.getByLabelText('Nome'),cartao.nome);
  fireEvent.changeText(screen.getByLabelText('CPF'),cartao.cpf);
  fireEvent.changeText(screen.getByLabelText('Idade'),String(cartao.idade));
}
function pin(){fireEvent.changeText(screen.getByLabelText('PIN de acesso (6 números)'),'123789');fireEvent.changeText(screen.getByLabelText('Confirme o PIN'),'123789');}
function desenhar(x=10){
  const quadro=screen.getByTestId('quadro-assinatura');
  fireEvent(quadro,'responderGrant',{nativeEvent:{locationX:x,locationY:20}});
  fireEvent(quadro,'responderMove',{nativeEvent:{locationX:x+40,locationY:60}});
  fireEvent(quadro,'responderRelease');
}
async function abrir(){
  render(<EmissorScreen url="http://localhost:3000" onUseCard={jest.fn()}/>);
  fireEvent.changeText(screen.getByLabelText('Credencial do responsável'),'admin-artificial');
  pressionar('Acessar área do responsável');await screen.findByText('Etapa 1 de 3: Dados');
}
function coletar(){
  pressionar('Concordo com a captura para esta demonstração');pressionar('Continuar para foto e assinatura');
  pressionar('Capturar foto do rosto');pressionar('Confirmar foto de teste');
  desenhar();pressionar('Confirmar assinatura');pressionar('Continuar para PIN e revisão');pin();
}
beforeEach(()=>{
  Object.values(api).forEach(mock=>mock.mockReset());
  jest.mocked(criarApi).mockReturnValue(api as unknown as ReturnType<typeof criarApi>);
  api.usuarios.mockResolvedValue([]);api.emitir.mockResolvedValue(cartao);api.foto.mockResolvedValue({id:'foto-teste',hash:'hash-teste'});
  jest.spyOn(PanResponder,'create').mockImplementation(config=>({panHandlers:{
    onResponderGrant:config.onPanResponderGrant,onResponderMove:config.onPanResponderMove,onResponderRelease:config.onPanResponderRelease,
  }} as unknown as ReturnType<typeof PanResponder.create>));
});

test('Dados apresenta somente a etapa atual e corrige erros de nome, CPF, idade e consentimento sem enviar',async()=>{
  await abrir();expect(screen.queryByLabelText('PIN de acesso (6 números)')).toBeNull();expect(screen.queryByTestId('quadro-assinatura')).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Nome'),'A');fireEvent.changeText(screen.getByLabelText('CPF'),'123');fireEvent.changeText(screen.getByLabelText('Idade'),'131');
  pressionar('Continuar para foto e assinatura');
  expect(screen.getByText('Nome: informe entre 2 e 100 caracteres.')).toBeTruthy();
  expect(screen.getByText('CPF: informe os 11 números.')).toBeTruthy();expect(screen.getByText('Idade: informe um número de 0 a 130.')).toBeTruthy();
  expect(screen.getByText(/confirme o consentimento/i)).toBeTruthy();
  dados();pressionar('Concordo com a captura para esta demonstração');pressionar('Continuar para foto e assinatura');
  expect(screen.getByText('Etapa 2 de 3: Foto e assinatura')).toBeTruthy();expect(screen.queryByLabelText('Nome')).toBeNull();
  expect(screen.queryAllByRole('alert')).toHaveLength(0);expect(api.foto).not.toHaveBeenCalled();expect(api.emitir).not.toHaveBeenCalled();
});

test('rascunho real do desenho sobrevive ao retorno a Dados e confirmação mantém as duas partes',async()=>{
  await abrir();pressionar('Usar modo demonstração sem câmera');dados();pressionar('Continuar para foto e assinatura');
  desenhar(10);pressionar('Voltar para dados');expect(screen.queryByTestId('quadro-assinatura')).toBeNull();
  expect(screen.getByLabelText('CPF').props.value).toBe(cartao.cpf);fireEvent.changeText(screen.getByLabelText('Nome'),'Maria Revisada');
  pressionar('Continuar para foto e assinatura');desenhar(90);pressionar('Confirmar assinatura');pressionar('Continuar para PIN e revisão');pin();
  expect(screen.getByText('Nome: Maria Revisada')).toBeTruthy();expect(screen.getByText('CPF: ***.***.***-00')).toBeTruthy();
  expect(screen.queryByText('123789')).toBeNull();expect(screen.queryByText(cartao.cpf)).toBeNull();
  pressionar('Gerar cartão');expect(api.emitir).not.toHaveBeenCalled();pressionar('Cancelar');
  expect(screen.getByLabelText('PIN de acesso (6 números)').props.value).toBe('123789');
  pressionar('Gerar cartão');await act(async()=>pressionar('Confirmar'));
  expect(api.emitir).toHaveBeenCalledWith(expect.objectContaining({nome:'Maria Revisada',assinatura:{largura:320,altura:180,tracos:[[{x:10,y:20},{x:50,y:60}],[{x:90,y:20},{x:130,y:60}]]}}),'admin-artificial',expect.any(AbortSignal));
});

test('foto, assinatura confirmada, consentimento e PIN permanecem ao voltar pelas três etapas',async()=>{
  await abrir();dados();coletar();
  pressionar('Voltar para foto e assinatura');expect(screen.getByLabelText('Foto confirmada para esta emissão')).toBeTruthy();
  expect(screen.getByText('Assinatura desenhada confirmada.')).toBeTruthy();pressionar('Voltar para dados');
  expect(screen.getByText('Consentimento confirmado para esta emissão.')).toBeTruthy();
  expect(screen.getByLabelText('Nome').props.value).toBe(cartao.nome);
  pressionar('Continuar para foto e assinatura');pressionar('Continuar para PIN e revisão');
  expect(screen.getByLabelText('PIN de acesso (6 números)').props.value).toBe('123789');expect(screen.getByLabelText('Confirme o PIN').props.value).toBe('123789');
  expect(api.foto).not.toHaveBeenCalled();expect(api.emitir).not.toHaveBeenCalled();
});

test('coleta incompleta impede avançar e PIN incorreto permanece na revisão com erro acessível',async()=>{
  await abrir();dados();pressionar('Concordo com a captura para esta demonstração');pressionar('Continuar para foto e assinatura');
  pressionar('Continuar para PIN e revisão');expect(screen.getByText(/capture e confirme a foto/i)).toBeTruthy();expect(screen.getByText(/desenhe e confirme a assinatura/i)).toBeTruthy();
  expect(screen.queryByLabelText('PIN de acesso (6 números)')).toBeNull();
  pressionar('Capturar foto do rosto');pressionar('Confirmar foto de teste');desenhar();pressionar('Confirmar assinatura');pressionar('Continuar para PIN e revisão');
  fireEvent.changeText(screen.getByLabelText('PIN de acesso (6 números)'),'123');fireEvent.changeText(screen.getByLabelText('Confirme o PIN'),'456');pressionar('Gerar cartão');
  expect(screen.getByText('Escolha um PIN com 6 números.').props.accessibilityRole).toBe('alert');expect(screen.getByText(/PINs não conferem/i)).toBeTruthy();
  expect(screen.getByText('Etapa 3 de 3: PIN e revisão')).toBeTruthy();expect(api.foto).not.toHaveBeenCalled();expect(api.emitir).not.toHaveBeenCalled();
});

test('falha ao emitir preserva coleta e dados e uma nova confirmação não repete upload já concluído',async()=>{
  api.emitir.mockRejectedValueOnce(Object.assign(new Error('offline'),{isAxiosError:true}));
  await abrir();dados();coletar();pressionar('Gerar cartão');await act(async()=>pressionar('Confirmar'));
  expect(await screen.findByText(/não foi possível conectar/i)).toBeTruthy();expect(screen.getByText('Etapa 3 de 3: PIN e revisão')).toBeTruthy();
  expect(screen.getByLabelText('PIN de acesso (6 números)').props.value).toBe('123789');
  pressionar('Voltar para foto e assinatura');expect(screen.getByLabelText('Foto confirmada para esta emissão')).toBeTruthy();expect(screen.getByText('Assinatura desenhada confirmada.')).toBeTruthy();
  pressionar('Continuar para PIN e revisão');pressionar('Gerar cartão');await act(async()=>pressionar('Confirmar'));
  await screen.findByRole('button',{name:'Usar este cartão na demonstração'});expect(api.foto).toHaveBeenCalledTimes(1);expect(api.emitir).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Etapa 1 de 3: Dados')).toBeTruthy();expect(screen.getByLabelText('Nome').props.value).toBe('');
});

test('voltar durante captura encerra câmera e mantém os dados do formulário',async()=>{
  await abrir();dados();pressionar('Concordo com a captura para esta demonstração');pressionar('Continuar para foto e assinatura');pressionar('Capturar foto do rosto');
  pressionar('Voltar para dados');expect(screen.queryByRole('button',{name:'Confirmar foto de teste',includeHiddenElements:true})).toBeNull();
  expect(screen.getByLabelText('Nome').props.value).toBe(cartao.nome);pressionar('Continuar para foto e assinatura');
  expect(screen.getByRole('button',{name:'Capturar foto do rosto'})).toBeTruthy();expect(api.foto).not.toHaveBeenCalled();
});


test('falha da lista após emissão mostra aviso visível e permite atualizar sem emitir de novo',async()=>{
  await abrir();dados();coletar();
  api.usuarios.mockRejectedValueOnce(Object.assign(new Error('offline'),{isAxiosError:true}));
  pressionar('Gerar cartão');await act(async()=>pressionar('Confirmar'));
  const aviso=await screen.findByText('Cartão gerado, mas não foi possível atualizar a lista. Use Atualizar lista para tentar novamente. Não é necessário gerar o cartão outra vez.');
  expect(aviso.props.accessibilityRole).toBe('alert');expect(screen.getByText('Etapa 1 de 3: Dados')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Usar este cartão na demonstração'})).toBeTruthy();
  await act(async()=>pressionar('Atualizar lista'));
  expect(screen.queryByText(/não é necessário gerar o cartão outra vez/i)).toBeNull();
  expect(screen.getByRole('button',{name:'Usar este cartão na demonstração'})).toBeTruthy();
  expect(api.foto).toHaveBeenCalledTimes(1);expect(api.emitir).toHaveBeenCalledTimes(1);
});

test('401 da lista após emissão mantém encerramento do acesso administrativo',async()=>{
  await abrir();dados();coletar();
  api.usuarios.mockRejectedValueOnce(Object.assign(new Error('encerrado'),{isAxiosError:true,response:{status:401,data:{mensagem:'Credencial encerrada.'}}}));
  pressionar('Gerar cartão');await act(async()=>pressionar('Confirmar'));
  await screen.findByText('Credencial encerrada.');
  expect(screen.getByLabelText('Credencial do responsável').props.value).toBe('');
  expect(screen.queryByRole('button',{name:'Usar este cartão na demonstração'})).toBeNull();
  expect(api.emitir).toHaveBeenCalledTimes(1);
});
