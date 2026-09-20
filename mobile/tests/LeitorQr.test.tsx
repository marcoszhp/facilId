import React from 'react';
import { Linking, Platform } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useCameraPermissions } from 'expo-camera';
import { LeitorQr } from '../src/components/LeitorQr';

jest.mock('expo-camera', () => ({
  useCameraPermissions: jest.fn(),
  CameraView: ({ onBarcodeScanned, onMountError }: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'camera', onBarcodeScanned, onMountError });
  },
}));

const solicitar = jest.fn();
function permissao(granted: boolean, canAskAgain: boolean) {
  jest.mocked(useCameraPermissions).mockReturnValue([
    { granted, canAskAgain, status: granted ? 'granted' : 'denied', expires: 'never' },
    solicitar,
    jest.fn(),
  ] as ReturnType<typeof useCameraPermissions>);
}

beforeEach(() => { solicitar.mockResolvedValue({ granted: true }); });

test('recusa temporária permite solicitar novamente ou usar texto', async () => {
  permissao(false, true);
  const onManual = jest.fn();
  render(<LeitorQr onRead={jest.fn()} onClose={jest.fn()} onManual={onManual} />);
  fireEvent.press(screen.getByRole('button', { name: 'Permitir câmera' }));
  await waitFor(() => expect(solicitar).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('button', { name: 'Abrir configurações' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Usar código em texto' }));
  expect(onManual).toHaveBeenCalledTimes(1);
});

test('recusa permanente abre ajustes e preserva alternativa sem câmera', async () => {
  permissao(false, false);
  const abrir = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  const onManual = jest.fn();
  render(<LeitorQr onRead={jest.fn()} onClose={jest.fn()} onManual={onManual} />);
  expect(screen.queryByRole('button', { name: 'Permitir câmera' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Abrir configurações' }));
  await waitFor(() => expect(abrir).toHaveBeenCalledTimes(1));
  expect(solicitar).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Usar código em texto' }));
  expect(onManual).toHaveBeenCalledTimes(1);
});

test('aguarda consulta de permissão sem iniciar câmera', () => {
  jest.mocked(useCameraPermissions).mockReturnValue([null, solicitar, jest.fn()]);
  render(<LeitorQr onRead={jest.fn()} onClose={jest.fn()} />);
  expect(screen.getByText('Verificando permissão da câmera…')).toBeTruthy();
  expect(screen.queryByTestId('camera')).toBeNull();
});

test('código lido é entregue uma única vez e a câmera pode ser fechada', () => {
  permissao(true, true);
  const onRead = jest.fn();
  const onClose = jest.fn();
  render(<LeitorQr onRead={onRead} onClose={onClose} />);
  fireEvent(screen.getByTestId('camera'), 'barcodeScanned', { data: 'cartao-ficticio' });
  fireEvent(screen.getByTestId('camera'), 'barcodeScanned', { data: 'cartao-ficticio' });
  expect(onRead).toHaveBeenCalledTimes(1);
  expect(onRead).toHaveBeenCalledWith('cartao-ficticio');
  fireEvent.press(screen.getByRole('button', { name: 'Fechar câmera' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('falha ao solicitar permissão informa como continuar e permite tentar outra vez', async () => {
  permissao(false, true);
  solicitar.mockRejectedValueOnce(new Error('falha nativa de permissão'));
  const onManual = jest.fn();
  render(<LeitorQr onRead={jest.fn()} onClose={jest.fn()} onManual={onManual} />);
  fireEvent.press(screen.getByRole('button', { name: 'Permitir câmera' }));
  await screen.findByText(/não foi possível abrir a câmera/i);
  expect(screen.getByRole('button', { name: 'Permitir câmera' })).toBeEnabled();
  fireEvent.press(screen.getByRole('button', { name: 'Usar código em texto' }));
  expect(onManual).toHaveBeenCalledTimes(1);
});

test('câmera que não inicializa é removida e oferece alternativa em texto', () => {
  permissao(true, true);
  const onManual = jest.fn();
  render(<LeitorQr onRead={jest.fn()} onClose={jest.fn()} onManual={onManual} />);
  fireEvent(screen.getByTestId('camera'), 'mountError', { message: 'camera indisponível' });
  expect(screen.queryByTestId('camera')).toBeNull();
  expect(screen.getByText(/não foi possível iniciar a câmera/i)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Usar código em texto' }));
  expect(onManual).toHaveBeenCalledTimes(1);
});

test('bloqueio permanente no navegador orienta ajustes do site sem chamar ajustes nativos', () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  permissao(false, false);
  render(<LeitorQr onRead={jest.fn()} onClose={jest.fn()} />);
  expect(screen.getByText(/configurações deste site no navegador/i)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Abrir configurações' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Usar código em texto' })).toBeEnabled();
});
