import React from 'react';
import { Platform } from 'react-native';
import { act,fireEvent,render,screen,waitFor } from '@testing-library/react-native';
import { useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { CapturaFoto,dadosDaFoto,escolherTamanhoFoto } from '../src/components/CapturaFoto';
import { pendente } from './helpers';

const mockTirar=jest.fn(),mockTamanhos=jest.fn();
jest.mock('expo-camera',()=>({
  useCameraPermissions:jest.fn(),
  CameraView:require('react').forwardRef((props:any,ref:any)=>{
    const React=require('react'),{View}=require('react-native');
    React.useImperativeHandle(ref,()=>({takePictureAsync:mockTirar,getAvailablePictureSizesAsync:mockTamanhos}));
    return React.createElement(View,{testID:'camera-foto-mock',onCameraReady:props.onCameraReady,pictureSize:props.pictureSize});
  }),
}));
jest.mock('expo-file-system/legacy',()=>({cacheDirectory:'file:///cache/',deleteAsync:jest.fn()}));
const fotoFicticia={uri:'file:///cache/camera/teste.jpg',base64:'aW1hZ2Vt',format:'jpg' as const,width:640,height:480};
beforeEach(()=>{
  jest.replaceProperty(Platform,'OS','android');
  jest.mocked(useCameraPermissions).mockReturnValue([{granted:true,canAskAgain:true,status:'granted',expires:'never'},jest.fn(),jest.fn()] as ReturnType<typeof useCameraPermissions>);
  mockTirar.mockResolvedValue(fotoFicticia);mockTamanhos.mockResolvedValue(['4000x3000','1280x960','640x480']);
  jest.mocked(FileSystem.deleteAsync).mockResolvedValue(undefined);
});
async function tirar(){
  fireEvent(screen.getByTestId('camera-foto-mock'),'cameraReady');
  await waitFor(()=>expect(screen.getByRole('button',{name:'Tirar foto'})).toBeEnabled());
  fireEvent.press(screen.getByRole('button',{name:'Tirar foto'}));
}
test('foto exige prévia e confirmação, permite refazer e limpa o arquivo temporário antes da prévia',async()=>{
  const confirmar=jest.fn();render(<CapturaFoto onConfirm={confirmar} onCancel={jest.fn()}/>);
  await tirar();await screen.findByTestId('preview-foto');
  expect(confirmar).not.toHaveBeenCalled();expect(FileSystem.deleteAsync).toHaveBeenCalledWith(fotoFicticia.uri,{idempotent:true});
  fireEvent.press(screen.getByRole('button',{name:'Refazer foto'}));expect(screen.queryByTestId('preview-foto')).toBeNull();
  await tirar();await screen.findByRole('button',{name:'Confirmar foto'});
  fireEvent.press(screen.getByRole('button',{name:'Confirmar foto'}));
  expect(confirmar).toHaveBeenCalledWith({base64:'aW1hZ2Vt',mimeType:'image/jpeg'});
  expect(mockTirar).toHaveBeenCalledWith(expect.objectContaining({base64:true,exif:false}));
});
test('sair durante captura ignora a resposta tardia e ainda remove o arquivo temporário',async()=>{
  const captura=pendente<typeof fotoFicticia>();mockTirar.mockReturnValueOnce(captura.promise);
  const confirmar=jest.fn();const tela=render(<CapturaFoto onConfirm={confirmar} onCancel={jest.fn()}/>);
  await tirar();tela.unmount();
  await act(async()=>{captura.resolver(fotoFicticia);});
  expect(confirmar).not.toHaveBeenCalled();expect(FileSystem.deleteAsync).toHaveBeenCalledWith(fotoFicticia.uri,{idempotent:true});
});
test('permissão permanentemente negada oferece configurações e cancelamento sem capturar',()=>{
  jest.mocked(useCameraPermissions).mockReturnValue([{granted:false,canAskAgain:false,status:'denied',expires:'never'},jest.fn(),jest.fn()] as ReturnType<typeof useCameraPermissions>);
  const cancelar=jest.fn();render(<CapturaFoto onConfirm={jest.fn()} onCancel={cancelar}/>);
  expect(screen.getByRole('button',{name:'Abrir configurações da câmera'})).toBeTruthy();
  expect(screen.queryByTestId('camera-foto-mock')).toBeNull();
  fireEvent.press(screen.getByRole('button',{name:'Cancelar captura'}));expect(cancelar).toHaveBeenCalledTimes(1);
});
test('escolhe tamanho suportado moderado e rejeita fotos que excedem bytes ou dimensões',()=>{
  expect(escolherTamanhoFoto(['4000x3000','1280x960','640x480'])).toBe('1280x960');
  expect(()=>dadosDaFoto({...fotoFicticia,width:5000})).toThrow(/grande demais/i);
  expect(()=>dadosDaFoto({...fotoFicticia,base64:'A'.repeat(2*1024*1024*4/3+8)})).toThrow(/muito grande/i);
  expect(dadosDaFoto({...fotoFicticia,format:'png',base64:'data:image/png;base64,aW1hZ2Vt'})).toEqual({base64:'aW1hZ2Vt',mimeType:'image/png'});
});
test('no navegador permissão negada orienta ajustes do site mesmo com canAskAgain do SDK',()=>{
  jest.replaceProperty(Platform,'OS','web');
  jest.mocked(useCameraPermissions).mockReturnValue([{granted:false,canAskAgain:true,status:'denied',expires:'never'},jest.fn(),jest.fn()] as ReturnType<typeof useCameraPermissions>);
  render(<CapturaFoto onConfirm={jest.fn()} onCancel={jest.fn()}/>);
  expect(screen.getByText(/configurações deste site no navegador/i)).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Permitir câmera para foto'})).toBeNull();
  expect(screen.getByRole('button',{name:'Cancelar captura'})).toBeEnabled();
});
