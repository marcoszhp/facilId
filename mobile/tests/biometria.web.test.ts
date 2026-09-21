import { disponibilidadeBiometria, guardarCredencialBiometrica, lerCredencialBiometrica } from '../src/services/biometria.service.web';
import { cartao } from './helpers';

test('navegador oferece PIN e não declara autenticação biométrica nem guarda credencial', async () => {
  await expect(disponibilidadeBiometria()).resolves.toEqual(expect.objectContaining({ disponivel: false, mensagem: expect.stringMatching(/PIN/i) }));
  const leitura = await lerCredencialBiometrica('http://localhost:3000', cartao.emissaoId);
  expect(leitura.credencial).toBeUndefined();
  expect(leitura.mensagem).toMatch(/PIN/i);
  await expect(guardarCredencialBiometrica('http://localhost:3000', cartao.emissaoId, 'credencial-ficticia')).resolves.toBe(false);
});
