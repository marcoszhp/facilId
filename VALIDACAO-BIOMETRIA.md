# Validação — foto, assinatura e confirmação de acesso

Implementação no projeto existente, a partir do prompt de coleta autorizado pelo usuário. O módulo de assinatura RSA (`backend/src/services/assinatura.service.ts`) permaneceu literalmente inalterado. A etapa anterior foi preservada em [VALIDACAO.md](VALIDACAO.md).

## Resultado e reprodução

A suíte integrada contém **150 testes: 72 no backend e 78 no mobile**. A contagem inclui 30 casos novos de coleta/fatores no backend e 37 casos adicionais no mobile, além das regressões adaptadas.

Execute `npm run check` na raiz para conferir tipos, testes e compilação backend/web. `npm run check:watch` repete a rodada ao salvar alterações; o agente/desenvolvedor corrige o código, não o observador. A evidência efetiva da rodada final, seu horário e o hash das fontes ficam em `reports/latest.json`, com logs por etapa. Todos os testes de backend usam dados artificiais e diretórios temporários; `backend/.local` não é a massa de testes.

Foram exercitados no navegador, contra uma API descartável: entrada administrativa, escolha da demonstração sem câmera, recusa de assinatura vazia, desenho com mouse, confirmação da assinatura, emissão, transferência do cartão ao login, terceiro passo obrigatório, recusa de PIN errado, PIN correto e consulta da sessão ativa. Não foi fotografada uma pessoa durante essa conferência.

O prebuild Android concluiu com permissões de câmera/NFC/biometria e regras do SecureStore para excluir seu conteúdo de backup. Java e ADB continuam ausentes do PATH inspecionado; não foi concluída uma build Android nem teste com sensor físico. Testes automatizados substituem câmera, SecureStore e biometria por implementações controladas. Isso não certifica Face ID, Touch ID, impressão digital Android ou leitura NFC real.

## Correções encontradas nos ciclos

- Compatibilidade do estilo web do quadro de assinatura com os tipos do React Native.
- Tipagem de casos parametrizados de assinatura vazia nos testes do backend.
- Refazer a foto desmontava o quadro, mas mantinha a assinatura anterior no cadastro. A captura agora limpa esse estado e exige confirmação de um novo desenho.
- Falha na gravação da assinatura podia deixar uma foto cifrada sem vínculo. O repositório passa a abranger as gravações no rollback e a recuperar resíduos; testes injetam falhas de entrada/saída.
- O primeiro salvamento de uma credencial no Keychain do iOS não necessariamente abre biometria. A interface e o README descrevem corretamente a confirmação nos acessos posteriores.

## O que os testes comprovam

| Arquivo de testes | Evidência |
| --- | --- |
| `backend/tests/autenticacao.test.ts` | Mantém regressões de RSA, adulteração, CPF, representação canônica, JWT, documentação e contrato mobile, adaptadas ao PIN. |
| `backend/tests/ciclo-cartoes.test.ts` | Preserva autorização administrativa, segunda via, revogação, histórico, persistência e migração. |
| `backend/tests/coleta-fatores.test.ts` | Foto/SVG cifrados, hashes dos bytes, mudança de hashes ao alterar coletas, rejeição de desenho vazio/coordenadas/markup, consentimento, limites/formatos, autorização antes do parser e ausência de mídia pública. |
| `backend/tests/coleta-fatores.test.ts` | Desafio sem JWT, PIN incorreto, repetição/expiração, apenas um fator, bloqueio por emissão persistido após reinício, credencial de dispositivo vinculada ao cartão, revogação e reemissão obrigatória de cartões sem PIN. |
| `backend/tests/coleta-fatores.test.ts` | Expiração/consumo de upload, integridade da cifra, limite de desafios e recuperação de falhas de persistência sem afetar o cartão anterior. |
| `mobile/tests/AssinaturaManuscrita.test.tsx` | Vazio/toque recusados, gestos com desenho, confirmação, limpeza, coordenadas e exemplo fictício explícito. |
| `mobile/tests/CapturaFoto.test.tsx` | Prévia/refazer/confirmar, permissão negada, resolução/limites e remoção do temporário mesmo após saída. |
| `mobile/tests/EmissorScreen.test.tsx` | Consentimento, PINs iguais, foto antes da emissão, limpeza, demonstração sem câmera, upload cancelado e assinatura invalidada ao refazer foto. |
| `mobile/tests/LoginScreen.test.tsx` | Cartão não libera sessão sozinho; indisponibilidade/recusa vai ao PIN; sucesso depende do servidor; biometria pendente não transmite a credencial; cancelamento/saída descartam respostas tardias; habilitação exige PIN válido. |
| `mobile/tests/biometria.service.test.ts` | Hardware/cadastro, SecureStore com autenticação obrigatória, credencial ausente/invalidada, falha de gravação e separação por servidor/emissão. |
| `mobile/tests/biometria.web.test.ts` | Navegador oferece PIN sem simular confirmação biométrica. |
| `mobile/tests/api.service.test.ts` | Endpoints, desafio/confirmar, upload administrativo, separação de cabeçalhos e AbortSignal. |
| `mobile/tests/App.test.tsx` | Demonstração emitida com PIN, acesso confirmado, encerramento por 401 e navegação durante operação pendente. |

As suítes existentes de QR, NFC, voz, controle de áudio e sessão continuam na verificação completa.

## Inventário de arquivos desta rodada

O diff integral, incluindo arquivos novos e lockfile, fica em `reports/biometria-assinatura.patch`. Ele compara esta implementação ao commit anterior; não inclui dados privados, builds ou dependências instaladas. A publicação desta rodada em `marcoszhp/facilId` foi autorizada pelo usuário em 21 de setembro de 2026. No GitHub, o commit correspondente também fornece o diff completo.

| Arquivo | Alteração |
| --- | --- |
| `README.md` | Explica coleta, PIN/biometria, privacidade, migração, demonstração e escolha de tags. |
| `VALIDACAO.md` | Identifica a validação anterior como histórico e aponta para esta rodada. |
| `VALIDACAO-BIOMETRIA.md` | Registra evidências, limitações, testes e inventário. |
| `package-lock.json` | Fixa as versões compatíveis das dependências adicionadas. |
| `backend/src/app.ts` | Integra armazenamento privado e parsers autorizados de tamanho limitado. |
| `backend/src/db/seed.ts` | Exemplos novos exigem DEMO_PIN explícito e preservam cartões existentes. |
| `backend/src/docs/swagger.ts` | Documenta coleta, hashes, desafio e confirmação antes da sessão. |
| `backend/src/middleware/sessao.ts` | Recusa sessões de cartões anteriores sem coleta/PIN. |
| `backend/src/repositories/coletas.repository.ts` | Guarda coletas cifradas, fatores, tentativas e uploads temporários. |
| `backend/src/routes/autenticacao.routes.ts` | Separa leitura do cartão da confirmação do segundo fator. |
| `backend/src/routes/emissao.routes.ts` | Protege upload, emissão com coleta e consulta de metadados. |
| `backend/src/schemas/coleta.ts` | Valida imagem, desenho, consentimento, PIN e confirmação. |
| `backend/src/services/coleta.service.ts` | Confere formato/limites, calcula hashes e gera SVG com números validados. |
| `backend/src/services/desafio.service.ts` | Mantém desafios temporários de uso único com limites de memória. |
| `backend/src/services/emissao.service.ts` | Vincula hashes à emissão preservando a assinatura RSA existente. |
| `backend/tests/autenticacao.test.ts` | Adapta regressões ao fluxo com segundo fator. |
| `backend/tests/ciclo-cartoes.test.ts` | Adapta revogação/persistência e emissão ao PIN. |
| `backend/tests/coleta-fatores.test.ts` | Acrescenta testes de coleta, segurança e falhas de gravação. |
| `backend/tests/helpers.ts` | Compartilha fixtures artificiais e login com confirmação. |
| `mobile/app.json` | Configura permissões, LocalAuthentication e SecureStore. |
| `mobile/package.json` | Declara LocalAuthentication, SecureStore e FileSystem compatíveis com SDK 54. |
| `mobile/src/components/AssinaturaManuscrita.tsx` | Implementa quadro de gestos, confirmação e limpeza. |
| `mobile/src/components/CapturaFoto.tsx` | Implementa câmera, prévia, limites e remoção do temporário. |
| `mobile/src/screens/EmissorScreen.tsx` | Integra consentimento, foto, assinatura, PIN e demonstração. |
| `mobile/src/screens/LoginScreen.tsx` | Acrescenta confirmação biométrica/PIN e recuperação de erros. |
| `mobile/src/services/api.service.ts` | Transporta upload, coleta, desafios e fatores com cancelamento. |
| `mobile/src/services/biometria.service.ts` | Consulta disponibilidade e protege credenciais com biometria nativa. |
| `mobile/src/services/biometria.service.web.ts` | Mantém alternativa por PIN no navegador. |
| `mobile/src/services/desenho-assinatura.ts` | Normaliza/limita pontos e identifica desenho válido. |
| `mobile/src/services/identidade.ts` | Acrescenta os contratos de coleta, desafio e confirmação. |
| `mobile/tests/App.test.tsx` | Adapta o fluxo completo ao PIN. |
| `mobile/tests/AssinaturaManuscrita.test.tsx` | Testa vazio, gestos, confirmação, limpeza e demonstração. |
| `mobile/tests/CapturaFoto.test.tsx` | Testa captura, prévia, permissão, limites e resposta tardia. |
| `mobile/tests/EmissorScreen.test.tsx` | Testa coleta, PIN, cancelamento e refazer foto. |
| `mobile/tests/LoginScreen.test.tsx` | Testa segundo fator, falhas, habilitação e cancelamento. |
| `mobile/tests/api.service.test.ts` | Testa os novos contratos e autorização. |
| `mobile/tests/biometria.service.test.ts` | Testa armazenamento protegido e indisponibilidade nativa. |
| `mobile/tests/biometria.web.test.ts` | Testa alternativa sem sensor no navegador. |
| `mobile/tests/helpers.ts` | Atualiza cartões e dados artificiais para os novos contratos. |

## O que este protótipo realmente comprova

Foto capturada e assinatura desenhada são guardadas com vínculo de integridade ao cartão. O cartão continua protegido contra adulteração por RSA. O servidor exige PIN ou credencial protegida pelo sistema biométrico do aparelho antes de criar sessão. Na demonstração, a foto artificial e a assinatura opcional de exemplo são identificadas como tais.

## O que ainda não comprova

Não há reconhecimento facial, prova de vida, verificação de autoria manuscrita, captura de digital com sensor dedicado nem vínculo comprovado entre a biometria do celular e o CPF. A API não recebe atestado do sensor: verifica uma credencial de aparelho. SecureStore não torna um cliente comprometido confiável. A proteção criptográfica do chip DESFire também não está integrada; NDEF continua copiável.

## Aceite físico pendente

1. Instalar JDK/SDK e reconstruir o Dev Client com as novas dependências.
2. Com voluntário informado, testar câmera, recusa de permissão, captura/refazer/confirmar e limpeza após sair.
3. Desenhar no celular, limpar, confirmar e tentar confirmar vazio, com rolagem e fontes ampliadas.
4. Entrar com PIN e habilitar biometria; sair e reentrar com o diálogo do sistema. Cancelar/recusar e confirmar que o PIN continua disponível.
5. Testar aparelho sem sensor/cadastro e credencial invalidada após mudança das biometrias; verificar reabilitação por PIN.
6. Bloquear/reemitir cartão e conferir recusa do PIN/credencial/sessão antigos. Testar NFC real com tag NDEF suficiente.
7. Registrar modelo do aparelho, versão do sistema, build e resultados, sem PIN, CPF, foto, cartão ou segredos nos registros.

O armazenamento atende uma instância local. A cifra usa chave no mesmo diretório privado, com limites descritos no README; não substitui política de retenção, ACLs, transações, gestão de chaves ou avaliação LGPD. A instalação ainda informa 21 vulnerabilidades (12 moderadas, 9 altas) na árvore preexistente. Não foi aplicada atualização forçada de versões principais.
