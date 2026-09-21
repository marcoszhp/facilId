import request from 'supertest';
import { createDecipheriv, createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { createApp } from '../src/app';
import { authService } from '../src/services/auth.service';
import { assinaturaService, carregarChaves } from '../src/services/assinatura.service';
import { JsonUsuariosRepository } from '../src/repositories/usuarios.repository';
import { desafioService } from '../src/services/desafio.service';
import { assinaturaTeste, coletaTeste, PIN_TESTE } from './helpers';

const secret = 'segredo-exclusivo-teste-coleta-mais-de-32-caracteres';
const admin = 'responsavel-exclusivo-teste-coleta-mais-de-32-caracteres';
const pessoa = {cpf: '12345678900', nome: 'Voluntário Teste', idade: 68};
let dir: string, app: ReturnType<typeof createApp>;
beforeEach(() => {dir = mkdtempSync(path.join(tmpdir(), 'facilid-coleta-')); app = createApp(dir, secret, admin);});
afterEach(() => {jest.restoreAllMocks(); rmSync(dir, {recursive: true, force: true});});
const digest = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const emitir = (dados: object = {}, target = app) => request(target).post('/api/emissao').set('X-Admin-Token', admin).send({...pessoa, ...coletaTeste, ...dados});
const desafiar = (chip: any, target = app) => request(target).post('/api/autenticar-nfc').send({cpfDigitado: chip.cpf, dadosChip: chip});
const confirmar = (desafioId: string, fator: object = {pin: PIN_TESTE}, target = app) => request(target).post('/api/autenticar-confirmar').send({desafioId, ...fator});
const upload = (bytes = png(30), mimeType = 'image/png') => request(app).post('/api/emissao/foto').set('X-Admin-Token', admin).send({base64: bytes.toString('base64'), mimeType});
function crc32(b: Buffer) {let c = 0xffffffff; for (const v of b) {c ^= v; for (let j = 0; j < 8; j++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);} return (c ^ 0xffffffff) >>> 0;}
function png(cor: number) {
  const chunk = (tipo: string, dados: Buffer) => {const size = Buffer.alloc(4); size.writeUInt32BE(dados.length); const content = Buffer.concat([Buffer.from(tipo), dados]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(content)); return Buffer.concat([size, content, crc]);};
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1,0); ihdr.writeUInt32BE(1,4); ihdr[8]=8; ihdr[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR',ihdr), chunk('IDAT',deflateSync(Buffer.from([0,cor,20,30]))), chunk('IEND',Buffer.alloc(0))]);
}
function lerPrivado(nome: string) {
  const base = path.join(dir, 'coletas'), bytes = readFileSync(path.join(base, nome + '.bin'));
  const decipher = createDecipheriv('aes-256-gcm', readFileSync(path.join(base, 'coleta.key')), bytes.subarray(0,12));
  decipher.setAAD(Buffer.from('facilid-coleta:' + nome)); decipher.setAuthTag(bytes.subarray(12,28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]);
}

test('foto real e assinatura desenhada são cifradas; cartão contém somente hashes e marcador honesto', async () => {
  const foto = png(30), referencia = (await upload(foto).expect(201)).body;
  expect(referencia.hash).toBe(digest(foto)); expect(Object.keys(referencia).sort()).toEqual(['hash','id']);
  const chip = (await emitir({modo:'real',fotoId:referencia.id,consentimento:true}).expect(201)).body;
  expect(chip.rosto_hash).toBe(digest(foto)); expect(chip.digital_template).toBe('BIOMETRIA_LOCAL_NAO_COLETADA');
  const svg = lerPrivado('assinatura-' + chip.emissaoId).toString();
  expect(svg).toContain('M10 120 L80 30 L210 100'); expect(chip.assinatura_svg).toBe('sha256:' + digest(svg));
  expect(lerPrivado('foto-' + chip.emissaoId)).toEqual(foto);
  expect(assinaturaService(carregarChaves(path.join(dir,'keys'))).validar(chip)).toBe(true);
  expect(JSON.stringify(chip)).not.toContain(PIN_TESTE); expect(JSON.stringify(chip)).not.toContain('<svg');
  const index = JSON.parse(lerPrivado('indice').toString());
  expect(index.emissoes[chip.emissaoId].pinHash).toMatch(/^[a-f0-9]{64}$/);
  expect(index.emissoes[chip.emissaoId].pinSalt).toMatch(/^[a-f0-9]{32}$/);
  expect(index.emissoes[chip.emissaoId]).not.toHaveProperty('pin');
  for (const file of readdirSync(path.join(dir,'coletas')).filter(f => f.endsWith('.bin'))) {
    const raw = readFileSync(path.join(dir,'coletas',file));
    expect(raw.includes(Buffer.from('<svg'))).toBe(false); expect(raw.includes(foto)).toBe(false); expect(raw.includes(Buffer.from(PIN_TESTE))).toBe(false);
  }
});

test('mudar foto ou traço altera o respectivo hash assinado', async () => {
  const r1 = (await upload(png(40))).body, r2 = (await upload(png(50))).body;
  const c1 = (await emitir({modo:'real',fotoId:r1.id,consentimento:true}).expect(201)).body;
  const c2 = (await emitir({modo:'real',fotoId:r2.id,consentimento:true,assinatura:{...assinaturaTeste,tracos:[[{x:15,y:120},{x:90,y:40}]]}}).expect(201)).body;
  expect(c1.rosto_hash).not.toBe(c2.rosto_hash); expect(c1.assinatura_svg).not.toBe(c2.assinatura_svg);
});

test('modo demonstração funciona sem câmera, mantém PIN e identifica biometria não coletada', async () => {
  const chip = (await emitir().expect(201)).body;
  expect(chip.digital_template).toBe('DEMONSTRACAO_SEM_BIOMETRIA');
  expect((await confirmar((await desafiar(chip)).body.desafioId)).status).toBe(200);
  const metadata = await request(app).get(`/api/cartoes/${chip.emissaoId}/coleta`).set('X-Admin-Token',admin).expect(200);
  expect(metadata.body.modo).toBe('demonstracao'); expect(metadata.body).not.toHaveProperty('pinHash');
});

test.each([{modo:'real'}, {modo:'real',fotoId:randomUUID(),consentimento:false}, {modo:'demonstracao',fotoId:randomUUID()}])('coleta real exige foto/consentimento e demo não disfarça upload: caso %#', async extras => {
  expect((await emitir(extras)).status).toBe(400);
});

test.each([{tracos:[]}, {tracos:[[{x:10,y:20},{x:10,y:20}]]}, {tracos:[[{x:0,y:0},{x:0.001,y:0.001}]]}])('assinatura vazia ou sem deslocamento útil é recusada: caso %#', async ({tracos}) => {
  expect((await emitir({assinatura:{largura:320,altura:180,tracos}})).status).toBe(400);
});

test('assinatura não aceita markup, coordenadas fora da área ou pontos demais', async () => {
  for (const assinatura of [
    '<svg onload="alert(1)"/>', {...assinaturaTeste,svg:'<script/>'},
    {...assinaturaTeste,tracos:[[{x:-1,y:0},{x:10,y:20}]]},
    {...assinaturaTeste,tracos:Array.from({length:3},()=>Array.from({length:501},(_,i)=>({x:i%320,y:10})))}
  ]) expect((await emitir({assinatura})).status).toBe(400);
});

test('foto exige administração antes do parser e não pode ser servida publicamente', async () => {
  expect((await request(app).post('/api/emissao/foto').set('Content-Type','application/json').send('{')).status).toBe(401);
  expect((await request(app).post('/api/emissao/foto').set('X-Admin-Token','incorreto').send({base64:png(20).toString('base64'),mimeType:'image/png'})).status).toBe(401);
  const chip = (await emitir()).body;
  const sessao = (await confirmar((await desafiar(chip)).body.desafioId)).body;
  expect((await request(app).post('/api/emissao/foto').set('X-Admin-Token',sessao.token).send({})).status).toBe(401);
  expect((await request(app).get(`/api/cartoes/${chip.emissaoId}/coleta`)).status).toBe(401);
  expect((await request(app).get(`/coletas/foto-${chip.emissaoId}.bin`)).status).toBe(404);
});

test('foto recusa MIME divergente, base64 inválido, arquivo truncado e CRC alterado', async () => {
  expect((await upload(png(20),'image/jpeg')).status).toBe(400);
  expect((await request(app).post('/api/emissao/foto').set('X-Admin-Token',admin).send({base64:'!invalido!',mimeType:'image/png'})).status).toBe(400);
  expect((await upload(png(20).subarray(0,30))).status).toBe(400);
  const corrupta = png(20); corrupta[corrupta.length-6] ^= 1;
  expect((await upload(corrupta)).status).toBe(400);
});

test('limite de 2 MB é aplicado após decodificar; parser grande só existe no upload', async () => {
  expect((await upload(Buffer.alloc(2*1024*1024+1))).status).toBe(413);
  expect((await request(app).post('/api/autenticar-nfc').send({x:'z'.repeat(20_000)})).status).toBe(413);
});

test('foto pendente é consumida uma vez; referências vencidas são limpas', async () => {
  const referencia = (await upload()).body;
  await emitir({modo:'real',fotoId:referencia.id,consentimento:true}).expect(201);
  expect((await emitir({modo:'real',fotoId:referencia.id,consentimento:true})).status).toBe(400);
  expect(existsSync(path.join(dir,'coletas','pendente-'+referencia.id+'.bin'))).toBe(false);
  const expirada = (await upload()).body, futuro = Date.now() + 16 * 60_000;
  jest.spyOn(Date,'now').mockReturnValue(futuro);
  expect((await emitir({modo:'real',fotoId:expirada.id,consentimento:true})).status).toBe(400);
  expect(existsSync(path.join(dir,'coletas','pendente-'+expirada.id+'.bin'))).toBe(false);
});

test('tag sozinha gera desafio de 2 minutos, nunca JWT; PIN correto consome o desafio', async () => {
  const chip = (await emitir()).body, inicio = Date.now();
  const primeiro = await desafiar(chip).expect(200);
  expect(Object.keys(primeiro.body).sort()).toEqual(['desafioId','expiraEm']);
  expect(primeiro.body.expiraEm-inicio).toBeGreaterThanOrEqual(120_000);
  expect(primeiro.body.expiraEm-Date.now()).toBeLessThanOrEqual(120_000);
  const sessao = await confirmar(primeiro.body.desafioId).expect(200); expect(sessao.body.token).toBeTruthy();
  expect((await confirmar(primeiro.body.desafioId)).status).toBe(401);
  expect((await request(app).get('/api/perfil').set('Authorization',`Bearer ${sessao.body.token}`)).status).toBe(200);
});

test('PIN incorreto não libera sessão, permite repetição e PIN correto encerra desafio', async () => {
  const chip = (await emitir()).body, desafio = (await desafiar(chip)).body;
  const erro = await confirmar(desafio.desafioId,{pin:'999999'}).expect(401); expect(erro.body).not.toHaveProperty('token');
  expect((await confirmar(desafio.desafioId)).status).toBe(200);
});

test.each([{}, {biometric:true}, {pin:PIN_TESTE,credencialDispositivo:'a'.repeat(64)}, {credencialDispositivo:'a'.repeat(64),registrarDispositivo:true}])('confirmação exige exatamente um fator validável no servidor: caso %#', async fator => {
  const chip = (await emitir()).body, desafio = (await desafiar(chip)).body;
  expect((await confirmar(desafio.desafioId,fator)).status).toBe(400);
});

test('desafio expirado, inventado ou de antes do reinício não é aceito', async () => {
  const chip = (await emitir()).body, desafio = (await desafiar(chip)).body;
  expect((await confirmar(randomUUID())).status).toBe(401);
  const reiniciado = createApp(dir,secret,admin);
  expect((await confirmar(desafio.desafioId,{pin:PIN_TESTE},reiniciado)).status).toBe(401);
  jest.spyOn(Date,'now').mockReturnValue(desafio.expiraEm+1);
  expect((await confirmar(desafio.desafioId)).status).toBe(401);
});

test('cinco falhas bloqueiam 30s, inclusive com novos desafios e reinício do servidor', async () => {
  const chip = (await emitir()).body;
  for (let i=0;i<5;i++) {
    const desafio = (await desafiar(chip)).body;
    expect((await confirmar(desafio.desafioId,{pin:'999999'})).status).toBe(i===4?429:401);
  }
  const reiniciado = createApp(dir,secret,admin), desafio = (await desafiar(chip,reiniciado)).body;
  const bloqueado = await confirmar(desafio.desafioId,{pin:PIN_TESTE},reiniciado).expect(429);
  expect(bloqueado.headers['retry-after']).toBeDefined();
  jest.spyOn(Date,'now').mockReturnValue(bloqueado.body.tentarEm+1);
  expect((await confirmar(desafio.desafioId,{pin:PIN_TESTE},reiniciado)).status).toBe(200);
});

test('credencial do aparelho é gerada só com PIN e guardada como hash, vinculada à emissão', async () => {
  const chip = (await emitir()).body;
  const registrada = await confirmar((await desafiar(chip)).body.desafioId,{pin:PIN_TESTE,registrarDispositivo:true}).expect(200);
  const credencial = registrada.body.credencialDispositivo;
  expect(credencial).toMatch(/^[a-f0-9]{64}$/);
  const indice = JSON.parse(lerPrivado('indice').toString());
  expect(indice.emissoes[chip.emissaoId].dispositivos).toEqual([digest(credencial)]);
  const desafio = (await desafiar(chip)).body;
  expect((await confirmar(desafio.desafioId,{credencialDispositivo:credencial})).status).toBe(200);
  const outra = (await emitir({cpf:'98765432100'})).body;
  expect((await confirmar((await desafiar(outra)).body.desafioId,{credencialDispositivo:credencial})).status).toBe(401);
});

test('bloqueio e reemissão entre leitura e confirmação impedem PIN/credencial antigos', async () => {
  const chip = (await emitir()).body;
  const sessao = (await confirmar((await desafiar(chip)).body.desafioId,{pin:PIN_TESTE,registrarDispositivo:true})).body;
  const desafio = (await desafiar(chip)).body;
  await request(app).post(`/api/cartoes/${chip.emissaoId}/bloquear`).set('X-Admin-Token',admin).expect(200);
  expect((await confirmar(desafio.desafioId)).status).toBe(401);
  expect((await request(app).get('/api/perfil').set('Authorization',`Bearer ${sessao.token}`)).status).toBe(401);
  const novo = (await emitir()).body, entreEmissoes = (await desafiar(novo)).body;
  await emitir().expect(201);
  expect((await confirmar(entreEmissoes.desafioId)).status).toBe(401);
});

test('cartão v2 anterior sem coleta/PIN e seu JWT exigem reemissão', async () => {
  const emissaoId = randomUUID(), repo = new JsonUsuariosRepository(path.join(dir,'usuarios.json'));
  const chip = assinaturaService(carregarChaves(path.join(dir,'keys'))).assinar({...pessoa,versao:2,emissaoId,rosto_hash:'ficticio',digital_template:'ficticio',assinatura_svg:'M10 10 L20 20'});
  repo.salvar(chip); const reiniciado = createApp(dir,secret,admin);
  const resposta = await desafiar(chip,reiniciado).expect(401); expect(resposta.body.mensagem).toMatch(/nova emissão/);
  const token = authService(secret).emitir(chip.cpf,chip.emissaoId).token;
  expect((await request(reiniciado).get('/api/perfil').set('Authorization',`Bearer ${token}`)).status).toBe(401);
});

test('cifra detecta adulteração e não devolve bytes nem caminhos na resposta', async () => {
  const referencia = (await upload()).body;
  const file = path.join(dir,'coletas','pendente-'+referencia.id+'.bin'), adulterado = readFileSync(file);
  adulterado[adulterado.length-1] ^= 1; writeFileSync(file,adulterado);
  const erro = await emitir({modo:'real',fotoId:referencia.id,consentimento:true}).expect(500);
  expect(Object.keys(erro.body).sort()).toEqual(['mensagem','requestId']); expect(JSON.stringify(erro.body)).not.toContain(dir);
});

test('mapa de desafios limita releituras por emissão e limpa entradas expiradas', () => {
  const desafios = desafioService(), emissaoId = randomUUID(), primeiro = desafios.criar(emissaoId);
  for (let i=0;i<5;i++) desafios.criar(emissaoId);
  expect(desafios.obter(primeiro.desafioId)).toBeUndefined();
  const novo = desafios.criar(randomUUID()); jest.spyOn(Date,'now').mockReturnValue(novo.expiraEm+1);
  expect(desafios.obter(novo.desafioId)).toBeUndefined();
});

test.each(['assinatura', 'indice'])('falha de persistência em %s remove arquivos da tentativa e preserva emissão anterior', async alvo => {
  const anterior = (await emitir().expect(201)).body;
  const fsIO = require('node:fs') as typeof import('node:fs');
  const gravarOriginal = fsIO.writeFileSync;
  const falha = jest.spyOn(fsIO,'writeFileSync').mockImplementation(((...args: Parameters<typeof fsIO.writeFileSync>) => {
    const nome = path.basename(String(args[0]));
    if (nome.startsWith(alvo) && nome.endsWith('.bin.tmp')) throw new Error('Falha de E/S injetada pelo teste.');
    return gravarOriginal(...args);
  }) as typeof fsIO.writeFileSync);
  await emitir().expect(500);
  falha.mockRestore();
  const arquivos = readdirSync(path.join(dir,'coletas')).filter(n => /^(foto|assinatura)-/.test(n));
  expect(arquivos.sort()).toEqual([`assinatura-${anterior.emissaoId}.bin`,`foto-${anterior.emissaoId}.bin`].sort());
  expect(Object.keys(JSON.parse(lerPrivado('indice').toString()).emissoes)).toEqual([anterior.emissaoId]);
  expect((await confirmar((await desafiar(anterior)).body.desafioId)).status).toBe(200);
});

test('falha ao excluir upload já consumido não interrompe emissão; próxima operação limpa o órfão', async () => {
  const referencia = (await upload().expect(201)).body;
  const fsIO = require('node:fs') as typeof import('node:fs');
  const excluirOriginal = fsIO.unlinkSync;
  const falha = jest.spyOn(fsIO,'unlinkSync').mockImplementation(file => {
    if (path.basename(String(file)) === `pendente-${referencia.id}.bin`) throw new Error('Falha de remoção injetada pelo teste.');
    excluirOriginal(file);
  });
  const chip = (await emitir({modo:'real',fotoId:referencia.id,consentimento:true}).expect(201)).body;
  expect((await confirmar((await desafiar(chip)).body.desafioId)).status).toBe(200);
  expect(JSON.parse(lerPrivado('indice').toString()).uploads).not.toHaveProperty(referencia.id);
  expect((await emitir({modo:'real',fotoId:referencia.id,consentimento:true})).status).toBe(400);
  falha.mockRestore();
  await upload().expect(201);
  expect(existsSync(path.join(dir,'coletas',`pendente-${referencia.id}.bin`))).toBe(false);
});
