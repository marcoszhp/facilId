# Entrega — Propósito pós-login e usabilidade

Concluída em **3 de outubro de 2026**, sobre a base `e9aacb9`. Os sete itens solicitados foram implementados, sem novas dependências. **372 testes aprovados: 191 backend +160 mobile +21 SQL**, além de tipos e builds backend/web. A base tinha 203 testes; a rodada acrescentou 169 cenários.

O banco local `facilid` recebeu as tabelas de atendimentos e eventos com a API parada. As tabelas anteriores e arquivos privados permaneceram iguais na verificação; a migração não foi repetida. A validação usou MariaDB 10.4.32/XAMPP e dados artificiais isolados. Sensores reais, build Android completa e ensaios com idosos continuam sem nova evidência.

## Arquivos e diffs por item

Cada link de comparação contém o diff completo de todos os arquivos daquela etapa, incluindo arquivos novos. O item3 agrega os commits de contrato, implementação e documentação. Os registros em `reports/` são evidências locais ignoradas pelo Git; as contagens públicas estão em [VALIDACAO-MYSQL.md](../VALIDACAO-MYSQL.md).

### 1. Confirmações

[Diff completo do item 1](https://github.com/marcoszhp/facilId/compare/e9aacb9826487ddde6a65934afc5e7dadf0833f0...6c8da2d6970f45a94726e342e380448ed68272fd) · Ciclo aprovado: **210 testes**, tipos e builds.

| Arquivo alterado/criado | Resumo |
| --- | --- |
| [PROJECT_CACHE.md](../PROJECT_CACHE.md) | Índice técnico, decisões, contratos, estado e evidências para retomada. |
| [mobile/src/screens/EmissorScreen.tsx](../mobile/src/screens/EmissorScreen.tsx) | Confirmações, formulário em etapas, busca/filtros e seções administrativas. |
| [mobile/tests/App.test.tsx](../mobile/tests/App.test.tsx) | Testes de App: novos cenários ou adaptação de regressões aos contratos preservados. |
| [mobile/tests/EmissorScreen.test.tsx](../mobile/tests/EmissorScreen.test.tsx) | Testes de Emissor Screen: novos cenários ou adaptação de regressões aos contratos preservados. |

### 2. Conexão na área responsável

[Diff completo do item 2](https://github.com/marcoszhp/facilId/compare/6c8da2d6970f45a94726e342e380448ed68272fd...4a437d2e7f37518e829336eee3f88f13cce1b659) · Ciclo aprovado: **218 testes**, tipos e builds.

| Arquivo alterado/criado | Resumo |
| --- | --- |
| [PROJECT_CACHE.md](../PROJECT_CACHE.md) | Índice técnico, decisões, contratos, estado e evidências para retomada. |
| [VALIDACAO-MYSQL.md](../VALIDACAO-MYSQL.md) | Evidências dos ciclos completos e preparo local sem perda de dados. |
| [mobile/App.tsx](../mobile/App.tsx) | Separa cidadão e conexão técnica; confirma mudanças de URL e inclui diagnóstico. |
| [mobile/tests/Conexao.test.tsx](../mobile/tests/Conexao.test.tsx) | Testes de Conexao: novos cenários ou adaptação de regressões aos contratos preservados. |

### 3. Atendimento simulado

[Diff completo do item 3](https://github.com/marcoszhp/facilId/compare/4a437d2e7f37518e829336eee3f88f13cce1b659...4ba22d2e4bff6551607ca5b60e807a21fd8c7e2b) · Ciclo aprovado: **265 testes**, tipos e builds.

| Arquivo alterado/criado | Resumo |
| --- | --- |
| [PROJECT_CACHE.md](../PROJECT_CACHE.md) | Índice técnico, decisões, contratos, estado e evidências para retomada. |
| [README.md](../README.md) | Guia inicial e procedimentos de instalação/demonstração atualizados. |
| [VALIDACAO-MYSQL.md](../VALIDACAO-MYSQL.md) | Evidências dos ciclos completos e preparo local sem perda de dados. |
| [backend/src/app.ts](../backend/src/app.ts) | Composição dos repositórios/rotas e diagnóstico público da persistência. |
| [backend/src/db/mysql.ts](../backend/src/db/mysql.ts) | Tabelas aditivas, conexão e verificação das colunas necessárias. |
| [backend/src/db/persistencia.ts](../backend/src/db/persistencia.ts) | Seleciona e fornece os adaptadores JSON/MySQL de cartões e atendimentos. |
| [backend/src/db/schema-mysql.sql](../backend/src/db/schema-mysql.sql) | Espelho legível do schema com atendimentos e eventos. |
| [backend/src/docs/swagger.ts](../backend/src/docs/swagger.ts) | Declara contratos, segurança, respostas e schemas OpenAPI das novas operações. |
| [backend/src/repositories/atendimentos.repository.ts](../backend/src/repositories/atendimentos.repository.ts) | Contrato de reservas e persistência JSON atômica da simulação. |
| [backend/src/repositories/mysql-atendimentos.repository.ts](../backend/src/repositories/mysql-atendimentos.repository.ts) | Reservas exclusivas e transições de status transacionais no MySQL. |
| [backend/src/routes/atendimentos.routes.ts](../backend/src/routes/atendimentos.routes.ts) | Rotas de agendamento, consulta por sessão e gestão administrativa. |
| [backend/src/schemas/atendimento.ts](../backend/src/schemas/atendimento.ts) | Validação e tipos dos horários, reservas e estados de atendimento. |
| [backend/src/server.ts](../backend/src/server.ts) | Injeção dos repositórios e do tipo real de armazenamento no servidor. |
| [backend/src/services/atendimento.service.ts](../backend/src/services/atendimento.service.ts) | Grade de horários de Brasília, protocolo e regras de mudança de status. |
| [backend/tests/atendimentos.test.ts](../backend/tests/atendimentos.test.ts) | Testes de atendimentos: novos cenários ou adaptação de regressões aos contratos preservados. |
| [backend/tests/mysql-config.test.ts](../backend/tests/mysql-config.test.ts) | Testes de mysql-config: novos cenários ou adaptação de regressões aos contratos preservados. |
| [backend/tests/mysql.integration.mysql.ts](../backend/tests/mysql.integration.mysql.ts) | Testes de mysql: novos cenários ou adaptação de regressões aos contratos preservados. |
| [docs/API.md](../docs/API.md) | Contratos humanos das rotas, autenticação, formatos e limitações. |
| [docs/ARQUITETURA.md](../docs/ARQUITETURA.md) | Fluxos, dependências e decisões de persistência/interface. |
| [docs/BANCO-DE-DADOS.md](../docs/BANCO-DE-DADOS.md) | Dicionário de tabelas, relações, transações e migração. |
| [docs/INSTALACAO-E-CONFIGURACAO.md](../docs/INSTALACAO-E-CONFIGURACAO.md) | Atualização aditiva da instalação e conferência da conexão. |
| [docs/MANUAL-DO-USUARIO.md](../docs/MANUAL-DO-USUARIO.md) | Passos de uso para cidadão e responsável, recuperação e limitações. |
| [docs/README.md](../docs/README.md) | Guia inicial e procedimentos de instalação/demonstração atualizados. |
| [docs/TESTES-E-QUALIDADE.md](../docs/TESTES-E-QUALIDADE.md) | Cobertura e resultados automáticos, separados dos ensaios físicos pendentes. |
| [docs/VISAO-GERAL.md](../docs/VISAO-GERAL.md) | Escopo funcional entregue e evoluções que continuam opcionais. |
| [docs/openapi.json](../docs/openapi.json) | Contrato público exportado e validado a partir do Swagger. |
| [mobile/src/components/AtendimentosAdmin.tsx](../mobile/src/components/AtendimentosAdmin.tsx) | Consulta reservas e permite confirmar/concluir o atendimento. |
| [mobile/src/components/AtendimentosCidadao.tsx](../mobile/src/components/AtendimentosCidadao.tsx) | Escolhe horário, recebe protocolo e consulta os próprios agendamentos. |
| [mobile/src/screens/EmissorScreen.tsx](../mobile/src/screens/EmissorScreen.tsx) | Confirmações, formulário em etapas, busca/filtros e seções administrativas. |
| [mobile/src/screens/SucessoScreen.tsx](../mobile/src/screens/SucessoScreen.tsx) | Disponibiliza agendamento e acompanhamento após autenticação. |
| [mobile/src/services/api.service.ts](../mobile/src/services/api.service.ts) | Transportes tipados de atendimentos, diagnóstico e eventos com AbortSignal. |
| [mobile/src/services/formatacao-atendimento.ts](../mobile/src/services/formatacao-atendimento.ts) | Formata horários em Brasília e nomes dos estados. |
| [mobile/src/services/identidade.ts](../mobile/src/services/identidade.ts) | Tipos compartilhados pelo cliente, incluindo atendimentos e eventos. |
| [mobile/tests/Atendimentos.test.tsx](../mobile/tests/Atendimentos.test.tsx) | Testes de Atendimentos: novos cenários ou adaptação de regressões aos contratos preservados. |
| [mobile/tests/EmissorScreen.test.tsx](../mobile/tests/EmissorScreen.test.tsx) | Testes de Emissor Screen: novos cenários ou adaptação de regressões aos contratos preservados. |
| [mobile/tests/SucessoScreen.test.tsx](../mobile/tests/SucessoScreen.test.tsx) | Testes de Sucesso Screen: novos cenários ou adaptação de regressões aos contratos preservados. |
| [mobile/tests/api.service.test.ts](../mobile/tests/api.service.test.ts) | Testes de api.service: novos cenários ou adaptação de regressões aos contratos preservados. |

### 4. Emissão em etapas

[Diff completo do item 4](https://github.com/marcoszhp/facilId/compare/4ba22d2e4bff6551607ca5b60e807a21fd8c7e2b...a2d4c73f024de3e68353ed923cbbda645acab199) · Ciclo aprovado: **273 testes**, tipos e builds.

| Arquivo alterado/criado | Resumo |
| --- | --- |
| [PROJECT_CACHE.md](../PROJECT_CACHE.md) | Índice técnico, decisões, contratos, estado e evidências para retomada. |
| [VALIDACAO-MYSQL.md](../VALIDACAO-MYSQL.md) | Evidências dos ciclos completos e preparo local sem perda de dados. |
| [docs/ARQUITETURA.md](../docs/ARQUITETURA.md) | Fluxos, dependências e decisões de persistência/interface. |
| [docs/MANUAL-DO-USUARIO.md](../docs/MANUAL-DO-USUARIO.md) | Passos de uso para cidadão e responsável, recuperação e limitações. |
| [docs/TESTES-E-QUALIDADE.md](../docs/TESTES-E-QUALIDADE.md) | Cobertura e resultados automáticos, separados dos ensaios físicos pendentes. |
| [mobile/src/screens/EmissorScreen.tsx](../mobile/src/screens/EmissorScreen.tsx) | Confirmações, formulário em etapas, busca/filtros e seções administrativas. |
| [mobile/tests/App.test.tsx](../mobile/tests/App.test.tsx) | Testes de App: novos cenários ou adaptação de regressões aos contratos preservados. |
| [mobile/tests/EmissaoEtapas.test.tsx](../mobile/tests/EmissaoEtapas.test.tsx) | Testes de Emissao Etapas: novos cenários ou adaptação de regressões aos contratos preservados. |
| [mobile/tests/EmissorScreen.test.tsx](../mobile/tests/EmissorScreen.test.tsx) | Testes de Emissor Screen: novos cenários ou adaptação de regressões aos contratos preservados. |

### 5. Busca e filtros

[Diff completo do item 5](https://github.com/marcoszhp/facilId/compare/a2d4c73f024de3e68353ed923cbbda645acab199...9dd80ef4e5f816511a3041518f1822505d25b0e1) · Ciclo aprovado: **319 testes**, tipos e builds.

| Arquivo alterado/criado | Resumo |
| --- | --- |
| [PROJECT_CACHE.md](../PROJECT_CACHE.md) | Índice técnico, decisões, contratos, estado e evidências para retomada. |
| [VALIDACAO-MYSQL.md](../VALIDACAO-MYSQL.md) | Evidências dos ciclos completos e preparo local sem perda de dados. |
| [backend/src/docs/swagger.ts](../backend/src/docs/swagger.ts) | Declara contratos, segurança, respostas e schemas OpenAPI das novas operações. |
| [backend/src/routes/emissao.routes.ts](../backend/src/routes/emissao.routes.ts) | Listagem paginada opcional de cartões e consulta protegida dos eventos. |
| [backend/tests/usuarios-paginacao.test.ts](../backend/tests/usuarios-paginacao.test.ts) | Testes de usuarios-paginacao: novos cenários ou adaptação de regressões aos contratos preservados. |
| [docs/API.md](../docs/API.md) | Contratos humanos das rotas, autenticação, formatos e limitações. |
| [docs/MANUAL-DO-USUARIO.md](../docs/MANUAL-DO-USUARIO.md) | Passos de uso para cidadão e responsável, recuperação e limitações. |
| [docs/openapi.json](../docs/openapi.json) | Contrato público exportado e validado a partir do Swagger. |
| [mobile/src/screens/EmissorScreen.tsx](../mobile/src/screens/EmissorScreen.tsx) | Confirmações, formulário em etapas, busca/filtros e seções administrativas. |
| [mobile/src/services/filtro-cartoes.ts](../mobile/src/services/filtro-cartoes.ts) | Combina nome/CPF normalizado com estado do cartão. |
| [mobile/tests/FiltroCartoes.test.tsx](../mobile/tests/FiltroCartoes.test.tsx) | Testes de Filtro Cartoes: novos cenários ou adaptação de regressões aos contratos preservados. |

### 6. Diagnóstico da conexão

[Diff completo do item 6](https://github.com/marcoszhp/facilId/compare/9dd80ef4e5f816511a3041518f1822505d25b0e1...450b1fafca58fa1d4adf28219704fda8f0fb5056) · Ciclo aprovado: **332 testes**, tipos e builds.

| Arquivo alterado/criado | Resumo |
| --- | --- |
| [PROJECT_CACHE.md](../PROJECT_CACHE.md) | Índice técnico, decisões, contratos, estado e evidências para retomada. |
| [VALIDACAO-MYSQL.md](../VALIDACAO-MYSQL.md) | Evidências dos ciclos completos e preparo local sem perda de dados. |
| [backend/src/app.ts](../backend/src/app.ts) | Composição dos repositórios/rotas e diagnóstico público da persistência. |
| [backend/src/docs/swagger.ts](../backend/src/docs/swagger.ts) | Declara contratos, segurança, respostas e schemas OpenAPI das novas operações. |
| [backend/src/server.ts](../backend/src/server.ts) | Injeção dos repositórios e do tipo real de armazenamento no servidor. |
| [backend/tests/persistencia-assincrona.test.ts](../backend/tests/persistencia-assincrona.test.ts) | Testes de persistencia-assincrona: novos cenários ou adaptação de regressões aos contratos preservados. |
| [docs/API.md](../docs/API.md) | Contratos humanos das rotas, autenticação, formatos e limitações. |
| [docs/INSTALACAO-E-CONFIGURACAO.md](../docs/INSTALACAO-E-CONFIGURACAO.md) | Atualização aditiva da instalação e conferência da conexão. |
| [docs/MANUAL-DO-USUARIO.md](../docs/MANUAL-DO-USUARIO.md) | Passos de uso para cidadão e responsável, recuperação e limitações. |
| [docs/OPERACAO-E-MANUTENCAO.md](../docs/OPERACAO-E-MANUTENCAO.md) | Diagnóstico, backup de todas as tabelas e preservação do ambiente. |
| [docs/TESTES-E-QUALIDADE.md](../docs/TESTES-E-QUALIDADE.md) | Cobertura e resultados automáticos, separados dos ensaios físicos pendentes. |
| [docs/openapi.json](../docs/openapi.json) | Contrato público exportado e validado a partir do Swagger. |
| [mobile/App.tsx](../mobile/App.tsx) | Separa cidadão e conexão técnica; confirma mudanças de URL e inclui diagnóstico. |
| [mobile/src/components/DiagnosticoConexao.tsx](../mobile/src/components/DiagnosticoConexao.tsx) | Mostra situação da API e banco sem credenciais ou erros privados. |
| [mobile/src/services/api.service.ts](../mobile/src/services/api.service.ts) | Transportes tipados de atendimentos, diagnóstico e eventos com AbortSignal. |
| [mobile/src/services/diagnostico.service.ts](../mobile/src/services/diagnostico.service.ts) | Valida resposta de saúde e distingue rede, banco e modo JSON. |
| [mobile/tests/App.test.tsx](../mobile/tests/App.test.tsx) | Testes de App: novos cenários ou adaptação de regressões aos contratos preservados. |
| [mobile/tests/DiagnosticoConexao.test.tsx](../mobile/tests/DiagnosticoConexao.test.tsx) | Testes de Diagnostico Conexao: novos cenários ou adaptação de regressões aos contratos preservados. |

### 7. Histórico administrativo

[Diff completo do item 7](https://github.com/marcoszhp/facilId/compare/450b1fafca58fa1d4adf28219704fda8f0fb5056...fac58e244e17b0b29d2bb42b660b1af4ea725b2d) · Ciclo aprovado: **372 testes**, tipos e builds.

| Arquivo alterado/criado | Resumo |
| --- | --- |
| [PROJECT_CACHE.md](../PROJECT_CACHE.md) | Índice técnico, decisões, contratos, estado e evidências para retomada. |
| [README.md](../README.md) | Guia inicial e procedimentos de instalação/demonstração atualizados. |
| [VALIDACAO-MYSQL.md](../VALIDACAO-MYSQL.md) | Evidências dos ciclos completos e preparo local sem perda de dados. |
| [backend/src/db/migrar-json.ts](../backend/src/db/migrar-json.ts) | Importa eventos e cartões juntos, preservando histórico e recusando divergências. |
| [backend/src/db/mysql.ts](../backend/src/db/mysql.ts) | Tabelas aditivas, conexão e verificação das colunas necessárias. |
| [backend/src/db/schema-mysql.sql](../backend/src/db/schema-mysql.sql) | Espelho legível do schema com atendimentos e eventos. |
| [backend/src/docs/swagger.ts](../backend/src/docs/swagger.ts) | Declara contratos, segurança, respostas e schemas OpenAPI das novas operações. |
| [backend/src/repositories/mysql-usuarios.repository.ts](../backend/src/repositories/mysql-usuarios.repository.ts) | Grava eventos nas mesmas transações de emissão/bloqueio e consulta histórico. |
| [backend/src/repositories/usuarios.repository.ts](../backend/src/repositories/usuarios.repository.ts) | Persiste cartões e eventos juntos no JSON, compatível com arquivos anteriores. |
| [backend/src/routes/emissao.routes.ts](../backend/src/routes/emissao.routes.ts) | Listagem paginada opcional de cartões e consulta protegida dos eventos. |
| [backend/src/schemas/evento.ts](../backend/src/schemas/evento.ts) | Schema dos eventos e produção de motivos controlados, sem operador individual. |
| [backend/tests/ciclo-cartoes.test.ts](../backend/tests/ciclo-cartoes.test.ts) | Testes de ciclo-cartoes: novos cenários ou adaptação de regressões aos contratos preservados. |
| [backend/tests/eventos.test.ts](../backend/tests/eventos.test.ts) | Testes de eventos: novos cenários ou adaptação de regressões aos contratos preservados. |
| [backend/tests/mysql-config.test.ts](../backend/tests/mysql-config.test.ts) | Testes de mysql-config: novos cenários ou adaptação de regressões aos contratos preservados. |
| [backend/tests/mysql.integration.mysql.ts](../backend/tests/mysql.integration.mysql.ts) | Testes de mysql: novos cenários ou adaptação de regressões aos contratos preservados. |
| [backend/tests/persistencia-assincrona.test.ts](../backend/tests/persistencia-assincrona.test.ts) | Testes de persistencia-assincrona: novos cenários ou adaptação de regressões aos contratos preservados. |
| [backend/tests/usuarios-paginacao.test.ts](../backend/tests/usuarios-paginacao.test.ts) | Testes de usuarios-paginacao: novos cenários ou adaptação de regressões aos contratos preservados. |
| [docs/API.md](../docs/API.md) | Contratos humanos das rotas, autenticação, formatos e limitações. |
| [docs/ARQUITETURA.md](../docs/ARQUITETURA.md) | Fluxos, dependências e decisões de persistência/interface. |
| [docs/BANCO-DE-DADOS.md](../docs/BANCO-DE-DADOS.md) | Dicionário de tabelas, relações, transações e migração. |
| [docs/INSTALACAO-E-CONFIGURACAO.md](../docs/INSTALACAO-E-CONFIGURACAO.md) | Atualização aditiva da instalação e conferência da conexão. |
| [docs/MANUAL-DO-USUARIO.md](../docs/MANUAL-DO-USUARIO.md) | Passos de uso para cidadão e responsável, recuperação e limitações. |
| [docs/OPERACAO-E-MANUTENCAO.md](../docs/OPERACAO-E-MANUTENCAO.md) | Diagnóstico, backup de todas as tabelas e preservação do ambiente. |
| [docs/README.md](../docs/README.md) | Guia inicial e procedimentos de instalação/demonstração atualizados. |
| [docs/SEGURANCA-E-PRIVACIDADE.md](../docs/SEGURANCA-E-PRIVACIDADE.md) | Dados guardados e limites do histórico com chave compartilhada. |
| [docs/TESTES-E-QUALIDADE.md](../docs/TESTES-E-QUALIDADE.md) | Cobertura e resultados automáticos, separados dos ensaios físicos pendentes. |
| [docs/VISAO-GERAL.md](../docs/VISAO-GERAL.md) | Escopo funcional entregue e evoluções que continuam opcionais. |
| [docs/openapi.json](../docs/openapi.json) | Contrato público exportado e validado a partir do Swagger. |
| [mobile/src/components/EventosAdmin.tsx](../mobile/src/components/EventosAdmin.tsx) | Exibe histórico cronológico, CPF mascarado, data e motivo; consulta cancelável. |
| [mobile/src/screens/EmissorScreen.tsx](../mobile/src/screens/EmissorScreen.tsx) | Confirmações, formulário em etapas, busca/filtros e seções administrativas. |
| [mobile/src/services/api.service.ts](../mobile/src/services/api.service.ts) | Transportes tipados de atendimentos, diagnóstico e eventos com AbortSignal. |
| [mobile/src/services/identidade.ts](../mobile/src/services/identidade.ts) | Tipos compartilhados pelo cliente, incluindo atendimentos e eventos. |
| [mobile/tests/EmissorScreen.test.tsx](../mobile/tests/EmissorScreen.test.tsx) | Testes de Emissor Screen: novos cenários ou adaptação de regressões aos contratos preservados. |
| [mobile/tests/EventosAdmin.test.tsx](../mobile/tests/EventosAdmin.test.tsx) | Testes de Eventos Admin: novos cenários ou adaptação de regressões aos contratos preservados. |
| [mobile/tests/api.service.test.ts](../mobile/tests/api.service.test.ts) | Testes de api.service: novos cenários ou adaptação de regressões aos contratos preservados. |

## Testes novos e o que comprovam

| Item | Arquivos | Cobertura nova |
| --- | --- | --- |
|1|[EmissorScreen.test.tsx](../mobile/tests/EmissorScreen.test.tsx)|7 casos: cancelar sem upload/escrita, confirmar uma vez, bloquear/segunda via e saída.|
|2|[Conexao.test.tsx](../mobile/tests/Conexao.test.tsx)|8 casos: ajustes fora do cidadão, rascunho preservado e aplicação somente após confirmação.|
|3|[atendimentos.test.ts](../backend/tests/atendimentos.test.ts), [SQL](../backend/tests/mysql.integration.mysql.ts), [Atendimentos.test.tsx](../mobile/tests/Atendimentos.test.tsx), testes das telas e transporte|47 casos: grade, protocolo, isolamento por CPF, transições, disputa real pelo horário, reconexão, falhas e consulta após novo login.|
|4|[EmissaoEtapas.test.tsx](../mobile/tests/EmissaoEtapas.test.tsx)|8 casos: erros próximos, navegação/rascunho, revisão sem PIN exposto, falhas e saída da câmera.|
|5|[usuarios-paginacao.test.ts](../backend/tests/usuarios-paginacao.test.ts), [FiltroCartoes.test.tsx](../mobile/tests/FiltroCartoes.test.tsx)|46 casos: busca normalizada e estado combinados, ausência de resultados, confirmação preservada, paginação estrita e autorização.|
|6|[persistencia-assincrona.test.ts](../backend/tests/persistencia-assincrona.test.ts), [DiagnosticoConexao.test.tsx](../mobile/tests/DiagnosticoConexao.test.tsx), [App.test.tsx](../mobile/tests/App.test.tsx)|13 casos: API versus banco, JSON, timeout, respostas incompatíveis, cancelamento e acesso responsável sem credencial.|
|7|[eventos.test.ts](../backend/tests/eventos.test.ts), [SQL](../backend/tests/mysql.integration.mysql.ts), [EventosAdmin.test.tsx](../mobile/tests/EventosAdmin.test.tsx), EmissorScreen e transporte|40 casos: 17 backend,17 mobile,6 SQL; atomicidade de evento/cartão, idempotência, datas, migração, ordenação, autorização, consultas tardias e limpeza ao sair. Concorrência/migração anteriores também foram ampliadas.|

A primeira execução do item7 falhou em duas simulações de erro de arquivo no próprio teste. Corrigida a importação de fs, o ciclo completo passou. Não há falha conhecida reproduzida nesta rodada; aviso SafeAreaView e triagem de dependências continuam como manutenção futura.

## Checklist de aceite

- [x] **1 — Confirmação:** emissão/segunda via e bloqueio exigem confirmar; cancelar não chama escrita.
- [x] **2 — Conexão:** somente responsável; editar/salvar preserva preparo, mudança efetiva exige confirmação.
- [x] **3 — Atendimento:** agenda, recebe protocolo e reencontra reserva/situação; SQL impede disputa pelo mesmo horário e sessão restringe CPF.
- [x] **4 — Etapas:** Dados, Foto e assinatura, PIN e revisão; voltar preserva dados/desenho e erros aparecem junto aos campos.
- [x] **5 — Busca/filtros:** nome/CPF e estado funcionam separados e combinados; API mantém compatibilidade com paginação opcional.
- [x] **6 — Diagnóstico:** distingue API acessível e banco indisponível; se a API não responde, informa honestamente banco não verificado.
- [x] **7 — Histórico:** emissão/bloqueio/substituição com data e motivo, ordem cronológica e sem operador individual inventado.

## Decisões e limites

Motivos do histórico são textos fixos conforme a operação; não há justificativa livre nesta rodada. Não se inventa histórico para cartões antigos. JSON e MySQL preservam eventos de forma atômica com os cartões; o importador também os preserva. Consulta do histórico é manual ao abrir/atualizar. Contas administrativas individuais e auditoria completa continuam futuras.

O modo simulado segue disponível sem hardware obrigatório. Os avisos sobre foto, desenho e biometria foram preservados. Não foram implementados reconhecimento facial, chatbot, serviços públicos reais ou sincronização offline. Testes automatizados não equivalem a validação física dos sensores.

## Documentação desta entrega

| Arquivo | Alteração |
| --- | --- |
| [ENTREGA-POSLOGIN.md](ENTREGA-POSLOGIN.md) | Lista de arquivos, diffs completos agrupados, testes novos e aceite dos sete itens. |
| [README da documentação](README.md) | Link para esta entrega. |
| [PROJECT_CACHE.md](../PROJECT_CACHE.md) | Localização dos contratos atuais e encerramento das pendências autorizadas. |
