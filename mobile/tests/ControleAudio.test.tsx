import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ControleAudio } from '../src/components/ControleAudio';
import { observarAudio, pararAudio } from '../src/services/feedback';

jest.mock('../src/services/feedback', () => ({ observarAudio: jest.fn(), pararAudio: jest.fn() }));

test('oferece parar durante a fala e remove o controle quando o áudio termina', () => {
  let atualizar!: (ativo: boolean) => void;
  const removerObservador = jest.fn();
  jest.mocked(observarAudio).mockImplementation(observer => {
    atualizar = observer;
    observer(false);
    return removerObservador;
  });
  const view = render(<ControleAudio />);
  expect(screen.queryByRole('button', { name: 'Parar áudio' })).toBeNull();
  act(() => { atualizar(true); });
  fireEvent.press(screen.getByRole('button', { name: 'Parar áudio' }));
  expect(pararAudio).toHaveBeenCalledTimes(1);
  act(() => { atualizar(false); });
  expect(screen.queryByRole('button', { name: 'Parar áudio' })).toBeNull();
  view.unmount();
  expect(removerObservador).toHaveBeenCalledTimes(1);
});
