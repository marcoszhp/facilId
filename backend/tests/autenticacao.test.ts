import request from 'supertest';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { authService } from '../src/services/auth.service';
import { assinaturaService,carregarChaves } from '../src/services/assinatura.service';
import { lerIdentidade } from '../../mobile/src/services/identidade';
const secret='segredo-exclusivo-de-testes-com-mais-de-32-caracteres';
let dir:string,app:ReturnType<typeof createApp>,chip:any;
beforeAll(()=>{dir=mkdtempSync(path.join(tmpdir(),'facilid-tests-'));app=createApp(dir,secret);});
afterAll(()=>rmSync(dir,{recursive:true,force:true}));
beforeEach(async()=>{chip=(await request(app).post('/api/emissao').send({cpf:'12345678900',nome:'Maria Silva',idade:72})).body;});
const login=(dadosChip:any,cpfDigitado='12345678900')=>request(app).post('/api/autenticar-nfc').send({cpfDigitado,dadosChip});
test('emissão → login → perfil protegido; JWT expira em 15 minutos',async()=>{
  const result=await login(chip);expect(result.status).toBe(200);expect(result.body.perfil.nome).toBe('Maria Silva');
  const token=authService(secret).validar(result.body.token) as jwt.JwtPayload;
  expect(token.exp!-token.iat!).toBe(900);
  const perfil=await request(app).get('/api/perfil').set('Authorization',`Bearer ${result.body.token}`);
  expect(perfil.status).toBe(200);expect(perfil.body.cpf).toBe(chip.cpf);
});
test('CPF divergente é recusado',async()=>{const r=await login(chip,'98765432100');expect(r.status).toBe(401);expect(r.body.mensagem).toMatch(/CPF/);});
test('assinatura inválida é recusada',async()=>{expect((await login({...chip,assinatura_digital_orgao:Buffer.alloc(256).toString('base64')})).status).toBe(401);});
test.each(['nome','idade','rosto_hash','digital_template','assinatura_svg'])('adulteração do campo %s é recusada',async(field)=>{const altered={...chip,[field]:field==='idade'?73:'Dado alterado'};expect((await login(altered)).status).toBe(401);});
test('ordem das propriedades não altera validade',async()=>{expect((await login(Object.fromEntries(Object.entries(chip).reverse()))).status).toBe(200);});
test('cartão não cadastrado, mesmo assinado, é recusado',async()=>{const {assinatura_digital_orgao,...p}=chip;const unknown=assinaturaService(carregarChaves(path.join(dir,'keys'))).assinar({...p,cpf:'11111111111'});expect((await login(unknown,unknown.cpf)).status).toBe(401);});
test('reemissão substitui o cartão anterior',async()=>{await request(app).post('/api/emissao').send({cpf:chip.cpf,nome:'Maria Atualizada',idade:73});expect((await login(chip)).status).toBe(401);});
test('dados e chaves sobrevivem à reinicialização',async()=>{const restarted=createApp(dir,secret);expect((await request(restarted).post('/api/autenticar-nfc').send({cpfDigitado:chip.cpf,dadosChip:chip})).status).toBe(200);});
test.each([{cpf:'abc',nome:'Maria',idade:72},{cpf:'12345678900',nome:'',idade:72},{cpf:'12345678900',nome:'Maria',idade:-1},{cpf:'12345678900',nome:'Maria',idade:'72'},{cpf:'12345678900',nome:'Maria',idade:72,admin:true}])('cadastro inválido é recusado: %j',async(data)=>{expect((await request(app).post('/api/emissao').send(data)).status).toBe(400);});
test.each([{}, {cpfDigitado:'12345678900',dadosChip:null},{cpfDigitado:'12345678900',dadosChip:{}}])('login malformado retorna 401: %j',async(data)=>{expect((await request(app).post('/api/autenticar-nfc').send(data)).status).toBe(401);});
test('JSON inválido e corpo excessivo têm erros controlados',async()=>{
  expect((await request(app).post('/api/emissao').set('Content-Type','application/json').send('{')).status).toBe(400);
  expect((await request(app).post('/api/emissao').send({data:'x'.repeat(18000)})).status).toBe(413);
});
test('sessão ausente, expirada e adulterada é recusada',async()=>{
  expect((await request(app).get('/api/perfil')).status).toBe(401);
  const expired=jwt.sign({},secret,{subject:chip.cpf,expiresIn:-1,issuer:'facilid',audience:'acessosenior'});
  expect((await request(app).get('/api/perfil').set('Authorization',`Bearer ${expired}`)).status).toBe(401);
  expect((await request(app).get('/api/perfil').set('Authorization','Bearer adulterado')).status).toBe(401);
});
test('documentação e listagem disponíveis',async()=>{
  expect((await request(app).get('/docs/')).status).toBe(200);
  const spec=await request(app).get('/openapi.json');expect(spec.body.paths['/api/autenticar-nfc']).toBeDefined();
  expect((await request(app).get('/api/usuarios')).body.length).toBeGreaterThan(0);
  expect((await request(app).get('/api/usuarios?foo=1')).status).toBe(400);
});
test('a validação mobile recebe o mesmo cartão do backend',()=>{expect(lerIdentidade(JSON.stringify(chip),'123.456.789-00')).toEqual(chip);});
test('mobile rejeita JSON quebrado, CPF diferente e campos extras',()=>{
  expect(()=>lerIdentidade('{','12345678900')).toThrow(/inválido/);
  expect(()=>lerIdentidade(JSON.stringify(chip),'98765432100')).toThrow(/CPF/);
  expect(()=>lerIdentidade(JSON.stringify({...chip,extra:true}),chip.cpf)).toThrow(/inválido/);
});
test('o tamanho real do JSON assinado excede NTAG213 e NTAG215',()=>{expect(Buffer.byteLength(JSON.stringify(chip),'utf8')).toBeGreaterThan(504);});
