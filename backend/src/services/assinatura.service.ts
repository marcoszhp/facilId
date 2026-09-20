import { generateKeyPairSync, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Chip, Identidade } from '../schemas/payload';

// Ordem canônica: a assinatura não depende da ordem das propriedades recebidas.
export function canonicalizar(p: Identidade): string {
  return JSON.stringify({versao:p.versao,emissaoId:p.emissaoId,cpf:p.cpf,nome:p.nome,idade:p.idade,rosto_hash:p.rosto_hash,digital_template:p.digital_template,assinatura_svg:p.assinatura_svg});
}
export function carregarChaves(dir: string) {
  mkdirSync(dir, {recursive:true});
  const priv = path.join(dir,'private.pem'), pub = path.join(dir,'public.pem');
  if (!existsSync(priv) && existsSync(pub)) throw new Error('Chave privada ausente. Restaure o par original.');
  if (!existsSync(priv)) {
    const keys = generateKeyPairSync('rsa', {modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
    writeFileSync(priv,keys.privateKey,{mode:0o600,flag:'wx'});
    writeFileSync(pub,keys.publicKey,{flag:'wx'});
  }
  const privateKey = readFileSync(priv,'utf8');
  const publicKey = createPublicKey(createPrivateKey(privateKey)).export({type:'spki',format:'pem'}).toString();
  if (!existsSync(pub)) writeFileSync(pub,publicKey,{flag:'wx'});
  if (readFileSync(pub,'utf8') !== publicKey) throw new Error('As chaves RSA não correspondem.');
  return { privateKey, publicKey };
}
export function assinaturaService(keys: ReturnType<typeof carregarChaves>) {
  return {
    assinar(p: Identidade): Chip {return {...p,assinatura_digital_orgao:sign('RSA-SHA256',Buffer.from(canonicalizar(p)),keys.privateKey).toString('base64')};},
    validar(p: Chip) {try {return verify('RSA-SHA256',Buffer.from(canonicalizar(p)),keys.publicKey,Buffer.from(p.assinatura_digital_orgao,'base64'));} catch {return false;}}
  };
}
if (require.main === module) {carregarChaves(path.resolve(process.env.DATA_DIR || '.local','keys')); console.log('Par RSA disponível, sem substituir chaves existentes.');}
