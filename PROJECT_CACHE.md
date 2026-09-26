# PROJECT CACHE

Base: **2026-09-26**, código em `1a37bcfc0405eae475b5d2d7fe171431b6b57475`, publicado em `main` de https://github.com/marcoszhp/facilId. Este cache é um índice, não uma especificação imutável. Confira diferenças posteriores somente no escopo da tarefa.

Atualização documental posterior à base: commit `8812e0b7deead44bedfc48750a138fd591e24f83`, publicado e confirmado em `origin/main` em 2026-09-26. Inclui guias em `docs/`, Swagger complementado e exportador OpenAPI. Sem mudança nos fluxos de autenticação/persistência.

Raiz desta cópia: `C:/Users/marco/OneDrive/Desktop/NFC SENAC`. **Todos os caminhos abaixo são exatos e relativos à raiz**, salvo indicação contrária. Não contêm segredos.

## 1. Visão geral

- **FácilID / AcessoSênior**: protótipo escolar acessível para idosos/baixo letramento digital. Responsável emite cartão JSON assinado; cidadão entra com CPF + cartão + PIN ou credencial protegida pela biometria do aparelho.
- Monorepo npm workspaces: `mobile` (Expo/React Native, também web) → HTTP → `backend` (Express) → MySQL/MariaDB para cartões + arquivos privados cifrados para coletas/fatores.
- Stack verificada: TypeScript ~5.9.2; Expo ~54.0.37, RN 0.81.5, React 19.1.0; Express ^5.1.0, Zod ^3.25.0, jsonwebtoken ^9.0.2, mysql2 ^3.24.4. Versões resolvidas: `package-lock.json`.
- Demonstração completa sem hardware. Foto capturada não é reconhecimento facial; assinatura desenhada não autentica sua autoria; biometria local não vincula sensor ao CPF.

## 2. Mapa do projeto

| Caminho | Papel / quando ler |
| --- | --- |
| `backend/src/` | API, regras, criptografia, persistência; detalhes nas seções 3–7. |
| `mobile/src/screens/`, `mobile/src/components/` | Fluxos e controles acessíveis. |
| `mobile/src/services/`, `mobile/src/theme/index.ts` | Transporte, contratos, hardware e aparência. |
| `backend/tests/`, `mobile/tests/` | Contratos e regressões; localização na seção 11. |
| `package.json`, `backend/package.json`, `mobile/package.json` | Workspaces, comandos e dependências; não há script lint. |
| `README.md` | Guia operacional, demonstração, privacidade, hardware e XAMPP. |
| `docs/README.md` | Índice profissional por público; visão geral, instalação, uso, arquitetura, banco, API, segurança, qualidade e operação. Consulte o capítulo pertinente antes de expandir leitura. |
| `docs/API.md`, `docs/openapi.json`, `scripts/export-openapi.mjs` | Referência humana, contrato gerado e exportador; `npm run docs:api` compila backend e exporta só a declaração pública, sem acessar banco/dados privados. |
| `VALIDACAO-MYSQL.md` | Evidência atual da integração e limites. |
| `VALIDACAO-BIOMETRIA.md`, `VALIDACAO.md`, `ANALISE-DO-PROMPT.md` | Histórico; ler apenas para decisão/etapa específica. Não confundir planos antigos com implementação atual. |
| `AGENTS.md` | Instrução curta para descobrir este cache. |

## 3. Entry points

- `mobile/index.ts` → registra `mobile/App.tsx`. `App` controla tela login/emissor, sessão, URL da API e cartão preparado **em memória**, sem biblioteca de navegação. Alterar URL remonta tela e descarta cartão; sair limpa sessão/cartão.
- `backend/src/server.ts` → carrega ambiente, abre persistência, carrega/cria segredos privados, chama `createApp()`, inicia HTTP e fecha pool ao encerrar. Não cria schema implicitamente.
- `backend/src/app.ts` → `createApp(dataDir, secret, adminToken?, options?)`; `options={repo?, verificarPersistencia?}`. **Sem injeção usa JSON**, propositalmente para testes; servidor injeta MySQL. Monta CORS, `X-Request-Id`, routers, Swagger e tratamento sanitizado de erros.
- `backend/src/db/cli.ts` → comandos `setup/check/migrate`; `backend/src/db/seed.ts` → preparo de chaves/coletas/admin e exemplos somente com `DEMO_PIN` explícito.

## 4. Componentes e módulos principais

### Backend: caminho → símbolos, entrada/saída e relações

| Arquivo | Contrato e dependências / consumidores |
| --- | --- |
| `backend/src/config.ts` | `carregarAmbiente()`, `diretorioDados()`, `clienteBanco()`, `mensagemBanco()`, `backendDir`. Servidor/CLI/seed; `.env` do backend, caminhos estáveis e diagnóstico sem mensagens brutas do driver. |
| `backend/src/repositories/usuarios.repository.ts` | `UsuariosRepository`, `Awaitable<T>`, `RegistroCartao`, `ResumoCartao`, `registroCartaoSchema`, `arquivoSchema`, `JsonUsuariosRepository`. Interface `listar/buscar/buscarEmissao/salvar/bloquear`; retorno síncrono **ou Promise**. Todos os consumidores de produção devem usar `await`. JSON v2 mantém `cartoes`/`legados`; grava antes de trocar estado em memória. |
| `backend/src/repositories/mysql-usuarios.repository.ts` | `MysqlUsuariosRepository` implementa interface; chip → transação → registro. `carregarRegistrosMySql()`/`inserirRegistroMySql()` também servem à migração. Depende de pool mysql2 e schemas; consumido por `backend/src/db/persistencia.ts` e testes. |
| `backend/src/db/mysql.ts` | `MySqlConfig`, `lerConfigMySql()`, `criarPoolMySql()`, `criarBanco()`, `MYSQL_SCHEMA`, `prepararSchema()`, `validarSchema()`. Valida identificador antes de DDL; pool 5 conexões/fila 100; múltiplas instruções desativadas. `backend/src/db/schema-mysql.sql` é espelho legível, com teste de equivalência. |
| `backend/src/db/persistencia.ts` | `abrirPersistencia(dir)` → `{repo, verificar, encerrar, tipo}`. Seleciona MySQL/JSON; valida tabelas antes de devolver; não faz fallback. Consumido por servidor e seed. |
| `backend/src/db/migrar-json.ts` | `migrarJson(file,pool)` → `{cartoesImportados,legadosImportados,jaAplicada}`; `ErroMigracao`. Lê JSON original sem abrir adaptador JSON; valida, compara destino, usa lock nomeado + transação, importa sem reassinar, preserva origem. Relê inteiro para mudar política de conflito/rollback. Consumidor: CLI. |
| `backend/src/services/assinatura.service.ts` | `canonicalizar(Identidade)` → string; `carregarChaves(dir)` → par RSA; `assinaturaService(keys).assinar()/validar()` → Chip/boolean. RSA-2048/SHA256, assinatura base64. Schemas → emissão/autenticação. Não sobrescreve par existente; detecta inconsistência. |
| `backend/src/services/emissao.service.ts` | `emitirPessoa(dados,assinatura,repo,coletas)` → Promise<Chip>. Gera UUID, obtém foto real/fictícia, cria coleta, assina hashes, aguarda cartão; remove coleta da tentativa se falhar. Consumidores: emissão e seed. |
| `backend/src/services/coleta.service.ts` | `ErroColeta`, `hashBytes()`, `FOTO_DEMONSTRACAO`, `gerarSvg(Desenho)` → SVG, `validarFoto(base64,mimeType)` → Buffer. Valida estrutura/dimensões JPEG/PNG; SVG é gerado de coordenadas, nunca markup enviado. Rotas, emissão e repositório de coletas dependem dele. |
| `backend/src/repositories/coletas.repository.ts` | Arquivo central de segurança: `ColetasRepository`, `MetadadosColeta`, `ArquivosColetasRepository`. `guardarFoto()` → `{id,hash}`; `obterFoto()` → bytes/mime; `criar()`/`obter()` → metadados; `remover()`; `verificarFator()` → `ok/invalido/limitado`, credencial opcional/`tentarEm`. Entrada: foto/SVG/PIN; saída pública só metadados. Usa fs+crypto+Zod+serviço de coleta; instanciado por app/seed, consumido por emissão/login/sessão. Internos críticos: `gravar/ler/salvar/limparPendentes`, índice cifrado, compensação de falhas. Reler antes de alterar ciclo de vida, cifra ou fatores. |
| `backend/src/services/desafio.service.ts` | `desafioService()` → `criar/obter/reservar/consumir`. Map em memória; reserva síncrona fornece `emissaoId/vigente/consumir/liberar` antes dos awaits. Consumidor: login. |
| `backend/src/services/auth.service.ts` | `authService(secret).emitir(cpf,emissaoId)` → `{token,expiraEm}`; `.validar(token)` → claims. JWT HS256, issuer `facilid`, audience `acessosenior`, `sub=cpf`, `emissaoId`, 15 min. |
| `backend/src/services/admin.service.ts` | `carregarAdminToken()`; `exigirAdministrador()` verifica `X-Admin-Token` com comparação constante. App/seed e router de emissão. |
| `backend/src/middleware/sessao.ts` | `exigirSessao(repo,auth,coletas)` valida JWT e cartão ativo/coleta em cada consulta; define `res.locals.perfil/emissaoId`. Credencial inválida →401; falha de DB →500. Consumidor: `/api/perfil` e futuras rotas protegidas. |
| `backend/src/routes/emissao.routes.ts`, `backend/src/routes/autenticacao.routes.ts` | `emissaoRoutes()`/`autenticacaoRoutes()`: ligam schemas, serviços e repositórios aos contratos da seção 7. Admin é verificado antes dos parsers grandes. |
| `backend/src/docs/swagger.ts` | Export `swagger`, OpenAPI explícito; servido pelo app. Atualizar junto com rotas/schemas/contrato mobile; não é gerado dos tipos TS. |

### Mobile: módulos centrais

| Arquivo | Responsabilidade / relações |
| --- | --- |
| `mobile/src/screens/LoginScreen.tsx` | CPF → leitura NFC/QR/texto/cartão preparado → desafio → PIN/biometria → `onSuccess(Sessao)`. Usa API, identidade, biometria, NFC, feedback e `useOperacao`. Internos `entrar/confirmar/reler/interromper`; descarta credencial de dispositivo antes de entregar sessão ao App. |
| `mobile/src/screens/EmissorScreen.tsx` | Chave administrativa em memória; cadastro, foto/demonstração, desenho confirmado, PIN; lista/bloqueia/recupera cartão e segunda via. API + componentes de coleta + NFC/QR. Entrega Chip ao App via `onUseCard`; não recebe credenciais de cidadão para administração. |
| `mobile/src/screens/SucessoScreen.tsx` | Cartão/perfil, consulta autenticada, aviso/expiração e saída. `erroNaoAutorizado()` encerra sessão em 401, não em erro genérico de conexão. |
| `mobile/src/services/api.service.ts` | `criarApi(url)` → `foto/emitir/usuarios/cartao/bloquear/entrar/confirmar/perfil`; Axios 10 s, AbortSignal, headers admin e JWT separados. Exports `erroNaoAutorizado/erroCancelado/mensagemErro`. Telas consomem; tipos em `mobile/src/services/identidade.ts`. |
| `mobile/src/services/identidade.ts` | `chipSchema`, `Chip/Perfil/DadosEmissao/AssinaturaCapturada/Desafio/Confirmacao/Sessao/ResumoCartao`, `normalizarCpf()`, `lerIdentidade(texto,cpf)` → Chip. NFC/QR/texto passam aqui; limite 8192 caracteres. Replica contrato backend: alterações precisam ser coordenadas. |
| `mobile/src/services/nfc.service.ts`, `mobile/src/services/nfc.service.web.ts` | `lerNfc()` → texto, `gravarNfc(texto)`, `cancelarNfc()`. NDEF serializado/cancelável; confere tag gravável/capacidade. Web orienta modo simulado. Reler transporte/testes para mudanças de hardware. |
| `mobile/src/services/biometria.service.ts`, `mobile/src/services/biometria.service.web.ts` | `disponibilidadeBiometria()` → disponibilidade/mensagem; `lerCredencialBiometrica(url,emissaoId)` → credencial/mensagem; `guardarCredencialBiometrica()` → boolean. LocalAuthentication consulta disponibilidade, SecureStore autentica leitura. Vínculo servidor/emissão. Web oferece PIN. |
| `mobile/src/components/CapturaFoto.tsx` | `CapturaFoto`, `FotoCapturada`, `escolherTamanhoFoto()`, `dadosDaFoto()`: expo-camera + FileSystem; captura/confirma/refaz, libera temporário, descarta resultado tardio. Saída `{base64,mimeType}` para EmissorScreen. |
| `mobile/src/components/AssinaturaManuscrita.tsx`, `mobile/src/services/desenho-assinatura.ts` | Quadro SVG, gestos, confirmar/limpar; `pontoNoQuadro/possuiDesenho/caminhoDoTraco/assinaturaDemonstracao` e limites. Entrada: gestos; saída: `AssinaturaCapturada` normalizada 320×180. Emissor consome desenho confirmado. |
| `mobile/src/components/useOperacao.ts` | `useOperacao()` → `iniciar/vigente/cancelar`; aborta transporte e invalida respostas anteriores/desmontadas. Telas consomem. |
| `mobile/src/components/LeitorQr.tsx`, `mobile/src/services/simulacao.service.ts` | QR via câmera segue contrato de identidade; simulacao.service apenas reexporta `lerIdentidade`, não produz cartão assinado/fatores. |
| `mobile/src/components/Ui.tsx`, `mobile/src/theme/index.ts` | `Botao/Campo/Aviso`, estilos acessíveis comuns; alterar aqui para mudanças globais. |
| `mobile/src/services/feedback.ts`, `mobile/src/services/feedback.web.ts`, `mobile/src/components/ControleAudio.tsx` | `falar/pararAudio/observarAudio/feedback`; TTS/haptic nativos, speechSynthesis/vibração web. Controle global de parada. |

## 5. Fluxos importantes

1. **Inicialização**: server → config → abrirPersistencia → validarSchema → chaves/admin/coletas → createApp → HTTP. MySQL é padrão do servidor; falha impede inicialização, sem criar JSON alternativo.
2. **Emissão**: Emissor → foto privada opcional → coordenadas+PIN → emissaoSchema → emitirPessoa → arquivos AES → RSA do cartão → transação SQL. Segunda via muda anteriores do CPF para `substituido`; exatamente um ativo. Falha de SQL remove coleta recém-criada.
3. **Login**: CPF+JSON → lerIdentidade → API verifica CPF/RSA/emissão ativa/coleta → desafio (sem JWT) → confirmar PIN ou credencial → reconsulta estado → consome desafio → JWT/perfil. Reserva impede confirmações paralelas do mesmo desafio; erro recuperável libera reserva.
4. **Biometria**: primeiro PIN válido + `registrarDispositivo` → servidor gera credencial aleatória e guarda só hash → app armazena no SecureStore; próximo acesso pede autenticação do sistema para lê-la → servidor valida credencial. Booleano de sensor não concede sessão.
5. **Sessão/revogação**: perfil → Bearer → exigirSessao → estado atual no banco+coleta. Bloqueio/segunda via revoga próximas consultas e novos logins do cartão anterior.
6. **Migração**: CLI com API parada → lê usuarios.json v1/v2 → compara destino → transação → registros/marcador. Idempotente na mesma base; alterações posteriores no destino causam conflito, não sobrescrita. Não há jobs, pagamentos, eventos externos ou serviços municipais implementados.

## 6. Modelos de dados

- `backend/src/schemas/payload.ts` → `cpfSchema/cadastroSchema/identidadeSchema/chipSchema/loginSchema`, tipos `Identidade/Chip`. Zod strict; CPF tem **formato 11 dígitos, sem dígitos verificadores** por ser demonstração. Nome 2–100, idade 0–130.
- **Identidade v2 assinada**: `versao=2`, `emissaoId` UUID, `cpf`, `nome`, `idade`, `rosto_hash`, `digital_template`, `assinatura_svg`. **Chip** acrescenta `assinatura_digital_orgao` base64. Estado fica fora do chip/assinatura.
- `rosto_hash` = SHA256 dos bytes; `assinatura_svg` = `sha256:<hash>`, **não SVG completo**; `digital_template` = marcador de ausência de coleta biométrica. Foto/desenho não entram em NFC/QR.
- `backend/src/schemas/coleta.ts` → `desenhoSchema/emissaoSchema/fotoSchema/confirmacaoSchema`, `Desenho/DadosEmissao`. PIN 6 dígitos; real exige fotoId+consentimento; demonstração não aceita fotoId. Desenho 320×180, até 32 traços, 512 pontos/traço, 1500 no total; ponto isolado/vazio recusado.
- Foto: JPEG/PNG ≤2 MB, lados ≤4096 e ≤12 milhões pixels; upload pendente 15 min, até 50; limpeza no acesso/início, não job contínuo.
- `ArquivosColetasRepository`: índice `versao=1`, mapas `uploads/emissoes` por UUID. Fotos/SVG/índice AES-256-GCM; PIN scrypt+salt; até 5 hashes de dispositivos por emissão. Cinco falhas na janela de 30 s bloqueiam por 30 s, persistindo após reinício. Desafio: 2 min, até 5 por cartão/1000 globais, apenas memória.

| Tabela SQL | Chaves / conteúdo |
| --- | --- |
| `facilid_pessoas` | PK `cpf`; linha estável para lock por pessoa. |
| `facilid_cartoes` | PK `emissao_id`, FK `cpf`; campos assinados, `estado` enum ativo/bloqueado/substituido, `ordem` auto incremento, `criado_em`; coluna gerada `cpf_ativo` com UNIQUE permite só um ativo/CPF. |
| `facilid_legados` | PK `conteudo_hash`, `cpf`, `identidade_json`; preserva v1 sem autenticar. Hash inclui ocorrência para preservar duplicatas da origem. |
| `facilid_migracoes` | PK `fonte_hash`, contagens e `aplicada_em`; idempotência/controle de importação. |

Todas InnoDB/utf8mb4. JSON opcional: `{versao:2,cartoes:[{chip,estado}],legados:[...]}`; adaptador JSON migra array v1 com backup. CLI MySQL não altera esse arquivo. V1 e v2 sem coleta/PIN exigem reemissão.

## 7. APIs e contratos

Base `/api`, JSON. Admin = `X-Admin-Token`; cidadão = `Authorization: Bearer <JWT>`. Tempos `expiraEm/tentarEm` em milissegundos, `exp` JWT em segundos.

| Método/rota | Autorização; entrada → saída |
| --- | --- |
| POST `/api/emissao/foto` | Admin; `{base64,mimeType}` →201 `{id,hash}`. Parser 3 MB. |
| POST `/api/emissao` | Admin; DadosEmissao →201 Chip. Parser 64 KB. |
| GET `/api/usuarios` | Admin; sem query params → ResumoCartao[]. |
| GET `/api/cartoes/:emissaoId` | Admin; UUID → Chip ativo; 404 ausente/409 revogado. |
| POST `/api/cartoes/:emissaoId/bloquear` | Admin → `{emissaoId,estado}`; não reativa cartão substituído. |
| GET `/api/cartoes/:emissaoId/coleta` | Admin → MetadadosColeta; nunca mídia/PIN/hash de credencial. |
| POST `/api/autenticar-nfc` | `{cpfDigitado,dadosChip}` → `{desafioId,expiraEm}`, **não sessão**. Também atende QR/texto. |
| POST `/api/autenticar-confirmar` | `{desafioId,pin OU credencialDispositivo,registrarDispositivo?}` → `{sucesso:true,token,expiraEm,perfil,credencialDispositivo?}`. Registro exige PIN; 409 reserva ocupada, 429+Retry-After limite. |
| GET `/api/perfil` | JWT → `{cpf,nome,idade}`; revalida cartão/coleta. |
| GET `/health` | Público →200 `{status:'ok'}` ou503 indisponível. |
| GET `/docs`, `/openapi.json` | Swagger UI / contrato. |

Parser geral 16 KB. `X-Request-Id` em respostas; tratador geral retorna `mensagem/requestId`, sem erro SQL/stack. Status controlados devem preservar separação 401 (credencial) × 500/503 (infraestrutura). OpenAPI documenta saúde 200/503, confirmação 409, cabeçalhos e erros comuns dos parsers/persistência. Ao mudar a declaração, regenerar `docs/openapi.json`.

## 8. Configuração

- `backend/.env.example` é modelo; `backend/.env` é privado/ignorado. `carregarAmbiente()` não sobrescreve variáveis do terminal. `DATA_DIR` relativo ao backend; padrão `.local`.
- Variáveis: `DB_CLIENT` (`mysql` padrão, `json` explícito), `DB_HOST` (127.0.0.1), `DB_PORT` (3306), `DB_NAME` (facilid), `DB_USER`, `DB_PASSWORD`; `HOST` (127.0.0.1), `PORT` (3000), `CORS_ORIGIN` (lista por vírgulas), `DATA_DIR`, `ADMIN_TOKEN`, `JWT_SECRET`, `DEMO_PIN` opcional. **Não copiar seus valores privados para este cache/log/Git.**
- Defaults CORS: localhost/127.0.0.1 **8081**; preview em outra porta requer CORS apropriado. Frontend: `EXPO_PUBLIC_API_URL`, ou Android emulador `http://10.0.2.2:3000`, web `http://localhost:3000`; ajuste manual no App. Nunca variável `EXPO_PUBLIC_*` para segredo.
- Chaves/admin/JWT/coletas em `backend/.local/`; não regenerar para corrigir problema de conexão. `npm run generate-keys -w backend` é CLI legado com resolução própria de DATA_DIR e sem carregar `.env`; **preferir `npm run setup`**.
- Node 22.13+; MySQL iniciado no XAMPP. MariaDB 10.4.32 foi testado; MySQL 8 separado não. Apache só é necessário para phpMyAdmin.

| Ação | Comando/configuração |
| --- | --- |
| Primeira instalação | `npm install`; copiar `backend/.env.example` para `backend/.env` **somente se ausente**; configurar; `npm run db:setup`; `npm run db:check`; `npm run db:migrate` se houver fonte, com API parada; `npm run setup`. |
| Desenvolvimento | `npm run dev` (API), `npm run web` (outro terminal) ou `npm run mobile` (Dev Client). |
| Banco | `db:setup` cria schema; `db:check` verifica; `db:migrate` importa sem sobrescrever destino divergente. Não migrar a cada início. |
| Verificação | `npm run typecheck`, `npm test`, `npm run build`; focar workspace com `npm test -w backend` / `-w mobile`, ou arquivo Jest via `-- --runTestsByPath <caminho relativo ao workspace>`. Sem lint configurado. |
| Documentação API | `npm run docs:api`; requer dependências instaladas, não requer MySQL. Fonte em `backend/src/docs/swagger.ts`, saída em `docs/openapi.json`. |
| Ciclo | `npm run check`; `npm run check:mysql` inclui SQL real; `npm run check:watch -- --mysql` repete após mudanças. Não corrige código sozinho. |
| SQL isolado | `npm run test:mysql`: não carrega `.env` nem usa DB_NAME; host local; vars de conexão do terminal, usuário com CREATE/DROP para schemas artificiais `facilid_test_<pid>_<id>`. Nunca usar banco principal como massa de teste. |
| Android | `npm run android:prepare -w mobile`, `npm run android -w mobile`; exige SDK/JDK/ADB. USB: `adb reverse tcp:3000 tcp:3000`. |

`backend/jest.config.cjs` (ts-jest; `.test.ts`) / `mobile/jest.config.cjs` (jest-expo); integração usa sufixo `.mysql.ts` via comando optativo. `backend/tsconfig.json` compila src→dist CommonJS; `mobile/tsconfig.json` strict Expo. `scripts/backend-dev.mjs` supervisiona tsc/node watch; `scripts/expo.mjs` usa cache local/sem telemetria; `scripts/verify.mjs` gera `reports/latest.json`+logs/hash das fontes e falha se fontes mudarem durante ciclo. `.npmrc` põe cache em `.npm-cache`. Aprovações de scripts esbuild/scarf já em package.json; não aplicar `npm audit fix --force` automaticamente.

## 9. Decisões técnicas a preservar

- **Uma instância do backend**, mesmo com SQL: coletas são arquivos e desafios são memória. Transação SQL não é atômica com arquivos; compensação existe para falha comum, não garantia contra queda abrupta. Backup coerente = banco + toda `.local` + configuração, API parada.
- MySQL tem cartões/histórico; mídia/PIN/fatores continuam cifrados nos arquivos. Trocar DB_CLIENT não sincroniza bases; não é failover.
- Lock de emissão é **UPSERT da pessoa**, não `INSERT IGNORE` seguido de promoção para lock: este último causou deadlock em concorrência. Índice UNIQUE é defesa adicional. Bloqueio segue ordem pessoa→cartão.
- Preserve canonicalização/campos/versão RSA e chaves: mudar rompe cartões existentes. Serviço RSA permaneceu inalterado na etapa MySQL.
- Confirmação precisa reservar desafio antes de await, revalidar cartão após fator, consumir só no sucesso/invalidação; PIN incorreto/falha recuperável permitem nova tentativa. Cada operação protegida verifica revogação.
- SecureStore com `requireAuthentication:true`, não simples booleano retornado por sensor. Cadastro biométrico do aparelho compartilhado pode permitir outra pessoa. Cancelamento/ausência sempre oferece PIN.
- Expo Dev Client, **newArchEnabled:false**, por NFC Manager 3.17.2; Expo Go não valida conjunto nativo. `mobile/app.json` configura câmera/biometria/SecureStore; `mobile/plugins/withAccessibility.cjs` marca câmera/NFC opcionais e permite descoberta TTS no Android 11+.
- Dependências nativas de referência: LocalAuthentication ~17.0.9, SecureStore ~15.0.8, FileSystem ~19.0.24, Camera ~17.0.10, SVG 15.12.1, TTS 4.1.1, Haptic 3.0.0. Rebuild Dev Client ao alterá-las; conferir compatibilidade oficial antes de atualizar.
- JSON RSA não cabe NTAG213/215; NTAG216 não garante todos os nomes aceitos. Formato atual usa NDEF pronto/gravável com espaço suficiente (referência: DESFire EV3 4 KB já configurado NDEF Type 4). App não formata DESFire nem usa criptografia do chip; credencial continua copiável.

## 10. Estado atual

- Concluídos: emissão/admin/bloqueio/segunda via, NFC/QR/texto/demonstração, foto autorizada, desenho, PIN, integração de biometria local, sessão com revogação, acessibilidade, MySQL+importação+testes e documentação.
- Última validação **do código-base, anterior a este cache**: 2026-09-26, `check:mysql` aprovado; **115 backend +78 mobile +10 SQL =203 testes**, tipos e builds backend/web aprovados. Fonte: `reports/latest.json` local / `VALIDACAO-MYSQL.md`. Não interpretar como testes físicos ou validação automática de alterações posteriores.
- Entrega local MySQL: banco `facilid`, quatro registros v1 em `facilid_legados`, nenhum reemitido automaticamente; fonte/chaves preservadas. Contagem é histórica, não estado vivo. API de conferência foi encerrada; não assumir processos/portas ativos.
- Corrigidos recentemente: deadlock em emissão simultânea; awaits de persistência; reserva/expiração/revogação durante confirmação; erro de DB não encerra JWT válido como 401; migração transacional idempotente.
- Sem falha funcional pendente reproduzida na suíte. Dívidas conhecidas: aviso de `SafeAreaView` depreciado em `mobile/App.tsx` e alertas npm audit transitivos. Revalidar audit quando tarefa for dependências; não preservar contagem antiga como verdade atual.
- **Ainda não validado**: build Android completa e sensores reais (NFC/biometria/câmera/TTS/haptic). Prebuild anterior passou; ambiente anterior não tinha Java/ADB no PATH. Reconfirmar ambiente para tarefa nativa.
- **Não implementado / evolução opcional**: reconhecimento facial/prova de vida, autoria de assinatura, impressão digital externa, agendamentos/serviços municipais, administradores individuais, auditoria completa, recuperação de conta, política operacional de retenção/exclusão, distribuição em múltiplas instâncias. Não iniciar essas funcionalidades só porque constam do histórico.
- Chave AES ao lado da cifra não protege contra acesso à pasta inteira; SQL contém identidade sem cifra de aplicação. Protótipo local, não certificação de identidade civil. Nenhuma mídia possui rota pública.
- Retomada Codex `concluir-f-cilid-com-mysql-xampp` reativada: **“Continuar FácilID com margem de 5%”**, verificação a cada hora. Antes de etapas grandes, consultar uso; ao restar <=5% em qualquer janela aplicável, registrar ponto de parada e adiar trabalho pesado. Não é reserva garantida nem job do app. Manter ativa sem pendências, encerrando rapidamente/sem alterações; não pausar automaticamente ao concluir. Não comprar créditos/resets.
- Documentação atual: `docs/README.md` e nove guias especializados; contrato `docs/openapi.json` gerado. Backend compilou e 26 testes de `backend/tests/autenticacao.test.ts` passaram após ajuste exclusivamente documental do Swagger; os 203 testes completos acima continuam sendo evidência da base anterior, não nova execução integral.
- Revisão final documental em 2026-09-26: 10 documentos, 193 links locais válidos, 10 caminhos OpenAPI; Swagger Parser aprovou o contrato e o JSON corresponde à declaração compilada. Cinco diagramas Mermaid revisados como texto, sem renderização. Evidência local: `reports/documentation-validation.json`. Manual corrigido para PIN direto na web, redesenho após refazer foto e tamanho dos botões/campos; nenhum fluxo funcional alterado.
- Pedido de documentação profissional concluído e publicado no commit documental indicado no início. Não há outra implementação autorizada pendente identificada: itens opcionais acima não são tarefas; ensaios físicos continuam sem evidência. Nas retomadas sem novo pedido, encerrar sem testes, alterações ou mensagem e manter a automação ativa. Não repetir a publicação já confirmada.

## 11. Índice de localização

| Preciso alterar... | Arquivo(s) provável(is) / teste direto |
| --- | --- |
| Login, desafio ou JWT | `backend/src/routes/autenticacao.routes.ts`, `backend/src/services/desafio.service.ts`, `backend/src/services/auth.service.ts`, `backend/src/middleware/sessao.ts`; `backend/tests/autenticacao.test.ts`, `backend/tests/persistencia-assincrona.test.ts`. |
| Emissão, bloqueio, segunda via | `backend/src/routes/emissao.routes.ts`, `backend/src/services/emissao.service.ts`, repositórios de usuários; `backend/tests/ciclo-cartoes.test.ts`. |
| Banco/conexão/concorrência | `backend/src/db/mysql.ts`, `backend/src/db/persistencia.ts`, `backend/src/repositories/mysql-usuarios.repository.ts`; `backend/tests/mysql-config.test.ts`, `backend/tests/mysql.integration.mysql.ts`. |
| Migração/dados antigos | `backend/src/db/migrar-json.ts`, `backend/src/db/cli.ts`, `backend/src/repositories/usuarios.repository.ts`; teste SQL real acima. |
| Foto, cifra, PIN, limites | `backend/src/repositories/coletas.repository.ts`, `backend/src/services/coleta.service.ts`, `backend/src/schemas/coleta.ts`; `backend/tests/coleta-fatores.test.ts`. |
| Assinatura RSA/formato do cartão | `backend/src/services/assinatura.service.ts`, `backend/src/schemas/payload.ts`, `mobile/src/services/identidade.ts`; autenticação/contrato backend. |
| Tela de entrada | `mobile/src/screens/LoginScreen.tsx`; `mobile/tests/LoginScreen.test.tsx`. |
| Área administrativa | `mobile/src/screens/EmissorScreen.tsx`; `mobile/tests/EmissorScreen.test.tsx`. |
| Navegação/sessão visível | `mobile/App.tsx`, `mobile/src/screens/SucessoScreen.tsx`; `mobile/tests/App.test.tsx`, `mobile/tests/SucessoScreen.test.tsx`. |
| Câmera/desenho | `mobile/src/components/CapturaFoto.tsx`, `mobile/src/components/AssinaturaManuscrita.tsx`, `mobile/src/services/desenho-assinatura.ts`; `mobile/tests/CapturaFoto.test.tsx`, `mobile/tests/AssinaturaManuscrita.test.tsx`. |
| Biometria/SecureStore | `mobile/src/services/biometria.service.ts`, `mobile/src/services/biometria.service.web.ts`, LoginScreen; `mobile/tests/biometria.service.test.ts`, `mobile/tests/biometria.web.test.ts`. |
| NFC/QR | `mobile/src/services/nfc.service.ts`, `mobile/src/services/nfc.service.web.ts`, `mobile/src/components/LeitorQr.tsx`; `mobile/tests/nfc.service.test.ts`, `mobile/tests/LeitorQr.test.tsx`. |
| Acessibilidade/voz/estilos | `mobile/src/theme/index.ts`, `mobile/src/components/Ui.tsx`, `mobile/src/components/ControleAudio.tsx`, serviços feedback; `mobile/tests/ControleAudio.test.tsx`, `mobile/tests/feedback.test.ts`. |
| API cliente/erros/cancelamento | `mobile/src/services/api.service.ts`, `mobile/src/components/useOperacao.ts`; `mobile/tests/api.service.test.ts`. |
| Novas rotas/contratos | Routers backend + schemas + `backend/src/docs/swagger.ts` + `mobile/src/services/identidade.ts` + `mobile/src/services/api.service.ts`. |
| Massa de testes | `backend/tests/helpers.ts`, `mobile/tests/helpers.ts`; nunca `.local`/banco principal. |
| Toolchain/loop/build nativo | Manifests, configs Jest/TS, `mobile/app.json`, plugin nativo, `scripts/backend-dev.mjs`, `scripts/expo.mjs`, `scripts/verify.mjs`; comandos na seção 8. |
| Documentação e contrato publicado | `docs/README.md` → capítulo pertinente; API: `backend/src/docs/swagger.ts`, `scripts/export-openapi.mjs`, `docs/openapi.json`. Atualizar este cache ao mudar decisões ou estado. |

## 12. Arquivos que podem ser ignorados normalmente

- `node_modules/`, `.npm-cache/`, `.expo/`, `mobile/.expo/`, `backend/dist/`, `mobile/dist/`, `mobile/android/`, `mobile/ios/`: dependências/cache/gerados/build; consulte fontes/config/plugins antes deles. Código nativo gerado só se a tarefa depender dele.
- `package-lock.json`: essencial para instalação, mas não reler integralmente; buscar pacote exato em tarefa de dependências.
- `reports/`: artefatos/logs ignorados pelo Git; ler apenas evidência relevante. Scripts/patches antigos aí podem pressupor outro commit e não devem ser reutilizados cegamente.
- `backend/.env`, `backend/.local/` (RSA, JWT, admin, coleta.key, fotos, índices, usuários/backups): **privados, não ler/mostrar/versionar rotineiramente**. Nunca usar como testes nem apagar/regerar para passar testes.
- `.git/`: usar comandos Git; não varrer objetos. Histórico de validação/prompts: dispensável salvo análise de decisão antiga.
- **Fora do FácilID**, mesmo na raiz: `petshop/`, `crud-python-xampp/`, `crud-python-xampp.zip`, `Pata-e-Prosa.zip`, `Pata-e-Prosa-Completo.zip`. Pertencem ao usuário; não inspecionar, alterar, apagar ou incluir em commit desta aplicação. Evitar `git add .`.

## 13. Regras para futuras sessões

1. Leia este cache primeiro; não faça varredura completa automática.
2. Localize a tarefa pela seção 11; leia só arquivos envolvidos e dependências diretas.
3. Amplie leitura quando houver evidência de necessidade; cache não substitui leitura de implementação sensível.
4. Preserve dados/chaves e diferenças locais do usuário; confira status Git e escopo antes de editar/publicar.
5. Use testes relevantes e isolados; rode ciclo completo quando a mudança justificar, não apenas porque existe. Não atribua validação física a mocks/build web.
6. Após mudanças relevantes, atualize entradas afetadas, estado, referência do commit e evidência deste cache, sem duplicar código.
7. Se houver contradição, **o código atual prevalece**; corrija o cache. Defaults, contagens, versões e processos são snapshots.
8. Detalhes de transação, migração, canonicalização RSA, fatores/cifra, cancelamento e hardware exigem releitura dirigida antes de alteração. Nenhum segredo deve entrar neste arquivo.
