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

O setup gera RSA em `backend/.local/keys` e cadastra Maria Silva (12345678900, 72 anos) e José Santos (98765432100, 68 anos). Os cartões estão em `backend/.local/usuarios.json` e `/api/usuarios`. Repetir setup preserva as chaves e não sobrescreve pessoas existentes. O segredo JWT é gerado no primeiro início em `backend/.local/jwt.secret`; pode ser substituído por `JWT_SECRET` com pelo menos 32 caracteres. Nunca versionar `.local/`.

1. Toque em **Usar exemplo fictício**, depois **Entrar com o código**. Confira nome e cartão digital.
2. Toque em **Consultar meu acesso** para validar o JWT na API; depois **Sair**.
3. Abra **Área de emissão**. Preencha outro nome fictício, CPF com 11 números e idade. Toque em **Gerar cartão**.
4. Copie o JSON, volte à entrada, informe o mesmo CPF e cole o código. Entre.
5. Troque o CPF: deve recusar. Altere o nome dentro do JSON mantendo a assinatura: deve recusar.
6. Para QR, exiba o código em outra tela e escolha **Ler QR Code**. Permita acesso à câmera. Navegadores exigem localhost ou HTTPS para câmera; colar texto sempre é alternativa.
7. Teste **Ouvir instruções**, teclado, zoom e navegação por leitor de tela. A voz web pode precisar de um toque inicial no navegador.

## Android e NFC real

Expo Dev Client foi escolhido porque NFC, TTS e feedback tátil precisam de código nativo. Expo Go não é suficiente. Instale Android Studio, SDK, JDK compatível com o Expo SDK 54 e configure o aparelho/emulador. As permissões NFC/câmera/vibração estão em `mobile/app.json`; o prebuild gera `android/AndroidManifest.xml` e autolinking das bibliotecas.

```powershell
cd mobile
npm run android:prepare
npm run android
```

Em aparelho físico, conecte por USB com depuração e use `adb reverse tcp:3000 tcp:3000`; em **Ajustar conexão**, defina `http://127.0.0.1:3000`. O emulador Android usa `http://10.0.2.2:3000` por padrão. Alternativa por rede local: no terminal backend use `$env:HOST='0.0.0.0'` antes de iniciar e informe o IP do computador no app. Use apenas rede confiável, pois emissão/listagem da demo são abertas. Acesso público precisa autenticação administrativa, HTTPS e proteção contra abuso.

1. Em Android com NFC, gere um cartão no emissor.
2. Use uma tag **NDEF formatada e gravável com capacidade suficiente (recomendado 2 KB+)**. Toque em **Gravar na tag NFC**, aproxime e aguarde confirmação.
3. Volte à entrada, informe o CPF, desligue **Modo simulado** e toque em **Aproximar cartão**.
4. Aproxime a tag; confira leitura em voz alta, vibração e cartão digital.
5. Teste NFC desligado, cancelamento e tag pequena/somente leitura. A falha deve mostrar mensagem sem liberar acesso.

**NTAG213/215 não comportam este JSON RSA.** Não é possível satisfazer esse critério do prompt preservando todos os campos e assinatura RSA. O código verifica a capacidade antes de escrever. Não se deve truncar nem reduzir a segurança da assinatura para forçar a gravação.

## Testes e looping

```powershell
npm run check
npm run check:watch
```

O primeiro comando executa uma rodada completa. O segundo observa arquivos e repete tipos, testes e builds após cada alteração, até Ctrl+C. Resultados em `reports/latest.json`, históricos `reports/cycle-*.json` e logs por etapa. Falhas têm código de saída diferente de zero. Corrija a causa indicada no log, salve e aguarde nova rodada. O observador não altera código automaticamente; o agente/desenvolvedor faz a correção e acompanha o resultado. Não confundir repetição de testes com reparo autônomo.

Comandos individuais: `npm test`, `npm run typecheck`, `npm run build`. No backend: `npm run generate-keys`, `npm run seed`, `npm run dev`, `npm test`. Testes usam diretórios temporários isolados, sem modificar os dados da demonstração.

O aviso `20 vulnerabilities (11 moderate, 9 high)` vem da árvore transitiva do Expo/Metro e não impede `npm install`, testes ou o modo simulado. Não execute `npm audit fix --force` automaticamente: o relatório indica atualização major para Expo 57, que pode quebrar o conjunto Expo 54/React Native 0.81. Trate essa atualização como uma migração separada, com revisão e nova rodada de testes.

## Estrutura

```text
backend/src/
  app.ts, server.ts
  routes/                 emissão, login e perfil protegido
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
scripts/verify.mjs        verificação contínua com relatórios
```

## Limites de validação

Compilar e passar testes automatizados não comprova leitura/gravação em hardware. NFC, câmera, voz e vibração precisam do teste manual acima em dispositivo compatível. A build web não substitui uma compilação Android. O armazenamento JSON atende uma única instância local, não uso concorrente de múltiplos servidores. Copiar o JSON copia a credencial; este protótipo demonstra assinatura e autenticação, não resistência à clonagem.
