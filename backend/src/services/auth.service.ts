import jwt from 'jsonwebtoken';
export function authService(secret:string) {
  if (secret.length < 32) throw new Error('O segredo JWT precisa de pelo menos 32 caracteres.');
  return {
    emitir(cpf:string) {return jwt.sign({},secret,{subject:cpf,expiresIn:'15m',algorithm:'HS256',issuer:'facilid',audience:'acessosenior'});},
    validar(token:string) {return jwt.verify(token,secret,{algorithms:['HS256'],issuer:'facilid',audience:'acessosenior'});}
  };
}
