# FácilID / AcessoSênior

Protótipo escolar de emissão e autenticação com CPF + cartão JSON assinado e confirmação por PIN ou biometria do aparelho. Inclui captura autorizada de foto e assinatura desenhada, além de demonstração sem hardware com dados fictícios. Não faz reconhecimento facial nem comprova que a biometria pertence ao CPF. Veja [a análise original do prompt](ANALISE-DO-PROMPT.md) e a evolução descrita abaixo.

## Instalar e demonstrar no computador

Pré-requisitos: Node.js 22.13+ (validado neste ambiente com 24), npm, navegador e XAMPP com **MySQL iniciado** no painel. A instalação do XAMPP validada usa MariaDB 10.4.32, compatível com o driver MySQL usado aqui. Na pasta raiz:

```powershell
npm install
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
npm run db:setup
npm run db:check
# Se você já tem cartões em backend/.local/usuarios.json, com a API parada:
npm run db:migrate
npm run setup
npm run dev
```

O projeto já registra a permissão dos dois scripts de instalação necessários ao Expo e à compilação web (`@scarf/scarf` e `esbuild`). Confirme o estado com `npm install-scripts ls`; a resposta esperada é `No packages with unreviewed install scripts.`. Se o npm pedir aprovação novamente depois de apagar o `package-lock.json`, use os nomes completos, nunca `npm install-scripts approve` sem argumentos:

```powershell
npm install-scripts approve @scarf/scarf@1.4.0 esbuild@0.28.2 --no-allow-scripts-pin
```

O comando `npm install-scripts approve --all` também existe, mas concede scripts a qualquer dependência e não é necessário para este projeto.

Em outro terminal, na mesma pasta:

```powershell
npm run web
```

Abra http://localhost:8081. API: http://localhost:3000, Swagger: http://localhost:3000/docs. O esquema também está em `/openapi.json`.

O setup gera ou reutiliza RSA em `backend/.local/keys`. Emita exemplos pela área do responsável, escolhendo um PIN de 6 números. Opcionalmente, defina a variável `DEMO_PIN` antes do setup para gerar os dois exemplos fictícios Maria Silva e José Santos; não existe PIN padrão. Limpe essa variável depois. Repetir setup preserva chaves e cartões, inclusive bloqueados, e não migra cartões antigos silenciosamente. Os cartões e seus estados ficam no banco **facilid**. A listagem `/api/usuarios` exige autorização e retorna somente resumos. Os segredos de sessão e administração são gerados em `backend/.local/jwt.secret` e `backend/.local/admin.token`; podem ser substituídos por `JWT_SECRET` e `ADMIN_TOKEN`, respectivamente, com pelo menos 32 caracteres. Nunca versionar `.local/` nem `.env`.

1. Abra **Área do responsável**. Abra o arquivo `backend/.local/admin.token` localmente no editor e copie a chave para o campo administrativo. Ela fica somente na memória desta tela; não compartilhe a chave com cidadãos nem a inclua em capturas de tela.
2. Entre na área administrativa, escolha **Usar modo demonstração sem câmera**, preencha dados fictícios e desenhe/confirme a assinatura ou toque em **Usar assinatura fictícia**. Escolha e confirme um PIN de 6 números e gere o cartão. O cidadão não consegue emitir, listar ou recuperar cartões sem a chave administrativa.
3. Após emitir, toque em **Usar este cartão na demonstração**. O app volta ao cidadão com o cartão preparado, sem copiar JSON.
4. Confira o CPF, toque em **Continuar** e em **Entrar com o cartão preparado**. Na etapa **Confirme seu acesso**, informe o PIN criado na emissão e toque em **Confirmar PIN**. Só então será aberta a sessão. No navegador, esse é o caminho disponível.
5. Toque em **Consultar meu acesso** para validar a sessão na API; depois **Sair**.
6. As alternativas ficam em **Opções da demonstração**: ler QR Code, colar texto e usar o exemplo preparado. Para QR, mostre o código em outra tela. Navegadores exigem localhost ou HTTPS para câmera; se a permissão não puder ser solicitada novamente, o app explica como alterá-la e oferece texto.
7. Troque o CPF ou altere o nome dentro do JSON mantendo a assinatura: deve recusar. Emita uma segunda via com os mesmos dados: o cartão anterior deve ser recusado.
8. Teste **Ouvir instruções**, **Parar áudio**, teclado, zoom e leitor de tela. A voz web pode precisar de um toque inicial no navegador.

Cada cartão v2 recebe `emissaoId` UUID e `versao: 2` dentro da assinatura canônica. O repositório mantém o estado ativo, bloqueado ou substituído separadamente da credencial assinada. Bloquear ou reemitir invalida também as sessões daquele cartão na próxima consulta à API. O app retorna ao login ao receber 401 e usa o horário de expiração informado pelo servidor, com aviso prévio.

**Migração dos dados antigos:** execute `npm run db:migrate` apenas na configuração inicial, com a API parada. O comando importa `usuarios.json` sem alterar nenhum byte da origem ou das chaves. Cartões v2 mantêm identificadores, assinaturas e estados; cartões v1 ficam em `facilid_legados` e precisam de nova emissão. A importação não cria PINs nem assina cartões novos automaticamente. Repetir a importação sobre o mesmo conteúdo não duplica registros; se o banco já tiver cartões novos, bloqueios ou outras diferenças, ela é recusada para evitar sobrescrever o estado atual. Sem arquivo de origem, o comando apenas informa que não há dados para importar.

**Cartões v2 emitidos antes desta coleta também precisam de segunda via**, pois não têm assinatura capturada e PIN cadastrados. Nenhum PIN é criado automaticamente para credenciais antigas. Se esquecer o PIN ou perder o aparelho, peça ao responsável o bloqueio e uma nova emissão; isso invalida cartão, sessões e credenciais dos aparelhos antigos.

## Banco MySQL do XAMPP

O aplicativo continua falando com a API Node na porta 3000; somente o backend acessa o MySQL, normalmente na porta 3306. Apache não é necessário para a API: inicie-o se quiser consultar o banco pelo phpMyAdmin em `http://localhost/phpmyadmin`. Não altere registros de cartões manualmente durante a demonstração.

As opções ficam no arquivo privado `backend/.env`, com o modelo em [backend/.env.example](backend/.env.example): `DB_CLIENT=mysql`, `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_NAME=facilid`, `DB_USER=root` e `DB_PASSWORD`. Root sem senha corresponde ao padrão local do XAMPP; se sua instalação usa senha, preencha-a ali. Variáveis já definidas no terminal têm precedência. `DATA_DIR` é relativo à pasta backend e mantém `.local` como padrão.

`db:setup` cria o banco e as tabelas se estiverem ausentes. `db:check` confere conexão e estrutura. O servidor verifica a estrutura ao iniciar e não cria outro armazenamento se a conexão falhar. `/health` responde 503 se o banco ficar indisponível durante a execução. Para uso diário, basta iniciar MySQL no XAMPP, executar `npm run dev` e, em outro terminal, `npm run web`; não repita migração a cada inicialização.

| Tabela | Conteúdo |
| --- | --- |
| `facilid_pessoas` | CPF usado para coordenar emissões da mesma pessoa. |
| `facilid_cartoes` | Identidade assinada, identificador de emissão, ordem e estado ativo/bloqueado/substituído. |
| `facilid_legados` | Cartões antigos preservados como histórico, sem liberação de acesso. |
| `facilid_migracoes` | Registro da importação para impedir duplicação. |

Emissão, segunda via e bloqueio usam transações. Um índice impede dois cartões ativos para o mesmo CPF; emissões simultâneas são coordenadas por pessoa. As consultas usam parâmetros. O esquema legível está em [schema-mysql.sql](backend/src/db/schema-mysql.sql); o comando de preparo já o aplica, sem importação manual pelo phpMyAdmin.

Fotos, desenhos, fatores de acesso e suas chaves continuam cifrados em `backend/.local/coletas`; não são movidos ao SQL. Para recuperar o sistema, faça backup privado **do banco e de toda a pasta `.local`**, com a API parada, mantendo também a configuração de conexão. O SQL contém CPF e identidade, sem criptografia de aplicação; o acesso ao XAMPP e ao computador deve ser restrito. Para uso fora da demonstração local, use usuário de banco com permissões mínimas e configuração própria, em vez da conta root do XAMPP.

Para uma demonstração sem XAMPP, escolha explicitamente `DB_CLIENT=json` em `backend/.env`. Nesse modo, os cartões ficam em `usuarios.json`; o adaptador JSON preserva a migração v1 em `usuarios.json.legado-v1.json`. Essa escolha não sincroniza bancos: voltar ao JSON depois de emitir no MySQL abre uma base separada e antiga. Mantenha um único backend em execução, inclusive com MySQL, pois coletas e desafios ainda dependem de arquivos e memória locais.

Compatibilidade conferida na [documentação do mysql2](https://sidorares.github.io/node-mysql2/docs/examples/connections/create-pool) e na [documentação do XAMPP para Windows](https://www.apachefriends.org/faq_windows.html). Evidências desta integração em [VALIDACAO-MYSQL.md](VALIDACAO-MYSQL.md).

## Foto, assinatura e biometria

Para a coleta autorizada, mantenha o modo de foto e assinatura na área do responsável. Leia o aviso com o voluntário e confirme o consentimento antes de abrir a câmera. Capture o rosto, confira a prévia e escolha **Refazer foto** ou **Confirmar foto**. Desenhe no quadro com o dedo ou o mouse; **Limpar assinatura** permite refazer. Um quadro vazio ou um toque isolado não pode ser confirmado. Defina o PIN e gere o cartão. A câmera precisa de permissão e, no navegador, de localhost ou HTTPS. Recusar a câmera não impede escolher a demonstração sem foto real.

O upload autenticado aceita JPEG/PNG de até 2 MB e dimensões limitadas. A foto e o SVG gerado no servidor ficam separados da tag. `rosto_hash` contém SHA-256 dos bytes da foto; o campo legado `assinatura_svg` contém apenas `sha256:<hash>`, sem desenho. `digital_template` é um marcador explícito de que nenhuma digital foi coletada. A assinatura RSA e sua representação canônica foram preservadas.

Em aparelho compatível, entre primeiro com PIN e marque **Habilitar biometria neste aparelho**, somente num celular de confiança. A API emite uma credencial aleatória vinculada ao cartão; o app guarda essa credencial no SecureStore com `requireAuthentication: true`. Nos próximos acessos, **Confirmar com biometria** solicita a confirmação do sistema para desbloqueá-la. O servidor verifica a credencial antes de emitir JWT: enviar um simples resultado booleano não libera acesso. No iOS, a primeira gravação no Keychain pode não mostrar o diálogo; a leitura protegida o exige. O app não recebe imagem facial, digital ou template do sensor.

Biometria ausente, não configurada, cancelada, recusada ou invalidada por mudanças no cadastro biométrico oferece o PIN. A habilitação é opcional, com até cinco credenciais por cartão; novos registros substituem o mais antigo. Alterar o endereço do servidor exige habilitação novamente para aquele endereço. A API entrega desafios de dois minutos, de uso único, e só entrega sessão após a confirmação. Cinco erros bloqueiam novas tentativas daquela emissão por 30 segundos, mesmo após novo desafio ou reinício do servidor.

Dependências alinhadas ao mapa do Expo 54 instalado: [LocalAuthentication ~17.0.9](https://docs.expo.dev/versions/v54.0.0/sdk/local-authentication/), [SecureStore ~15.0.8](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/) e [FileSystem ~19.0.24](https://docs.expo.dev/versions/v54.0.0/sdk/filesystem-legacy/). A câmera e o SVG já faziam parte do projeto. Recompile o Dev Client após instalar; Expo Go não valida este conjunto nativo. O navegador usa PIN, sem simular uma autenticação biométrica bem-sucedida.

## Dados sensíveis e privacidade

Use dados fictícios para a demonstração habitual. Capture foto e assinatura reais apenas de voluntários informados que consentiram, como colegas de turma; nunca de terceiros sem autorização. Fotos, assinaturas e dados biométricos exigem avaliação de finalidade, necessidade, retenção e controle de acesso conforme a [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm). Dados biométricos vinculados a uma pessoa são dados pessoais sensíveis. O botão de consentimento deste protótipo não substitui essa avaliação nem constitui um sistema completo de comprovação de consentimento.

O backend guarda foto, SVG e índice de fatores cifrados com AES-256-GCM em `backend/.local/coletas/`, fora do Git e sem rota pública de mídia. O PIN é armazenado apenas como scrypt com salt aleatório, dentro do índice cifrado; credenciais de aparelho têm apenas hash no servidor. A chave `coleta.key` fica junto do armazenamento privado: isso protege arquivos isolados, mas não alguém com acesso à pasta inteira. Os modos de arquivo restritos em Unix não substituem ACLs no Windows. Use uma conta/pasta restrita e evite sincronizar dados reais desta pasta de desenvolvimento com OneDrive ou serviços semelhantes. Não inclua `.local`, PINs, fotos, cartões ou segredos em logs, prints, backups públicos ou no Git.

No aplicativo, a foto e o desenho ficam em memória durante a emissão e são limpos ao concluir ou sair. O arquivo temporário criado pela câmera nativa é removido após a captura, inclusive se a resposta chegar após sair da tela. Uploads sem emissão expiram após 15 minutos e são removidos no próximo acesso ao repositório ou reinício; não há temporizador que apague arquivos com o servidor desligado. Coletas já emitidas permanecem para o histórico, inclusive de cartões bloqueados ou substituídos. Ainda falta uma política operacional de exclusão e retenção: encerre demonstrações com dados reais de acordo com o combinado com os voluntários. Não apague chaves isoladamente, pois isso torna as coletas ilegíveis.

Use HTTPS fora do teste local. Este protótipo roda em uma única instância; as transações MySQL abrangem os cartões, mas não tornam atômicos o banco e os arquivos de coletas juntos. A aplicação remove a coleta se o salvamento falhar, porém uma interrupção abrupta ainda exige recuperação operacional. Gestão individual de administradores, recuperação de conta, auditoria e gestão de chaves continuam necessárias para uso real. O servidor confirma a posse da credencial do aparelho, sem atestado criptográfico de hardware nem garantia contra um cliente comprometido.

## O que este protótipo realmente comprova

- Captura e confirmação de foto, com vínculo de integridade entre seus bytes e o cartão.
- Coleta de assinatura desenhada, com bloqueio de desenho vazio e hash do SVG guardado.
- Integridade e origem do cartão pela RSA; situação ativa, substituída ou bloqueada no servidor.
- Conhecimento do PIN ou apresentação da credencial protegida pela biometria do aparelho, antes de criar sessão. A validação física desse diálogo em Android/iOS ainda precisa ser realizada; testes automatizados simulam o sensor.
- Demonstração completa sem câmera, NFC ou biometria, claramente identificada como fictícia.

## O que ainda não comprova

- Reconhecimento facial 1:1, comparação de rostos ou prova de vida contra foto/vídeo.
- Autoria da assinatura desenhada ou autenticidade de uma assinatura manuscrita.
- Que a digital/face cadastrada no celular pertence ao CPF informado. Em celular compartilhado, outras biometrias cadastradas também podem autorizar acesso.
- Captura ou reconhecimento de impressão digital com sensor dedicado; identidade civil, equivalência a documento oficial ou resistência do cartão à clonagem.

Comparação facial futura exigiria tecnologia dedicada, avaliação de vieses, prova de vida e testes em hardware real. Detectar a presença de um rosto não identifica a pessoa. A cópia do JSON continua possível, embora o cartão sozinho não seja suficiente para entrar sem o segundo fator.

## Android e NFC real

Expo Dev Client foi escolhido porque NFC, TTS e feedback tátil precisam de código nativo. Expo Go não é suficiente. A configuração usa `newArchEnabled: false`: NFC Manager 3.17.2 exige a arquitetura legada, ainda disponível no Expo 54. Instale Android Studio, SDK, JDK compatível com o Expo SDK 54 e configure o aparelho/emulador. As permissões NFC/câmera/vibração estão em `mobile/app.json`; o prebuild gera `android/AndroidManifest.xml` e autolinking das bibliotecas. Refaça o cliente Android após mudar essa configuração; atualizar apenas o JavaScript não basta.

```powershell
cd mobile
npm run android:prepare
npm run android
```

Em aparelho físico, conecte por USB com depuração e use `adb reverse tcp:3000 tcp:3000`; em **Ajustar conexão**, defina `http://127.0.0.1:3000`. O emulador Android usa `http://10.0.2.2:3000` por padrão. Alternativa por rede local: no terminal backend use `$env:HOST='0.0.0.0'` antes de iniciar e informe o IP do computador no app. Use somente uma rede confiável: as rotas administrativas agora exigem chave, mas HTTP local não criptografa o tráfego. Acesso público continua exigindo HTTPS, gestão individual de responsáveis e proteção contra abuso.

1. Em Android com NFC, gere um cartão no emissor.
2. Use uma tag **NDEF formatada e gravável com capacidade suficiente (recomendado 2 KB+)**. Toque em **Gravar na tag NFC**, aproxime e aguarde confirmação.
3. Volte à entrada, informe o CPF, toque em **Continuar** e **Aproximar cartão**.
4. Aproxime a tag, confirme o PIN ou a biometria habilitada; confira leitura em voz alta, vibração e cartão digital.
5. Teste NFC desligado, cancelamento e tag pequena/somente leitura. A falha deve mostrar mensagem sem liberar acesso.

**NTAG213/215 não comportam este JSON RSA.** Não é possível satisfazer esse critério do prompt preservando todos os campos e assinatura RSA. O código verifica a capacidade antes de escrever. Não se deve truncar nem reduzir a segurança da assinatura para forçar a gravação.

Para comprar cartões para o formato atual, a recomendação é **MIFARE DESFire EV3 de 4 KB, já configurado como NDEF Type 4, gravável e com espaço NDEF suficiente**. O app não formata cartões DESFire virgens nem configura suas chaves; confirme o fornecimento pronto com o vendedor e teste uma unidade no celular antes de comprar um lote. A NXP documenta [memória e suporte Type 4](https://www.nxp.com/products/MF3DHx3). O uso NDEF atual não ativa as funções criptográficas do chip.

A [NTAG216 tem 888 bytes de memória de usuário](https://www.nxp.com/products/NTAG213_215_216), parte usada pela estrutura NDEF. Um exemplo do cartão novo ocupou 731 bytes como mensagem NDEF; um nome de 100 caracteres acentuados elevou para 909 bytes. Assim, NTAG216 pode atender exemplos pequenos, mas não todos os cadastros aceitos. Fotos e desenhos completos nunca são gravados na tag. NTAG I²C Plus 2K oferece outra opção de memória, mas costuma ser vendido como módulo; confira formato, antena e capacidade NDEF efetiva.

## Testes e looping

```powershell
npm run check
npm run check:watch
# Com MySQL local iniciado, inclui testes reais em bancos temporários:
npm run check:mysql
```

O primeiro comando executa uma rodada completa. O segundo observa arquivos e repete tipos, testes e builds após cada alteração, até Ctrl+C. Resultados em `reports/latest.json`, históricos `reports/cycle-*.json` e logs por etapa. Falhas têm código de saída diferente de zero. Corrija a causa indicada no log, salve e aguarde nova rodada. O observador não altera código automaticamente; o agente/desenvolvedor faz a correção e acompanha o resultado. Não confundir repetição de testes com reparo autônomo.

`npm run test:mysql` executa somente a integração com banco real. Ela cria e remove bancos artificiais `facilid_test_<processo>_<id>`; nunca seleciona `facilid` nem lê o `.env` privado. Se o MySQL local exigir senha ou outra porta, forneça `DB_USER`, `DB_PASSWORD` e `DB_PORT` como variáveis do terminal de teste. O usuário precisa poder criar/remover esses bancos de teste. A suíte recusa hosts externos; somente localhost é permitido. Para repetir o ciclo completo ao salvar, use `npm run check:watch -- --mysql`.

Comandos individuais: `npm test` (backend e mobile), `npm test -w backend`, `npm test -w mobile`, `npm run typecheck`, `npm run build`. Os testes do backend usam diretórios temporários isolados, sem modificar os dados da demonstração. Os testes das telas usam Jest Expo 54 e React Native Testing Library 13.3.3, com React Test Renderer fixado em 19.1.0, igual ao React do projeto. Câmera e transporte NFC são simulados nesses testes; eles não certificam hardware.

A árvore de dependências ainda apresenta alertas de segurança no npm. Consulte `npm audit` para a situação atual. Não aplique `npm audit fix --force` automaticamente: ele pode atualizar versões principais e quebrar o conjunto Expo 54/React Native 0.81. Atualizações de SDK e migração para a nova arquitetura devem ser feitas juntas, com revisão da biblioteca NFC e nova rodada de testes.

## Estrutura

```text
backend/src/
  app.ts, server.ts
  routes/                 emissão, login e perfil protegido
  middleware/             sessão autenticada e verificação do estado do cartão
  services/               RSA, JWT e criação de cartões
  repositories/           interface, MySQL, JSON opcional e coletas cifradas
  schemas/                validação Zod
  docs/                   OpenAPI e Swagger
  db/                     esquema MySQL, migração, conexão e seed opcional
backend/tests/            integração e contrato com mobile
mobile/
  App.tsx, app.json
  src/screens/            emissão, login e cartão digital
  src/components/         controles acessíveis e leitor QR
  src/services/           API, NFC, simulação, voz e vibração
  src/theme/              fontes grandes e alto contraste
  tests/                  telas, API e serviço NFC com transporte simulado
scripts/verify.mjs        verificação contínua com relatórios
```

## Limites de validação

Compilar e passar testes automatizados não comprova leitura/gravação em hardware. NFC, câmera, voz e vibração precisam do teste manual acima em dispositivo compatível. A build web não substitui uma compilação Android. A integração foi exercitada com MariaDB 10.4.32 do XAMPP; não foi executada contra uma instalação separada do MySQL 8. O sistema ainda atende uma única instância local. Copiar o JSON do cartão copia a credencial; este protótipo demonstra assinatura e autenticação, não resistência à clonagem.

## Pontos preparados para a Etapa 2

O middleware `exigirSessao` pode proteger futuras rotas de agendamento, verificando o estado do cartão a cada chamada. A interface `UsuariosRepository` agora possui implementação MySQL com operações assíncronas e transações, além do JSON opcional. Toda requisição recebe `X-Request-Id`, inclusive erros controlados; o tratador geral também inclui esse identificador no corpo. Não foi instalado um coletor de logs nem implementado agendamento. Um futuro registrador deve aceitar somente identificador e código de erro, sem CPF, conteúdo do cartão, chave administrativa ou JWT.

Evidências atuais em [VALIDACAO-MYSQL.md](VALIDACAO-MYSQL.md). As rodadas anteriores permanecem como histórico em [VALIDACAO-BIOMETRIA.md](VALIDACAO-BIOMETRIA.md) e [VALIDACAO.md](VALIDACAO.md). Referências de compatibilidade: [arquiteturas no Expo](https://docs.expo.dev/guides/new-architecture/), [versões do NFC Manager](https://github.com/revtel/react-native-nfc-manager#version-notes) e [dependências da Testing Library 13.3.3](https://github.com/callstack/react-native-testing-library/blob/v13.3.3/package.json).
