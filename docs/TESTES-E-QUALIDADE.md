# Testes, qualidade e critérios de validação

**FácilID / AcessoSênior — referência para desenvolvimento e demonstração.**

[Índice da documentação](README.md) · [Arquitetura](ARQUITETURA.md) · [API](API.md) · [Operação e manutenção](OPERACAO-E-MANUTENCAO.md)

## 1. Escopo e evidências

Os testes verificam regras de autenticação, contratos, persistência, interface e comportamentos de falha. Uma aprovação automatizada não comprova funcionamento de sensores físicos, segurança para produção, conformidade legal ou acessibilidade completa.

| Evidência | Resultado e alcance |
| --- | --- |
| Validação integrada do código-base em **2026-09-26**, commit `1a37bcfc0405eae475b5d2d7fe171431b6b57475` | **203 testes aprovados: 115 backend + 78 mobile + 10 integração SQL**; tipos e builds backend/web aprovados. Registro: [VALIDACAO-MYSQL.md](../VALIDACAO-MYSQL.md). É evidência histórica, anterior à documentação profissional. |
| Verificação focal desta rodada documental, após atualização do contrato Swagger | **26 testes de `backend/tests/autenticacao.test.ts` aprovados** e compilação do backend aprovada. Não equivale à repetição dos 203 testes. |
| Revisão documental em **2026-09-26** | **10 documentos, 193 links locais válidos e 10 caminhos OpenAPI**; contrato validado por Swagger Parser e conferido com a declaração compilada. Cinco diagramas Mermaid revisados como texto, sem validação por renderização. Registro local: `reports/documentation-validation.json`. |
| Hardware e acessibilidade assistiva | **Pendentes de execução manual** em ambiente identificado. Os cenários abaixo são critérios esperados, não resultados realizados. |

O ambiente SQL validado historicamente foi **MariaDB 10.4.32 do XAMPP em Windows**. Não se deve atribuir essa evidência a um servidor MySQL 8 testado separadamente. As contagens são fotografias da versão indicada e precisam ser atualizadas a partir de uma execução real quando o código mudar.

## 2. Camadas da estratégia de teste

| Camada | Ferramentas e isolamento | O que demonstra |
| --- | --- | --- |
| Tipagem | TypeScript com `tsc --noEmit` nos dois workspaces. | Consistência estática; não garante execução correta. |
| Backend | Jest, ts-jest, Supertest, diretórios temporários e dados fictícios. `createApp()` pode usar repositório JSON isolado ou persistência injetada. | Validações, autorização, RSA, coletas, fatores, sessão e falhas assíncronas. |
| Mobile | Jest Expo e React Native Testing Library; módulos de transporte/hardware simulados. | Fluxos de tela, contratos, cancelamento, estados e alternativas. Não mede sensores reais. |
| SQL real | mysql2 e servidor local; schemas temporários próprios. | Transações, locks, concorrência, reconexão, rollback e migração no motor de banco. |
| Compilação | TypeScript backend e exportação Expo para web. | Produção dos artefatos backend/web; não é build Android/iOS completa. |
| Conferência manual | Navegador/aparelho identificado, roteiro e resultado registrado. | Usabilidade, recursos nativos, permissões reais e interação assistiva. |

Configurações: [backend/jest.config.cjs](../backend/jest.config.cjs), [mobile/jest.config.cjs](../mobile/jest.config.cjs), [backend/tsconfig.json](../backend/tsconfig.json) e [mobile/tsconfig.json](../mobile/tsconfig.json). Não há comando de lint configurado nem percentual de cobertura que deva ser anunciado como meta já atingida.

## 3. Comandos de verificação

Execute na raiz do FácilID, depois da [instalação](INSTALACAO-E-CONFIGURACAO.md).

| Objetivo | Comando |
| --- | --- |
| Tipos de ambos os workspaces | `npm run typecheck` |
| Suítes comuns backend e mobile, sem XAMPP | `npm test` |
| Somente backend | `npm test -w backend` |
| Somente mobile | `npm test -w mobile` |
| Um arquivo backend | `npm test -w backend -- --runTestsByPath tests/autenticacao.test.ts` |
| Uma tela mobile | `npm test -w mobile -- --runTestsByPath tests/LoginScreen.test.tsx` |
| Integração SQL real | `npm run test:mysql` |
| Compilação backend + exportação web | `npm run build` |
| Ciclo comum: tipos, testes e build | `npm run check` |
| Ciclo com SQL real | `npm run check:mysql` |
| Repetir ciclo comum após alterações | `npm run check:watch` |
| Repetir ciclo incluindo SQL | `npm run check:watch -- --mysql` |
| Regenerar o contrato OpenAPI publicado nos documentos | `npm run docs:api` |

Os scripts efetivos estão em [package.json](../package.json), [backend/package.json](../backend/package.json) e [mobile/package.json](../mobile/package.json). Para uma alteração pequena, comece pela suíte diretamente envolvida. Amplie quando a mudança atingir contratos compartilhados, autenticação, persistência, dependências ou efeitos entre módulos.

## 4. Regras para testes SQL e dados privados

`npm run test:mysql` é optativo e usa arquivos com sufixo `.mysql.ts`; a suíte comum usa `.test.ts`. Antes de executar:

1. Inicie MySQL/MariaDB local pelo XAMPP.
2. Use uma conta local autorizada a criar e remover os schemas artificiais de teste.
3. Se necessário, forneça `DB_HOST`, `DB_PORT`, `DB_USER` e `DB_PASSWORD` no ambiente do terminal, sem registrar senha em scripts versionados ou logs.
4. Mantenha a origem em loopback. A suíte rejeita hosts externos.

A integração **não carrega `backend/.env` e não usa `DB_NAME`** para selecionar o banco da aplicação. Cria schemas `facilid_test_<processo>_<id>` e só remove aqueles criados pela própria execução, após conferir o nome. Também usa diretórios temporários para chaves, coletas e fontes de migração fictícias.

Nunca aponte testes destrutivos para `facilid`, use `backend/.local/` como massa ou copie documentos pessoais para fixtures. Se o processo for interrompido, confirme cuidadosamente quais recursos pertencem à execução antes de limpar sobras; não use exclusão por prefixo amplo.

Implementação e proteção da suíte: [backend/tests/mysql.integration.mysql.ts](../backend/tests/mysql.integration.mysql.ts). Detalhes de armazenamento: [Banco de dados](BANCO-DE-DADOS.md) e [Segurança e privacidade](SEGURANCA-E-PRIVACIDADE.md).

## 5. Mapa das suítes

### Backend

| Arquivo | Principais verificações |
| --- | --- |
| [backend/tests/autenticacao.test.ts](../backend/tests/autenticacao.test.ts) | Emissão → login → perfil; CPF/RSA adulterados; canonicalização; cadastro inválido; JWT; erros de parser; documentação pública; contrato com mobile; tamanho do JSON assinado. |
| [backend/tests/ciclo-cartoes.test.ts](../backend/tests/ciclo-cartoes.test.ts) | IDs de emissão; autorização administrativa; recuperação e bloqueio; revogação de sessão por segunda via; persistência; migração JSON legada; correlação de erro. |
| [backend/tests/coleta-fatores.test.ts](../backend/tests/coleta-fatores.test.ts) | Cifra de foto/desenho; integridade de imagens; consentimento; limites; desenho seguro; PIN; desafios; limite de tentativas; credencial de dispositivo; compensação de falhas. |
| [backend/tests/persistencia-assincrona.test.ts](../backend/tests/persistencia-assincrona.test.ts) | Operações aguardadas; falha ao salvar; reserva exclusiva; revogação e expiração durante esperas; banco indisponível sem confundir com credencial inválida; saúde. |
| [backend/tests/mysql-config.test.ts](../backend/tests/mysql-config.test.ts) | Configuração e identificadores; pool; encerramento; equivalência do SQL legível com o schema de código; prontidão e mensagens sanitizadas. |
| [backend/tests/mysql.integration.mysql.ts](../backend/tests/mysql.integration.mysql.ts) | Emissão/PIN/perfil reais no banco; reconexão; bloqueio; concorrência para CPF novo/existente; parametrização; rollback; migração idempotente; divergências; legado. |

### Mobile

| Arquivo | Principais verificações |
| --- | --- |
| [mobile/tests/App.test.tsx](../mobile/tests/App.test.tsx) | Separação cidadão/responsável, navegação, cartão preparado e resposta tardia. |
| [mobile/tests/LoginScreen.test.tsx](../mobile/tests/LoginScreen.test.tsx) | Três etapas; PIN; biometria/alternativa; cancelamento; cadastro seguro de credencial; resposta tardia sem acesso indevido. |
| [mobile/tests/EmissorScreen.test.tsx](../mobile/tests/EmissorScreen.test.tsx) | Consentimento, PIN confirmado, foto antes da emissão, demonstração e limpeza de capturas. |
| [mobile/tests/SucessoScreen.test.tsx](../mobile/tests/SucessoScreen.test.tsx) | Expiração, consulta, distinção entre 401 e falha de conexão, saída durante pedido. |
| [mobile/tests/api.service.test.ts](../mobile/tests/api.service.test.ts) | Validação prévia, AbortSignal, cabeçalhos separados e envio de fator ao servidor. |
| [mobile/tests/biometria.service.test.ts](../mobile/tests/biometria.service.test.ts), [mobile/tests/biometria.web.test.ts](../mobile/tests/biometria.web.test.ts) | Armazenamento protegido, autenticação do sistema, cancelamento, vínculo serviço/emissão e alternativa PIN no navegador. |
| [mobile/tests/nfc.service.test.ts](../mobile/tests/nfc.service.test.ts) | NDEF completo, capacidade e escrita, somente leitura, liberação e cancelamento; chamadas nativas simuladas. |
| [mobile/tests/LeitorQr.test.tsx](../mobile/tests/LeitorQr.test.tsx), [mobile/tests/CapturaFoto.test.tsx](../mobile/tests/CapturaFoto.test.tsx) | Permissões, alternativa, falha da câmera, leitura única, prévia, refazer e limpeza de temporários. |
| [mobile/tests/AssinaturaManuscrita.test.tsx](../mobile/tests/AssinaturaManuscrita.test.tsx) | Desenho útil, normalização, limites, limpar/confirmar e assinatura fictícia restrita à demonstração. |
| [mobile/tests/ControleAudio.test.tsx](../mobile/tests/ControleAudio.test.tsx), [mobile/tests/feedback.test.ts](../mobile/tests/feedback.test.ts) | Parada, inicialização e conclusão da fala, erro e instruções tardias. |

Fixtures compartilhadas: [backend/tests/helpers.ts](../backend/tests/helpers.ts) e [mobile/tests/helpers.ts](../mobile/tests/helpers.ts). Consulte-as antes de inventar outro formato de cartão ou um atalho que contorne a autenticação real do teste.

## 6. Como interpretar o ciclo de verificação

[scripts/verify.mjs](../scripts/verify.mjs) executa as etapas em sequência, salva logs e compara um hash das fontes antes e depois. Cada etapa tem limite de quatro minutos. O modo observador consulta alterações aproximadamente a cada 1,5 segundo após o ciclo.

| Campo/estado | Interpretação |
| --- | --- |
| `passed` | Todas as etapas previstas terminaram sem erro/timeout e as fontes monitoradas não mudaram no período. |
| `failed` | Pelo menos uma verificação falhou ou excedeu o tempo. Ler o log correspondente. |
| `stale` | Fontes monitoradas mudaram durante a execução. O resultado não representa uma única versão estável. |
| `interrupted` | O ciclo foi interrompido; não considerar aprovação. |
| `sourceHash`, `checkedAt`, `checks` | Identificação local das fontes, data e resultado por etapa; não substituem o commit e o ambiente no registro de entrega. |

Arquivos locais: `reports/latest.json`, `reports/cycle-*.json`, `reports/types.log`, `reports/tests.log`, `reports/mysql.log` quando solicitado e `reports/build.log`. Eles são ignorados pelo Git; preserve apenas evidências sanitizadas necessárias à entrega.

**Limite atual do observador:** o hash inclui `backend/`, `mobile/`, `scripts/`, configurações selecionadas e Markdown da raiz. **O diretório `docs/` não está incluído.** Editar somente seus documentos não dispara automaticamente novo ciclo nem altera esse hash. Para documentação, confira links, rótulos e exemplos diretamente; para OpenAPI, regenere o artefato pelo comando próprio e confira o resultado. Não use `sourceHash` como certificado de revisão de todos os documentos.

O observador **não modifica código nem corrige erros sozinho**. O ciclo de trabalho é: localizar a causa no log → corrigir a fonte → executar a verificação pertinente → repetir se houver falha nova. Ele também não é a automação de retomada do Codex; agendamento e disponibilidade de uso pertencem à ferramenta de desenvolvimento, não ao aplicativo FácilID.

## 7. Critérios para aceitar uma alteração

| Área alterada | Evidência mínima recomendada |
| --- | --- |
| Texto ou documentação | Rótulos e comandos conferidos no código; links locais válidos; sem segredos; distinguir atual de planejado. |
| Tela ou interação | Suíte da tela, transporte diretamente afetado e conferência manual do caminho alterado. |
| Contrato API | Testes da rota e cliente; atualizar schemas/tipos correspondentes, Swagger e `docs/openapi.json`. |
| Autenticação, criptografia ou sessão | Testes de sucesso, rejeição, expiração, cancelamento e revogação; releitura direta das regras sensíveis. |
| Persistência ou migração | Testes unitários pertinentes e SQL real isolado; rollback, concorrência, origem preservada e reexecução documentados. |
| Dependência nativa/configuração Expo | Compatibilidade oficial e build/ensaio no alvo; teste com mock não basta. |
| Mudança transversal | Tipos, suíte comum, SQL quando aplicável e build; registrar versão e limitações restantes. |

Uma regressão deve ser reproduzida de forma isolada antes de ser marcada como corrigida. Não enfraqueça validações, regenere chaves reais ou apague dados para tornar a suíte verde. Evite testes que apenas repitam a implementação; prefira comportamento observável e falhas relevantes.

## 8. Roteiro manual — execução ainda pendente

Em cada execução, registre data, commit, navegador ou modelo do aparelho, sistema, build instalado, versão do banco, cenário, resultado e evidência sem dados pessoais. Preencha **Aprovado**, **Falhou** ou **Não executado** somente depois do ensaio. O estado inicial de todos os itens abaixo é **Pendente**.

| ID | Cenário | Critério esperado | Estado |
| --- | --- | --- | --- |
| M01 | Demonstração web sem câmera/NFC | Emitir dado fictício, preparar cartão, confirmar PIN e consultar perfil. | Pendente |
| M02 | Cancelar leitura/verificação e trocar de tela | Nenhuma resposta atrasada libera acesso ou altera a tela abandonada. | Pendente |
| M03 | Recusar câmera no navegador/aparelho | Orientação compreensível e alternativa em texto/demonstração disponível. | Pendente |
| M04 | Foto voluntária em câmera real | Prévia, refazer e confirmar funcionam; somente a foto confirmada integra a emissão. | Pendente |
| M05 | Desenho com dedo/mouse | Traço acompanha o gesto; limpar exige nova confirmação; quadro vazio é recusado. | Pendente |
| M06 | NFC em Dev Client e tag NDEF compatível | Escrita e leitura preservam o cartão completo; cancelamento libera a operação. | Pendente |
| M07 | Tag pequena/somente leitura | Erro compreensível, sem truncar o cartão e sem impedir nova tentativa. | Pendente |
| M08 | Biometria real e armazenamento protegido | Primeiro cadastro requer PIN; uso posterior solicita confirmação do sistema; recusa oferece PIN. | Pendente |
| M09 | PIN incorreto, expiração e revogação | Falhas não concedem sessão; orientação permite recuperação; bloqueio/segunda via invalida consulta protegida. | Pendente |
| M10 | TalkBack/VoiceOver ou leitor de tela equivalente | Campos, botões, avisos e ordem de foco são compreensíveis; testar cada tela. | Pendente |
| M11 | Fonte ampliada e tela pequena | Conteúdo continua legível/rolável e botões essenciais permanecem acessíveis. | Pendente |
| M12 | Voz e parada de áudio | Instruções audíveis no idioma disponível; parada imediata; áudio antigo não reaparece após navegação. | Pendente |
| M13 | Uso com teclado no navegador | Navegação e foco visível permitem executar fluxos essenciais; registrar barreiras do quadro de desenho. | Pendente |
| M14 | API/banco indisponível em ambiente de ensaio | Mensagem de infraestrutura sem segredos; não afirmar que PIN/sessão foram revogados por falha de conexão. | Pendente |

Use o [Manual do usuário](MANUAL-DO-USUARIO.md) como roteiro funcional. Instalação nativa e requisitos de conexão estão em [Instalação e configuração](INSTALACAO-E-CONFIGURACAO.md). Não ensaie interrupção de banco ou recuperação com os dados de uma apresentação em andamento.

## 9. Limitações e prioridades de qualidade

- **Sensores e plataforma:** mocks e exportação web não validam NFC, câmera, biometria, voz ou resposta tátil física. A build Android completa e os ensaios de aparelho permanecem sem evidência consolidada nesta documentação.
- **Acessibilidade:** há mecanismos implementados e testes de componentes; ainda são necessários ensaios assistivos e com usuários do público-alvo. O desenho manual é uma barreira potencial no modo de coleta real.
- **Dependências:** avisos transitivos de `npm audit` requerem triagem específica e compatibilidade com Expo. Não aplicar `npm audit fix --force` como correção automática nem anunciar ausência de vulnerabilidades sem auditoria atual.
- **Interface:** existe aviso de depreciação de `SafeAreaView` em `mobile/App.tsx`; trata-se de manutenção a avaliar, não resultado de uma falha funcional demonstrada.
- **Operação:** uma instância de backend; arquivos privados e banco não compartilham transação distribuída. Testes de compensação não garantem recuperação automática após qualquer queda abrupta. Consulte [Operação e manutenção](OPERACAO-E-MANUTENCAO.md).
- **Segurança do produto:** não há reconhecimento facial, prova de vida, comprovação da autoria do desenho ou autenticação criptográfica do chip NFC. Os testes não devem sugerir essas garantias.

## 10. Como registrar uma nova validação

Atualize o registro com: commit/alterações locais, data, comandos executados, ambiente, quantidade real de testes, resultado por etapa e limitações. Inclua o teste de regressão que sustenta cada correção. Separe evidências automáticas de conferências manuais e use **não executado** quando não houver ensaio.

Preserve [VALIDACAO-MYSQL.md](../VALIDACAO-MYSQL.md), [VALIDACAO-BIOMETRIA.md](../VALIDACAO-BIOMETRIA.md) e [VALIDACAO.md](../VALIDACAO.md) como histórico das etapas; uma execução antiga não valida mudanças posteriores. Atualize [PROJECT_CACHE.md](../PROJECT_CACHE.md) quando o estado ou os comandos do projeto mudarem.
