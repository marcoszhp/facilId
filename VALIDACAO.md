# Validação — Etapa 1 (19–20 de setembro de 2026)

Alterações no projeto existente, validadas localmente antes da publicação autorizada no GitHub. Ambiente Windows; Expo 54.0.37, React Native 0.81.5, React 19.1.0.

A suíte atual tem **83 casos: 42 backend e 41 mobile**. O ciclo completo verifica tipos, testes e build backend/web. Resultado reproduzível em `reports/latest.json`; logs em `reports/types.log`, `reports/tests.log` e `reports/build.log`.

## Checklist de aceite

| Item | Situação | Evidência e limite |
| --- | --- | --- |
| P1.1 — NFC/Android | **Parcial: falta aceite físico** | `newArchEnabled: false` com NFC Manager 3.17.2. Prebuild concluído e Gradle gerado com arquitetura legada. Dez testes cobrem configuração, NDEF e cancelamento com transporte simulado. Build Android interrompida pela ausência de Java; nenhum aparelho físico validado. |
| P1.2 — segunda via | **Atendido por integração** | UUID e versão assinados; histórico ativo/bloqueado/substituído. Reemitir dados idênticos invalida o cartão anterior. |
| P1.3 — administração | **Atendido** | Emissão, listagem, recuperação e bloqueio exigem `X-Admin-Token`. Ausência, chave inválida e JWT de cidadão são recusados. Listagem só fornece resumos; interface separa as áreas. |
| P1.4 — câmera/cancelamento | **Atendido nos testes automatizados** | Recusa temporária/permanente com recuperação e alternativa em texto. AbortSignal chega ao Axios; operações antigas não autenticam após cancelamento/desmontagem. Permissões reais do sistema ainda precisam de teste em aparelho. |
| P1.5 — sessões | **Atendido por integração e telas** | JWT vinculado à emissão e estado conferido a cada chamada. Bloqueio/segunda via revogam a sessão anterior; 401 volta ao login. Prazo vem da API, com aviso um minuto antes. |
| P1.6 — testes mobile | **Atendido** | Jest Expo 54.0.18, Testing Library 13.3.3 e React Test Renderer 19.1.0; testes de erros e navegação, sem snapshots como prova de comportamento. |

## Ciclos e evidências desta rodada

- Baseline: 26 testes existentes passaram antes das alterações. Foram preservados e adaptados para cartão v2/autorização, passando novamente após a integração inicial.
- Backend passou com 42 testes, tipos e build após adicionar segunda via, estados, administração, revogação e migração.
- Testes de câmera falharam contra a implementação anterior e passaram com a recuperação de permissões.
- Um teste revelou que `Tts.speak` retorna Promise no código nativo, apesar da declaração de tipos antiga. Foram corrigidos await e concorrência para uma fala antiga não interromper a nova.
- A primeira rodada consolidada passou tipos/testes/build, mas ficou `stale` porque arquivos ainda mudavam durante a execução. O ciclo final roda com fontes estabilizadas; a data e o status efetivos estão em `reports/latest.json`.
- No navegador, a build exportada conectou a uma API isolada, abriu a área protegida e emitiu cartão fictício com atalho de demonstração. O fluxo emissão → atalho → login → 401 também tem teste de App com transporte simulado.
- Dados reais de `backend/.local` não foram usados como massa de testes; foram usados diretórios temporários.
- `npm run android:prepare -w mobile -- --no-install` concluiu. O comando `gradlew.bat :app:assembleDebug --no-daemon` falhou com `JAVA_HOME is not set and no 'java' command could be found in your PATH`. Java, ADB e SDK não foram encontrados no PATH nem nos diretórios usuais inspecionados. Prebuild e build web não comprovam uma build Android.

## Testes novos e alterados

| Arquivo | Casos | O que comprova |
| --- | ---: | --- |
| `backend/tests/autenticacao.test.ts` | 26 | Fluxos originais, adulteração, CPF divergente, representação canônica, persistência, entradas inválidas, JWT expirado/adulterado, Swagger, contrato mobile e capacidade de tags. Títulos parametrizados não imprimem payloads. |
| `backend/tests/ciclo-cartoes.test.ts` | 16 | Segunda via idêntica, campos de emissão assinados, autorização de todas as rotas administrativas, chave persistente, revogação/reinício, histórico, JWT legado, IDs inválidos, migração sem perda e request ID. |
| `mobile/tests/LeitorQr.test.tsx` | 7 | Permissões temporária/permanente/carregando, leitura única, erro de solicitação/inicialização e bloqueio no navegador. |
| `mobile/tests/LoginScreen.test.tsx` | 4 | CPF antes da leitura, fases NFC/servidor, cancelamentos e resposta tardia após desmontagem. |
| `mobile/tests/SucessoScreen.test.tsx` | 4 | 401 encerra acesso, rede permite repetir, prazo da API/aviso e cancelamento ao sair. |
| `mobile/tests/App.test.tsx` | 3 | Separação das áreas, emissão → demonstração → login → 401, navegação com login pendente. |
| `mobile/tests/ControleAudio.test.tsx` | 1 | Visibilidade e acionamento de “Parar áudio”. |
| `mobile/tests/api.service.test.ts` | 8 | Parser/CPF antes da rede, cabeçalhos separados, AbortSignal nas seis operações e reconhecimento de 401/cancelamento. |
| `mobile/tests/feedback.test.ts` | 4 | Parada durante inicialização, conclusão por ID assíncrono, falha do motor e concorrência de falas. |
| `mobile/tests/nfc.service.test.ts` | 10 | Arquitetura legada, NDEF real com transporte simulado, leitura string/vetor, escrita integral, tags pequenas/somente leitura e cancelamento/recuperação. |

Execute na raiz `npm test`, `npm run check` ou `npm run check:watch`. O observador repete verificações após alterações e registra falhas; quem corrige o código é o desenvolvedor/agente. Não se trata de reparo automático do código pelo script.

## Inventário completo das alterações

Os caminhos são relativos à raiz. O diff completo, incluindo arquivos novos e lockfile, está no artefato local não versionado `reports/etapa1.patch`. No GitHub, consulte o diff do commit de implementação desta etapa.

| Arquivo | Resumo |
| --- | --- |
| `README.md` | Atualiza acesso administrativo, demonstração, migração e limitações. |
| `VALIDACAO.md` | Documenta testes, inventário, evidências e pendências. |
| `package.json` | Executa testes dos dois workspaces. |
| `package-lock.json` | Fixa a árvore das dependências de testes adicionadas. |
| `backend/src/app.ts` | Integra autorização e identificador seguro de requisição. |
| `backend/src/server.ts` | Carrega a credencial administrativa. |
| `backend/src/db/seed.ts` | Prepara exemplos sem reativar cartões bloqueados. |
| `backend/src/docs/swagger.ts` | Atualiza contratos v2, estados, expiração e autorização. |
| `backend/src/schemas/payload.ts` | Valida versão e UUID com Zod. |
| `backend/src/services/assinatura.service.ts` | Assina versão e UUID na representação canônica. |
| `backend/src/services/emissao.service.ts` | Gera UUID novo para cada emissão. |
| `backend/src/services/auth.service.ts` | Vincula JWT à emissão e informa expiração. |
| `backend/src/services/admin.service.ts` (novo) | Gera/carrega chave e compara autorização com segurança. |
| `backend/src/middleware/sessao.ts` (novo) | Confere sessão e cartão ativo a cada chamada protegida. |
| `backend/src/repositories/usuarios.repository.ts` | Mantém histórico/estados e migra dados preservando o original. |
| `backend/src/routes/emissao.routes.ts` | Protege emissão/listagem/recuperação/bloqueio. |
| `backend/src/routes/autenticacao.routes.ts` | Recusa cartões/sessões revogados e reutiliza middleware. |
| `backend/tests/autenticacao.test.ts` | Adapta os 26 casos originais. |
| `backend/tests/ciclo-cartoes.test.ts` (novo) | Acrescenta 16 regressões de segurança e persistência. |
| `mobile/app.json` | Desativa nova arquitetura para NFC Manager v3. |
| `mobile/package.json` | Adiciona comando/dependências de testes e fixa renderer 19.1.0. |
| `mobile/jest.config.cjs` (novo) | Configura preset Expo e isolamento de mocks. |
| `mobile/App.tsx` | Separa áreas, transfere demo em memória e coordena saída. |
| `mobile/src/components/LeitorQr.tsx` | Trata permissões, falhas, configurações e alternativa em texto. |
| `mobile/src/components/ControleAudio.tsx` (novo) | Exibe controle de interrupção da fala. |
| `mobile/src/components/useOperacao.ts` (novo) | Cancela chamadas e descarta resultados antigos. |
| `mobile/src/screens/LoginScreen.tsx` | Implementa dois passos, menu secundário e fases distintas. |
| `mobile/src/screens/EmissorScreen.tsx` | Exige credencial, gerencia cartões e oferece demo sem cópia. |
| `mobile/src/screens/SucessoScreen.tsx` | Usa prazo da API, avisa e encerra por 401. |
| `mobile/src/services/identidade.ts` | Espelha contratos v2 e orienta reemissão de cartão antigo. |
| `mobile/src/services/api.service.ts` | Encaminha autorização, sinais e operações administrativas. |
| `mobile/src/services/nfc.service.ts` | Cancela durante preparação e impede operações sobrepostas. |
| `mobile/src/services/feedback.ts` | Controla atividade/cancelamento/concorrência do TTS. |
| `mobile/src/services/feedback.web.ts` | Controla fala e interrupção no navegador. |
| `mobile/tests/helpers.ts` (novo) | Compartilha dados fictícios e controle de Promises. |
| `mobile/tests/App.test.tsx` (novo) | Testa áreas, fluxo de demonstração e navegação. |
| `mobile/tests/ControleAudio.test.tsx` (novo) | Testa a ação de parar áudio. |
| `mobile/tests/LeitorQr.test.tsx` (novo) | Testa permissão, falhas e leitura única. |
| `mobile/tests/LoginScreen.test.tsx` (novo) | Testa etapas e cancelamento sem login tardio. |
| `mobile/tests/SucessoScreen.test.tsx` (novo) | Testa sessão, prazo, rede e cancelamento. |
| `mobile/tests/api.service.test.ts` (novo) | Testa validação e contrato do transporte. |
| `mobile/tests/feedback.test.ts` (novo) | Testa operações assíncronas de fala. |
| `mobile/tests/nfc.service.test.ts` (novo) | Testa NDEF e transporte NFC simulado. |

`mobile/android/` foi regenerado e continua ignorado pelo Git, assim como relatórios, dependências, builds e caches.

## Compatibilidade, migração e limitações

A configuração segue a documentação oficial do [Expo](https://docs.expo.dev/guides/new-architecture/) e do [NFC Manager](https://github.com/revtel/react-native-nfc-manager#version-notes): SDK 54 aceita arquitetura legada; NFC Manager v3 a exige. Uma atualização para Expo 55+ requer rever a biblioteca NFC.

Jest Expo 54.0.18 corresponde ao mapa do SDK instalado. [Testing Library 13.3.3](https://github.com/callstack/react-native-testing-library/blob/v13.3.3/package.json) foi alinhada com Jest 29.7, React/Renderer 19.1.0. Não foi acrescentada biblioteca ao runtime do produto.

Na migração, o arquivo v1 é copiado byte a byte para `usuarios.json.legado-v1.json`, e seus registros ficam na seção `legados` do envelope v2. Cartões antigos precisam de nova emissão e não são listados como ativos. Backup conflitante ou arquivo inválido interrompe a migração sem sobrescrever dados. O estado mutável fica no servidor, separado da tag assinada, permitindo bloquear um cartão perdido sem regravá-lo.

A chave administrativa é `ADMIN_TOKEN` ou `backend/.local/admin.token`; fica em memória apenas na área do responsável e não é enviada nas chamadas do cidadão. O arquivo e os backups devem permanecer privados. JSON continua limitado a um processo; chave compartilhada atende demonstração local, não gestão de responsáveis para serviço público.

O npm informou 21 vulnerabilidades (12 moderadas, 9 altas) após instalar as dependências de testes. Não foi usado `audit fix --force`; avaliação/migração dessa árvore continua pendente. O aviso preexistente de depreciação de `SafeAreaView` não impediu os testes.

## Validação física pendente e Etapa 2

Para fechar P1.1: configurar JDK/SDK, gerar e instalar o Dev Client num Android físico com NFC; emitir, gravar em tag NDEF suficiente (recomendado 2 KB+), ler e cancelar. Repetir com NFC desligado, tag pequena/somente leitura e saída durante leitura. Conferir também QR/texto, permissões de câmera, TalkBack, fontes ampliadas, fala e vibração. Registrar aparelho, Android, build e resultados.

NTAG213/215 não comportam este JSON RSA; o código não trunca a credencial. Copiar o JSON ainda copia o cartão: UUID e revogação não conferem resistência à clonagem.

O middleware `exigirSessao` está pronto para futuras rotas autenticadas; `UsuariosRepository` isola JSON para futura implementação SQLite transacional. `X-Request-Id` é gerado por requisição e incluído no corpo de erros gerais. Um futuro registrador deve aceitar somente identificador e código de erro, nunca CPF, cartão, chave ou JWT. Não há novo log desses conteúdos.

Não foram implementados agendamentos, SQLite, coletor de logs, chatbot, push, autenticação totalmente offline, chip com desafio/resposta, integrações reais ou infraestrutura distribuída. A Etapa 2 continua pendente, após o aceite físico da Etapa 1.

---

# Histórico da implementação inicial (substituído pela avaliação acima)

Data: 6 de setembro de 2026. Ambiente: Windows, Node.js 24.20.0, npm 11.19.0.

## Ciclos e correções

- Primeira rodada: 26 testes aprovados; tipo do registro NFC recusado pelo TypeScript. Corrigida a interpretação de `type` como texto ou vetor de bytes.
- Build web: o Expo tentava gravar cache fora da pasta autorizada. Adicionado inicializador que mantém o cache no projeto.
- Setup: o executor TypeScript falhou ao consultar o perfil Windows. Scripts passaram a compilar com TypeScript e executar com Node; geração RSA, seed e servidor foram executados com sucesso.
- Preparação Android foi separada do comando de build para não disparar por convenção de lifecycle do npm.
- Rodada completa posterior: tipos, 26 testes e compilação backend/web aprovados.
- Observador contínuo: uma sonda temporária com asserção falsa produziu `status: failed` e código 1 na etapa de testes, mantendo tipos/build independentes. A sonda foi removida após comprovar a detecção; ela não pertence à suíte do produto. O observador deve voltar a aprovar as fontes corrigidas.
- Revisão Android: adicionadas declaração de consulta ao serviço TTS, NFC/câmera opcionais e mensagem para tag somente leitura.

## Fluxos observados no navegador

- Carregamento do exemplo Maria Silva, login com cartão assinado e exibição do cartão digital.
- Consulta ao endpoint protegido com retorno “Seu acesso está ativo”.
- Saída da sessão e abertura da tela de emissão.
- Emissão de Ana Exemplo, CPF fictício 22233344455, com JSON e QR Code exibidos.
- Tentativa com CPF diferente recusada na interface com mensagem clara.

## Cobertura automatizada

26 casos cobrem emissão, login, assinatura falsa, adulteração dos campos, ordem de propriedades, cartão desconhecido/substituído, reinício com persistência, validação de cadastro, JSON inválido/excessivo, JWT expirado/adulterado, perfil protegido, documentação, validação compartilhada com mobile e incompatibilidade de capacidade com NTAG213/215.

O resultado mais recente é registrado em `reports/latest.json`; os logs e históricos ficam na mesma pasta. Esse relatório se refere aos comandos executados, não a uma certificação de hardware ou acessibilidade.

## Pendências materiais

- Java e ADB não estão disponíveis no PATH. Não foi possível compilar/executar Android neste ambiente. O prebuild gerou a estrutura e permissões; isso não equivale a uma build nativa aprovada.
- Leitura/gravação NFC, câmera/QR real, voz e vibração precisam de validação em aparelho. A aparência web e a árvore de acessibilidade foram inspecionadas; TalkBack e fontes ampliadas no Android ainda precisam de teste manual.
- O JSON RSA não cabe nas tags NTAG213/215 citadas no prompt. Use NDEF de capacidade maior, conforme README e análise.
