import request from 'supertest';
import { createApp } from '../src/app';

export const PIN_TESTE = '584926';
export const assinaturaTeste = {largura: 320, altura: 180, tracos: [[{x: 10, y: 120}, {x: 80, y: 30}, {x: 210, y: 100}]]};
export const coletaTeste = {modo: 'demonstracao', pin: PIN_TESTE, assinatura: assinaturaTeste};
export async function loginCompleto(app: ReturnType<typeof createApp>, dadosChip: unknown, cpfDigitado: string) {
  const resposta = await request(app).post('/api/autenticar-nfc').send({cpfDigitado, dadosChip});
  if (resposta.status !== 200) return resposta;
  return request(app).post('/api/autenticar-confirmar').send({desafioId: resposta.body.desafioId, pin: PIN_TESTE});
}
