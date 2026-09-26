# FácilID / AcessoSênior — documentação do projeto

**Edição documental 1.0 · 26 de setembro de 2026 · Protótipo escolar**

O FácilID demonstra emissão de cartões assinados e autenticação acessível com CPF, cartão e confirmação por PIN ou credencial protegida pela biometria do aparelho. Esta documentação descreve o sistema implementado, seus procedimentos de uso e os limites que precisam ser considerados ao evoluí-lo.

Repositório: [marcoszhp/facilId](https://github.com/marcoszhp/facilId). Base funcional conferida: `1a37bcf`, com a documentação OpenAPI complementada nesta edição. Versões diferentes coexistem deliberadamente: pacotes `1.0.0`, contrato OpenAPI `2.1.0` e identidade do cartão `versao: 2` não representam a mesma coisa.

## Escolha seu ponto de entrada

| Público / necessidade | Comece por |
| --- | --- |
| Professor, avaliador ou novo integrante | [Visão geral e escopo](VISAO-GERAL.md) |
| Instalar no computador com XAMPP | [Instalação e configuração](INSTALACAO-E-CONFIGURACAO.md) |
| Demonstrar, emitir um cartão ou entrar | [Manual do usuário e do responsável](MANUAL-DO-USUARIO.md) |
| Entender ou alterar o código | [Arquitetura](ARQUITETURA.md) e [cache técnico](../PROJECT_CACHE.md) |
| Consultar o banco ou migrar dados | [Banco de dados](BANCO-DE-DADOS.md) |
| Integrar outro cliente | [Referência da API](API.md) e [OpenAPI JSON](openapi.json) |
| Avaliar proteção e tratamento de dados | [Segurança e privacidade](SEGURANCA-E-PRIVACIDADE.md) |
| Reproduzir evidências e validar mudanças | [Testes e qualidade](TESTES-E-QUALIDADE.md) |
| Resolver falhas, fazer backup ou manter o projeto | [Operação e manutenção](OPERACAO-E-MANUTENCAO.md) |

## Como interpretar os documentos

- **Implementado** significa que existe código correspondente; não significa certificação, auditoria ou teste físico.
- **Verificado automaticamente** identifica uma execução registrada e seu escopo. A última rodada completa anterior a esta edição passou em 203 testes, tipos e builds backend/web; veja [evidências](../VALIDACAO-MYSQL.md).
- **Validação manual pendente** cobre sensor NFC, biometria, câmera e demais comportamentos que precisam de aparelho real.
- **Evolução proposta** não representa funcionalidade disponível nem compromisso de prazo.

Os exemplos usam dados artificiais. Nenhum documento deve incluir token administrativo, JWT real, senha, PIN de usuário, chave privada, foto ou cartão real. Caminhos nos guias são relativos à raiz do repositório, salvo indicação explícita.

## Fonte de verdade e manutenção

O código atual prevalece em caso de divergência. Rotas e validações estão em `backend/src/routes/` e `backend/src/schemas/`; a declaração de API está em [swagger.ts](../backend/src/docs/swagger.ts). Atualize a documentação na mesma alteração que mudar um contrato ou procedimento. Gere novamente `openapi.json` com `npm run docs:api`; esse comando compila o backend e exporta somente a declaração pública, sem abrir banco nem arquivos privados.

O [PROJECT_CACHE.md](../PROJECT_CACHE.md) é um índice compacto para agentes e manutenção, não substitui estes guias nem detalhes de implementação. [AGENTS.md](../AGENTS.md) orienta futuras sessões. Os documentos `VALIDACAO*.md` na raiz mantêm evidências históricas e não devem ser reescritos para aparentar testes que não ocorreram.

## Referências oficiais selecionadas

As versões do projeto estão nos manifests e lockfile; as páginas oficiais ajudam a interpretar as integrações, sem substituir os testes locais.

- [XAMPP para Windows](https://www.apachefriends.org/faq_windows.html): ambiente local e distribuição MariaDB.
- [mysql2 — pool de conexões](https://sidorares.github.io/node-mysql2/docs/examples/connections/create-pool): abertura, liberação e encerramento de conexões.
- [Expo 54 — SecureStore](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/): armazenamento protegido e comportamento de autenticação/backup.
- [Expo 54 — LocalAuthentication](https://docs.expo.dev/versions/v54.0.0/sdk/local-authentication/): disponibilidade biométrica e restrições de plataforma.

[Voltar ao projeto](../README.md)
