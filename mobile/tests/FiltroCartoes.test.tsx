import React from 'react';
import { act,fireEvent,render,screen } from '@testing-library/react-native';
import { EmissorScreen } from '../src/screens/EmissorScreen';
import { criarApi } from '../src/services/api.service';
import { cartao } from './helpers';

jest.mock('../src/services/api.service',()=>({...jest.requireActual('../src/services/api.service'),criarApi:jest.fn()}));
jest.mock('../src/services/nfc.service',()=>({cancelarNfc:jest.fn().mockResolvedValue(undefined),gravarNfc:jest.fn()}));
jest.mock('../src/services/feedback',()=>({falar:jest.fn(),feedback:jest.fn(),pararAudio:jest.fn()}));
jest.mock('react-native-qrcode-svg',()=>()=>null);
jest.mock('../src/components/CapturaFoto',()=>({CapturaFoto:()=>null}));
jest.mock('../src/components/AssinaturaManuscrita',()=>({AssinaturaManuscrita:()=>null}));
const api={usuarios:jest.fn(),bloquear:jest.fn()};
const itens=[
  {...cartao,nome:'José Ávila',estado:'ativo'},
  {...cartao,nome:'José Ávila',estado:'substituido',emissaoId:'substituido-teste'},
  {...cartao,nome:'Ana Fictícia',cpf:'98765432111',estado:'bloqueado',emissaoId:'bloqueado-teste'},
];
const pressionar=(name:string)=>fireEvent.press(screen.getByRole('button',{name}));
const buscar=(texto:string)=>fireEvent.changeText(screen.getByLabelText('Buscar cartão por nome ou CPF'),texto);
async function abrir(){
  render(<EmissorScreen url="http://localhost:3000" onUseCard={jest.fn()}/>);
  fireEvent.changeText(screen.getByLabelText('Credencial do responsável'),'admin-teste');pressionar('Acessar área do responsável');
  await screen.findByLabelText('Buscar cartão por nome ou CPF');
}
beforeEach(()=>{
  Object.values(api).forEach(mock=>mock.mockReset());api.usuarios.mockResolvedValue(itens);api.bloquear.mockResolvedValue({});
  jest.mocked(criarApi).mockReturnValue(api as unknown as ReturnType<typeof criarApi>);
});

test('busca nome sem acentos/maiúsculas combina com estado e limpar restaura a lista sem rede',async()=>{
  await abrir();buscar('JOSE AVILA');expect(screen.getAllByText('José Ávila')).toHaveLength(2);expect(screen.queryByText('Ana Fictícia')).toBeNull();
  pressionar('Substituídos');expect(screen.getAllByText('José Ávila')).toHaveLength(1);expect(screen.getByText('Exibindo 1 de 3 cartões.')).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Bloquear cartão de José Ávila'})).toBeNull();
  pressionar('Ativos');expect(screen.getByRole('button',{name:'Bloquear cartão de José Ávila'})).toBeTruthy();
  pressionar('Limpar busca e filtros');expect(screen.getByLabelText('Buscar cartão por nome ou CPF').props.value).toBe('');
  expect(screen.getByRole('button',{name:'Todos (selecionado)'})).toBeTruthy();expect(screen.getByText('Exibindo 3 de 3 cartões.')).toBeTruthy();
  expect(api.usuarios).toHaveBeenCalledTimes(1);
});

test('CPF formatado e parcial localiza registros, sem imprimir CPF completo nas linhas',async()=>{
  await abrir();buscar('987.654.321-11');expect(screen.getByText('Ana Fictícia')).toBeTruthy();expect(screen.queryByText('José Ávila')).toBeNull();
  expect(screen.getByText('CPF: ***.***.***-11 • bloqueado')).toBeTruthy();expect(screen.queryByText('98765432111')).toBeNull();
  buscar('123.456');expect(screen.getAllByText('José Ávila')).toHaveLength(2);expect(screen.queryByText('Ana Fictícia')).toBeNull();
});

test('resultado vazio distingue ausência de correspondência de base sem cartões',async()=>{
  await abrir();buscar('Jose');pressionar('Bloqueados');
  expect(screen.getByText('Nenhum cartão corresponde à busca e ao estado escolhidos. Limpe ou altere os filtros.')).toBeTruthy();
  expect(screen.queryByText(/nenhum cartão emitido nesta versão/i)).toBeNull();
  pressionar('Limpar busca e filtros');api.usuarios.mockResolvedValueOnce([]);await act(async()=>pressionar('Atualizar lista'));
  expect(screen.getByText(/nenhum cartão emitido nesta versão/i)).toBeTruthy();expect(screen.queryByText(/nenhum cartão corresponde/i)).toBeNull();
});

test('filtrar não muda rascunho da emissão, trava durante confirmação e atualiza a lista após bloquear',async()=>{
  await abrir();fireEvent.changeText(screen.getByLabelText('Nome'),'Rascunho preservado');buscar('jose');pressionar('Ativos');
  pressionar('Bloquear cartão de José Ávila');expect(api.bloquear).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Buscar cartão por nome ou CPF').props.editable).toBe(false);
  expect(screen.getByRole('button',{name:'Limpar busca e filtros'}).props.accessibilityState.disabled).toBe(true);
  pressionar('Cancelar');expect(screen.getByLabelText('Nome').props.value).toBe('Rascunho preservado');
  expect(screen.getByLabelText('Buscar cartão por nome ou CPF').props.value).toBe('jose');
  api.usuarios.mockResolvedValueOnce(itens.map(item=>item.estado==='ativo'?{...item,estado:'bloqueado'}:item));
  pressionar('Bloquear cartão de José Ávila');await act(async()=>pressionar('Confirmar'));
  expect(api.bloquear).toHaveBeenCalledTimes(1);expect(screen.getByText(/nenhum cartão corresponde/i)).toBeTruthy();
  pressionar('Bloqueados');expect(screen.getByText('José Ávila')).toBeTruthy();
});

test('encerrar responsável limpa busca e estado antes de nova entrada',async()=>{
  await abrir();buscar('jose');pressionar('Ativos');pressionar('Encerrar acesso do responsável');
  fireEvent.changeText(screen.getByLabelText('Credencial do responsável'),'admin-teste');pressionar('Acessar área do responsável');
  await screen.findByLabelText('Buscar cartão por nome ou CPF');expect(screen.getByLabelText('Buscar cartão por nome ou CPF').props.value).toBe('');
  expect(screen.getByRole('button',{name:'Todos (selecionado)'})).toBeTruthy();
});
