# FácilID / AcessoSênior

Protótipo escolar de emissão e autenticação com CPF + cartão JSON assinado. Usa somente dados fictícios. Não inclui PIN, biometria real nem equivalência criptográfica com a CIE. Veja [a análise do prompt](ANALISE-DO-PROMPT.md).

## Instalar e demonstrar no computador

Pré-requisitos: Node.js 22.13+ (validado neste ambiente com 24), npm e navegador. Na pasta raiz:

```powershell
npm install
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

O setup gera RSA em `backend/.local/keys` e cadastra Maria Silva (12345678900, 72 anos) e José Santos (98765432100, 68 anos). Os cartões ficam em `backend/.local/usuarios.json`. A listagem `/api/usuarios` exige autorização e retorna somente resumos, sem assinatura ou conteúdo do cartão. Repetir setup preserva as chaves e os cartões ativos existentes. Os segredos de sessão e administração são gerados no primeiro início em `backend/.local/jwt.secret` e `backend/.local/admin.token`; podem ser substituídos por `JWT_SECRET` e `ADMIN_TOKEN`, respectivamente, com pelo menos 32 caracteres. Nunca versionar `.local/`.

1. Abra **Área do responsável**. Abra o arquivo `backend/.local/admin.token` localmente no editor e copie a chave para o campo administrativo. Ela fica somente na memória desta tela; não compartilhe a chave com cidadãos nem a inclua em capturas de tela.
2. Entre na área administrativa e emita um cartão com dados fictícios, ou selecione um cartão ativo da lista. O cidadão não consegue emitir, listar ou recuperar cartões sem essa chave.
3. Após emitir, toque em **Usar este cartão na demonstração**. O app volta ao cidadão com o cartão preparado, sem copiar JSON.
4. Confira o CPF, toque em **Continuar** e em **Entrar com o cartão preparado**. Confira nome e cartão digital.
5. Toque em **Consultar meu acesso** para validar a sessão na API; depois **Sair**.
6. As alternativas ficam em **Opções da demonstração**: ler QR Code, colar texto e usar o exemplo preparado. Para QR, mostre o código em outra tela. Navegadores exigem localhost ou HTTPS para câmera; se a permissão não puder ser solicitada novamente, o app explica como alterá-la e oferece texto.
7. Troque o CPF ou altere o nome dentro do JSON mantendo a assinatura: deve recusar. Emita uma segunda via com os mesmos dados: o cartão anterior deve ser recusado.
8. Teste **Ouvir instruções**, **Parar áudio**, teclado, zoom e leitor de tela. A voz web pode precisar de um toque inicial no navegador.

Cada cartão v2 recebe `emissaoId` UUID e `versao: 2` dentro da assinatura canônica. O repositório mantém o estado ativo, bloqueado ou substituído separadamente da credencial assinada. Bloquear ou reemitir invalida também as sessões daquele cartão na próxima consulta à API. O app retorna ao login ao receber 401 e usa o horário de expiração informado pelo servidor, com aviso prévio.

**Migração dos dados antigos:** ao abrir um arquivo v1, o repositório preserva uma cópia exata em `usuarios.json.legado-v1.json` e os dados na seção `legados` do arquivo v2. Cartões v1 não têm identificador de emissão e precisam ser reemitidos pelo responsável. A migração não assina cartões novos automaticamente. O backup também contém credenciais e deve permanecer privado em `.local/`.

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
4. Aproxime a tag; confira leitura em voz alta, vibração e cartão digital.
5. Teste NFC desligado, cancelamento e tag pequena/somente leitura. A falha deve mostrar mensagem sem liberar acesso.

**NTAG213/215 não comportam este JSON RSA.** Não é possível satisfazer esse critério do prompt preservando todos os campos e assinatura RSA. O código verifica a capacidade antes de escrever. Não se deve truncar nem reduzir a segurança da assinatura para forçar a gravação.

## Testes e looping

```powershell
npm run check
npm run check:watch
```

O primeiro comando executa uma rodada completa. O segundo observa arquivos e repete tipos, testes e builds após cada alteração, até Ctrl+C. Resultados em `reports/latest.json`, históricos `reports/cycle-*.json` e logs por etapa. Falhas têm código de saída diferente de zero. Corrija a causa indicada no log, salve e aguarde nova rodada. O observador não altera código automaticamente; o agente/desenvolvedor faz a correção e acompanha o resultado. Não confundir repetição de testes com reparo autônomo.

Comandos individuais: `npm test` (backend e mobile), `npm test -w backend`, `npm test -w mobile`, `npm run typecheck`, `npm run build`. Os testes do backend usam diretórios temporários isolados, sem modificar os dados da demonstração. Os testes das telas usam Jest Expo 54 e React Native Testing Library 13.3.3, com React Test Renderer fixado em 19.1.0, igual ao React do projeto. Câmera e transporte NFC são simulados nesses testes; eles não certificam hardware.

A árvore de dependências ainda apresenta alertas de segurança no npm. Consulte `npm audit` para a situação atual. Não aplique `npm audit fix --force` automaticamente: ele pode atualizar versões principais e quebrar o conjunto Expo 54/React Native 0.81. Atualizações de SDK e migração para a nova arquitetura devem ser feitas juntas, com revisão da biblioteca NFC e nova rodada de testes.

## Estrutura

```text
backend/src/
  app.ts, server.ts
  routes/                 emissão, login e perfil protegido
  middleware/             sessão autenticada e verificação do estado do cartão
  services/               RSA, JWT e criação de cartões
  repositories/           interface e armazenamento JSON
  schemas/                validação Zod
  docs/                   OpenAPI e Swagger
  db/                     seed de duas pessoas fictícias
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

Compilar e passar testes automatizados não comprova leitura/gravação em hardware. NFC, câmera, voz e vibração precisam do teste manual acima em dispositivo compatível. A build web não substitui uma compilação Android. O armazenamento JSON atende uma única instância local, não uso concorrente de múltiplos servidores. Copiar o JSON copia a credencial; este protótipo demonstra assinatura e autenticação, não resistência à clonagem.

## Pontos preparados para a Etapa 2

O middleware `exigirSessao` pode proteger futuras rotas de agendamento, verificando o estado do cartão a cada chamada. A interface `UsuariosRepository` concentra as operações que deverão virar transações numa futura implementação SQLite. Toda requisição recebe `X-Request-Id`, inclusive erros controlados; o tratador geral também inclui esse identificador no corpo. Não foi instalado um coletor de logs nem implementado agendamento. Um futuro registrador deve aceitar somente identificador e código de erro, sem CPF, conteúdo do cartão, chave administrativa ou JWT.

Evidências, checklist e limitações desta rodada estão em [VALIDACAO.md](VALIDACAO.md). Referências de compatibilidade: [arquiteturas no Expo](https://docs.expo.dev/guides/new-architecture/), [versões do NFC Manager](https://github.com/revtel/react-native-nfc-manager#version-notes) e [dependências da Testing Library 13.3.3](https://github.com/callstack/react-native-testing-library/blob/v13.3.3/package.json).
