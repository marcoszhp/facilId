import { createHash } from 'node:crypto';
import { Desenho } from '../schemas/coleta';

export class ErroColeta extends Error {
  constructor(message: string, public status = 400) {super(message);}
}
export const hashBytes = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
// Pixel artificial do modo explicitamente identificado como demonstração.
export const FOTO_DEMONSTRACAO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));}
  return (crc ^ 0xffffffff) >>> 0;
}

export function gerarSvg(desenho: Desenho) {
  const tracos = desenho.tracos.map(traco => traco.map(p => ({x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2))})));
  if (!tracos.some(t => t.some(p => p.x !== t[0].x || p.y !== t[0].y))) {
    throw new ErroColeta('Desenhe sua assinatura antes de confirmar.');
  }
  // Somente números validados e comandos M/L; nenhum SVG ou markup do cliente é aceito.
  const paths = tracos.map(t => `<path d="${t.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><g fill="none" stroke="#111111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}

export function validarFoto(base64: string, mimeType: 'image/jpeg' | 'image/png') {
  if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new ErroColeta('Foto inválida. Capture novamente.');
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new ErroColeta('A foto deve ter até 2 MB.', 413);
  if (bytes.toString('base64') !== base64) throw new ErroColeta('Foto inválida. Capture novamente.');
  let largura = 0, altura = 0;
  if (mimeType === 'image/png') {
    if (bytes.length < 57 || !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new ErroColeta('A imagem não é PNG válido.');
    let offset = 8, viuDados = false, terminou = false;
    while (offset + 12 <= bytes.length) {
      const tamanho = bytes.readUInt32BE(offset), tipo = bytes.toString('ascii', offset + 4, offset + 8);
      if (tamanho > bytes.length - offset - 12) throw new ErroColeta('PNG incompleto. Capture novamente.');
      if (crc32(bytes.subarray(offset + 4, offset + 8 + tamanho)) !== bytes.readUInt32BE(offset + 8 + tamanho)) throw new ErroColeta('PNG corrompido. Capture novamente.');
      if (offset === 8) {
        if (tipo !== 'IHDR' || tamanho !== 13) throw new ErroColeta('PNG inválido.');
        largura = bytes.readUInt32BE(offset + 8); altura = bytes.readUInt32BE(offset + 12);
      }
      if (tipo === 'IDAT' && tamanho > 0) viuDados = true;
      offset += tamanho + 12;
      if (tipo === 'IEND') {terminou = tamanho === 0 && offset === bytes.length; break;}
    }
    if (!viuDados || !terminou) throw new ErroColeta('PNG incompleto. Capture novamente.');
  } else {
    if (bytes.length < 20 || bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) throw new ErroColeta('A imagem não é JPEG válido.');
    let offset = 2, viuScan = false;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 0xff) throw new ErroColeta('JPEG inválido.');
      while (bytes[offset] === 0xff) offset++;
      const marcador = bytes[offset++];
      if (offset + 2 > bytes.length) throw new ErroColeta('JPEG incompleto.');
      const tamanho = bytes.readUInt16BE(offset);
      if (tamanho < 2 || offset + tamanho > bytes.length) throw new ErroColeta('JPEG incompleto.');
      if (marcador === 0xda) {viuScan = tamanho >= 6 && offset + tamanho < bytes.length - 2; break;}
      if ([0xc0,0xc1,0xc2].includes(marcador) && tamanho >= 8) {
        altura = bytes.readUInt16BE(offset + 3); largura = bytes.readUInt16BE(offset + 5);
      }
      offset += tamanho;
    }
    if (!viuScan) throw new ErroColeta('JPEG sem dados de imagem.');
  }
  if (!largura || !altura || largura > 4096 || altura > 4096 || largura * altura > 12_000_000) throw new ErroColeta('Reduza a resolução da foto e tente novamente.');
  return bytes;
}
