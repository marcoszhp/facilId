# Validação — integração com MySQL do XAMPP

## Evolução concluída — propósito pós-login e usabilidade (2026-09-26)

Os resultados abaixo são posteriores à integração descrita no restante deste documento. O pedido tem sete itens; todos estão concluídos em 03/10/2026. Cada ciclo executou tipos, testes backend/mobile/SQL e builds backend/web, com dados de teste isolados.

| Marco | Resultado | Evidência local |
| --- | --- | --- |
| Antes das alterações | 203 testes: 115 backend +78 mobile +10 SQL | `reports/poslogin-baseline.json` |
| Item 1: confirmação de emissão/segunda via e bloqueio antes de qualquer upload/escrita | 210 testes: 115+85+10; sete novos casos de cancelamento, confirmação única e saída | `reports/poslogin-item1.json` / `.log` |
| Item 2: ajustes só na área do responsável, rascunho e confirmação explícita da mudança | 218 testes: 115+93+10; oito novos casos em `mobile/tests/Conexao.test.tsx` | `reports/poslogin-item2.json` / `.log` |
| Item 3: agendamento simulado, protocolo, isolamento por cidadão e gestão de status | 265 testes: 131 backend +119 mobile +15 SQL; tipos e builds aprovados em 27/09/2026 | `reports/poslogin-item3.json` / `.log` / `.patch` |
| Item 4: emissão em três etapas, preservação dos dados e erros próximos aos campos | 273 testes: 131 backend +127 mobile +15 SQL; oito novos cenários em `mobile/tests/EmissaoEtapas.test.tsx` | `reports/poslogin-item4.json` / `.log` |
| Item 5: busca/filtros combinados e paginação optativa compatível | 319 testes: 172 backend +132 mobile +15 SQL; tipos/build aprovados | `reports/poslogin-item5.json` / `.log` |
| Item 6: diagnóstico público API/persistência na área responsável | 332 testes: 174 backend +143 mobile +15 SQL; tipos/build aprovados em 28/09/2026; 13 novos casos | `reports/poslogin-item6.json` / `.log` |
| Item 7: histórico administrativo e migração de eventos | 372 testes: 191 backend +160 mobile +21 SQL; tipos/build aprovados em 03/10/2026 | `reports/poslogin-item 7.json` / `.log` |

**Sete itens concluídos.** A primeira rodada do item 7 encontrou duas falhas na simulação de renameSync dos testes; a importação do módulo fs no teste foi corrigida. A rodada seguinte passou integralmente, sem alteração de fontes durante o ciclo (hash `a17cd12342f54ee52711e079296f5b9be4fb7a0994c6a61ffd3b4a229d67137e`). Novos testes do item 7: 17 backend, 17 mobile e 6 SQL; a concorrência e a migração existentes também passaram a verificar os eventos. Revisão dirigida de atomicidade/migração não identificou defeito acionável.

Em 03/10, com a API parada, o preparo local acrescentou `facilid_atendimentos` e `facilid_eventos` ao banco `facilid`. Checksums/contagens das tabelas anteriores e a impressão dos arquivos privados permaneceram iguais; nenhuma importação foi repetida e nenhuma chave foi regenerada. Evidência sem segredos: `reports/poslogin-local-setup.json`.

Histórico anterior: A primeira tentativa SQL encontrou o XAMPP desligado; após iniciá-lo, os 15 testes SQL e o ciclo integrado passaram. Naquele marco, a instalação principal ainda precisava do preparo aditivo, concluído em 03/10 conforme registro acima. Nenhum teste físico adicional foi realizado. Os avisos existentes sobre foto, assinatura e biometria foram preservados.

## Integração original

O FácilID passou a usar o banco `facilid` do XAMPP por padrão. O usuário escolheu a criação desse banco local. O adaptador JSON continua disponível explicitamente para testes e demonstração sem banco. A etapa anterior está registrada em [VALIDACAO-BIOMETRIA.md](VALIDACAO-BIOMETRIA.md).

## Escopo entregue

- Driver `mysql2` 3.24.4, com pool limitado e consultas parametrizadas.
- Cartões, identidades assinadas e estados no SQL; emissão, segunda via e bloqueio transacionais, com um único cartão ativo por CPF.
- Configuração privada em `backend/.env`; modelo sem segredos em `backend/.env.example`.
- Comandos `db:setup`, `db:check` e `db:migrate`, sem fallback silencioso se o MySQL falhar.
- Migração explícita de JSON v1/v2, preservando origem, RSA e arquivos de coletas. Importação inteira em uma transação, recusando divergências e evitando duplicação.
- API aguarda as operações do banco. Confirmações simultâneas não reutilizam o mesmo desafio; indisponibilidade não é tratada como senha ou sessão inválida.
- `/health` consulta a conexão e responde 503 se ela estiver indisponível.

Foto, desenho, fatores de acesso, tentativas de PIN e chaves permanecem nos arquivos privados cifrados existentes. Não foram colocados segredos no código nem no Git. O formato do cartão e o serviço RSA não foram alterados nesta rodada.

## Como reproduzir

O [README](README.md) contém instalação, configuração, migração e início da demonstração. Inicie MySQL no painel do XAMPP; a API Node usa a porta 3000, enquanto o banco usa a porta 3306 por padrão. Apache serve apenas para ferramentas como phpMyAdmin, não para executar esta API.

```powershell
npm run db:check
npm run check:mysql
```

O ciclo verifica tipos, testes comuns, integração SQL e compilação backend/web. `npm run check:watch -- --mysql` repete o ciclo depois de alterações. O observador executa testes; correções de código continuam sendo feitas pelo agente/desenvolvedor. Resultados completos e hash das fontes ficam em `reports/latest.json`; logs em `reports/types.log`, `tests.log`, `mysql.log` e `build.log`, ignorados pelo Git.

A suíte comum contém **193 testes: 115 de backend e 78 de mobile**. A integração MySQL acrescenta **10 testes**, totalizando **203**. Os testes comuns não precisam do XAMPP. A suíte SQL é optativa, usa somente loopback e cria/remove schemas próprios `facilid_test_<processo>_<id>`, sem selecionar o banco `facilid`. Ela não carrega o `.env` privado; credenciais especiais precisam ser fornecidas por variáveis do terminal. Os dados de todos esses testes são artificiais e isolados.

## Evidências e correções

| Arquivo | O que é verificado |
| --- | --- |
| `backend/tests/mysql-config.test.ts` | 33 casos: configuração, identificadores/portas inválidos, limites do pool, fechamento de conexão, equivalência do SQL externo, leitura de prontidão sem dados e mensagens sanitizadas. |
| `backend/tests/persistencia-assincrona.test.ts` | 10 casos: espera do repositório, falha de salvamento, preservação do cartão anterior, erros 500 sem invalidar sessão, reserva exclusiva de desafio, nova tentativa, revogação/expiração durante espera e saúde do banco. |
| `backend/tests/mysql.integration.mysql.ts` | 10 casos reais: emissão/PIN/perfil, reconexão, revogação, concorrência para CPF novo e existente, strings de SQL tratadas como dados, rollback, importação idempotente, recusa de divergência, falha no meio da migração e legado v1. |
| Suítes anteriores backend/mobile | Regressões de assinatura RSA, autorização, câmera, desenho, NFC simulado, PIN, credencial protegida pela biometria, sessões e acessibilidade. |

O primeiro ciclo SQL revelou erro em três emissões simultâneas para o mesmo CPF. A inserção que ignorava duplicatas tomava um bloqueio compartilhado e depois disputava sua conversão para escrita. A correção usa UPSERT para obter diretamente o bloqueio exclusivo da linha da pessoa. Os testes posteriores exercitam tanto pessoa nova quanto já cadastrada, preservando exatamente um cartão ativo e o histórico dos demais.

Também foram tratados os efeitos das consultas assíncronas: o desafio é reservado antes da primeira espera, o estado do cartão é consultado novamente antes da sessão, e falhas de banco liberam a tentativa sem expor detalhes internos. A emissão remove a coleta recém-criada se o salvamento falhar.

## Ambiente local configurado

- XAMPP em Windows, com **MariaDB 10.4.32**: banco `facilid` e quatro tabelas preparados.
- Quatro registros locais v1 importados para `facilid_legados`; nenhum deles foi convertido automaticamente em cartão ativo. Precisam de nova emissão com assinatura e PIN.
- Segunda execução da migração importou zero registros e reconheceu a importação anterior.
- Os quatro arquivos privados originais, incluindo cadastro, chaves RSA e segredo JWT, mantiveram os mesmos hashes após a preparação/importação. Os hashes e conteúdos privados não são publicados.
- `db:check` concluiu; a API iniciada com armazenamento MySQL respondeu HTTP 200 em `/health`.

## Arquivos principais

| Arquivo | Alteração |
| --- | --- |
| `backend/src/config.ts`, `backend/.env.example` | Configuração local e diagnóstico sem conteúdo privado do driver. |
| `backend/src/db/mysql.ts`, `schema-mysql.sql` | Conexão, validação, banco e quatro tabelas InnoDB. |
| `backend/src/db/persistencia.ts` | Seleção explícita entre MySQL e JSON. |
| `backend/src/db/cli.ts`, `migrar-json.ts` | Preparo, verificação e importação protegida contra sobrescrita. |
| `backend/src/repositories/mysql-usuarios.repository.ts` | Consultas e transações de cartões. |
| `backend/src/repositories/usuarios.repository.ts` | Interface compatível com adaptadores síncronos/assíncronos e esquema de importação. |
| `backend/src/server.ts`, `app.ts`, `db/seed.ts` | Inicialização aguardando banco, encerramento do pool, saúde e preparo no armazenamento escolhido. |
| Rotas, `middleware/sessao.ts`, serviços de emissão/desafio | Espera das consultas e proteção durante operações concorrentes. |
| `package.json`, `backend/package.json`, `package-lock.json` | Driver e comandos de manutenção/teste. |
| `scripts/verify.mjs` | Ciclo opcional com MySQL, limitado às fontes do FácilID. |
| `README.md`, `VALIDACAO-MYSQL.md` | Execução, migração, reprodução e limites. |

## Limites que permanecem

Foi testado o MariaDB fornecido pelo XAMPP, não um servidor MySQL 8 separado. O projeto continua com **uma instância de backend**: fatores são mantidos em arquivos e desafios em memória. SQL e arquivos não fazem parte de uma única transação distribuída; falhas comuns têm compensação, mas uma interrupção abrupta exige recuperação operacional. Backup precisa abranger banco, arquivos privados, chaves e configuração juntos, com a API parada.

O banco contém CPF e identidade sem criptografia de aplicação. Root local do XAMPP é configuração de desenvolvimento; uso real exige conta de banco restrita, HTTPS, gestão individual de administradores, política de retenção e gestão de chaves. Trocar `DB_CLIENT` não sincroniza as duas bases e não deve ser usado como recuperação automática.

Esta integração não adiciona reconhecimento facial nem valida sensores físicos. NFC, câmera e biometria ainda precisam da conferência manual em aparelho compatível descrita no README. Alertas transitivos de dependências permanecem sujeitos a `npm audit`; nenhuma atualização forçada de Expo/React Native foi aplicada.
