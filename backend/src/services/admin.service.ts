import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RequestHandler } from 'express';

export function carregarAdminToken(dir: string): string {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN;
  mkdirSync(dir, {recursive: true});
  const file = path.join(dir, 'admin.token');
  if (!existsSync(file)) writeFileSync(file, randomBytes(48).toString('hex'), {mode: 0o600, flag: 'wx'});
  return readFileSync(file, 'utf8').trim();
}

export function exigirAdministrador(token: string): RequestHandler {
  if (token.length < 32) throw new Error('A chave administrativa precisa de pelo menos 32 caracteres.');
  const esperado = createHash('sha256').update(token).digest();
  return (req, res, next) => {
    const recebido = req.header('X-Admin-Token') || '';
    const digest = createHash('sha256').update(recebido).digest();
    if (!recebido || !timingSafeEqual(digest, esperado)) {
      res.status(401).json({mensagem: 'Acesso restrito ao responsável. Confira a chave administrativa.'});
      return;
    }
    next();
  };
}
