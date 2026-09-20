import jwt from 'jsonwebtoken';
export function authService(secret: string) {
  if (secret.length < 32) throw new Error('O segredo JWT precisa de pelo menos 32 caracteres.');
  return {
    emitir(cpf: string, emissaoId: string) {
      const exp = Math.floor(Date.now() / 1000) + 15 * 60;
      const token = jwt.sign({emissaoId, exp}, secret, {
        subject: cpf, algorithm: 'HS256', issuer: 'facilid', audience: 'acessosenior'
      });
      return {token, expiraEm: exp * 1000};
    },
    validar(token: string) {
      return jwt.verify(token, secret, {algorithms: ['HS256'], issuer: 'facilid', audience: 'acessosenior'});
    }
  };
}
