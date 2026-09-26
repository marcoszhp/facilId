import React from 'react';
import {fireEvent,render,screen} from '@testing-library/react-native';
import App from '../App';

jest.mock('../src/components/ControleAudio',()=>({ControleAudio:()=>null}));
jest.mock('../src/screens/SucessoScreen',()=>({SucessoScreen:()=>null}));
jest.mock('../src/screens/LoginScreen',()=>({LoginScreen:({url,cartaoDemonstracao}:any)=>{
  const React=require('react'),{View,Text}=require('react-native');
  return React.createElement(View,null,React.createElement(Text,null,'Serviço atual: '+url),React.createElement(Text,null,cartaoDemonstracao?'Cartão preparado preservado':'Sem cartão preparado'));
}}));
jest.mock('../src/screens/EmissorScreen',()=>({EmissorScreen:({url,onUseCard}:any)=>{
  const React=require('react'),{View,Text,TextInput,Button}=require('react-native');
  const [nome,setNome]=React.useState('');
  return React.createElement(View,null,React.createElement(Text,null,'Serviço atual: '+url),
    React.createElement(TextInput,{accessibilityLabel:'Cadastro em preparação',value:nome,onChangeText:setNome}),
    React.createElement(Button,{title:'Preparar cartão de teste',onPress:()=>onUseCard(require('./helpers').cartao)}));
}}));
const novo='http://127.0.0.1:3456';
function responsavel(){fireEvent.press(screen.getByRole('button',{name:'Área do responsável'}));}
function ajustes(){fireEvent.press(screen.getByRole('button',{name:'Ajustar conexão'}));}
test('cidadão não vê configuração técnica; responsável pode abrir o rascunho',()=>{
  render(<App/>);
  expect(screen.queryByRole('button',{name:'Ajustar conexão'})).toBeNull();
  expect(screen.queryByLabelText('Endereço do serviço')).toBeNull();
  responsavel();ajustes();expect(screen.getByLabelText('Endereço do serviço')).toBeTruthy();
});
test('digitar, salvar sem confirmar e cancelar preservam formulário e serviço atual',()=>{
  render(<App/>);responsavel();
  fireEvent.changeText(screen.getByLabelText('Cadastro em preparação'),'Maria em preparo');ajustes();
  const anterior=screen.getByLabelText('Endereço do serviço').props.value;
  fireEvent.changeText(screen.getByLabelText('Endereço do serviço'),novo);
  fireEvent.press(screen.getByRole('button',{name:'Salvar conexão'}));
  expect(screen.getByText('Serviço atual: '+anterior)).toBeTruthy();
  expect(screen.getByLabelText('Cadastro em preparação').props.value).toBe('Maria em preparo');
  fireEvent.press(screen.getByRole('button',{name:'Cancelar mudança de conexão'}));
  fireEvent.press(screen.getByRole('button',{name:'Fechar ajustes'}));
  expect(screen.getByLabelText('Cadastro em preparação').props.value).toBe('Maria em preparo');
});
test('cartão preparado só é descartado após confirmação explícita do novo serviço',()=>{
  render(<App/>);responsavel();fireEvent.press(screen.getByRole('button',{name:'Preparar cartão de teste'}));
  expect(screen.getByText('Cartão preparado preservado')).toBeTruthy();
  responsavel();ajustes();fireEvent.changeText(screen.getByLabelText('Endereço do serviço'),novo);
  fireEvent.press(screen.getByRole('button',{name:'Salvar conexão'}));fireEvent.press(screen.getByRole('button',{name:'Cancelar mudança de conexão'}));
  fireEvent.press(screen.getByRole('button',{name:'Voltar para entrar'}));
  expect(screen.getByText('Cartão preparado preservado')).toBeTruthy();
  responsavel();fireEvent.changeText(screen.getByLabelText('Cadastro em preparação'),'Rascunho');ajustes();
  fireEvent.changeText(screen.getByLabelText('Endereço do serviço'),novo);
  fireEvent.press(screen.getByRole('button',{name:'Salvar conexão'}));fireEvent.press(screen.getByRole('button',{name:'Confirmar mudança de conexão'}));
  expect(screen.getByText('Serviço atual: '+novo)).toBeTruthy();
  expect(screen.getByLabelText('Cadastro em preparação').props.value).toBe('');
  fireEvent.press(screen.getByRole('button',{name:'Voltar para entrar'}));
  expect(screen.getByText('Sem cartão preparado')).toBeTruthy();
});
test.each(['ftp://localhost','endereço inválido','http://usuario:senha@localhost','http://localhost?token=ficticio'])('endereço inválido não altera a conexão: %s',valor=>{
  render(<App/>);responsavel();ajustes();
  const anterior=screen.getByLabelText('Endereço do serviço').props.value;
  fireEvent.changeText(screen.getByLabelText('Endereço do serviço'),valor);
  fireEvent.press(screen.getByRole('button',{name:'Salvar conexão'}));
  expect(screen.getByText(/Informe um endereço HTTP/)).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Confirmar mudança de conexão'})).toBeNull();
  expect(screen.getByText('Serviço atual: '+anterior)).toBeTruthy();
});
test('salvar endereço inalterado não reinicia o formulário',()=>{
  render(<App/>);responsavel();fireEvent.changeText(screen.getByLabelText('Cadastro em preparação'),'Preservar');
  ajustes();fireEvent.press(screen.getByRole('button',{name:'Salvar conexão'}));
  expect(screen.getByLabelText('Cadastro em preparação').props.value).toBe('Preservar');
  expect(screen.queryByLabelText('Endereço do serviço')).toBeNull();
});
