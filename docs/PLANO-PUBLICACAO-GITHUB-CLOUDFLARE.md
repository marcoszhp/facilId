# FácilID — plano de publicação futura no GitHub e Cloudflare

**Status:** planejado, sem deploy realizado. **Não publicar automaticamente.** Validação técnica e autorização do responsável pelo projeto necessárias antes da primeira exposição pública.

## Situação atual

- Repositório existente: https://github.com/marcoszhp/facilId
- Código em monorepo npm workspaces: `mobile/` = Expo + React Native Web; `backend/` = Node.js/Express/TypeScript; MySQL/MariaDB no servidor local, alternativa JSON explícita para desenvolvimento/testes.
- A demonstração local atual não significa que backend, banco e fluxos de hardware funcionem na Cloudflare.

## Arquitetura recomendada por etapas

### Etapa 1 — GitHub como fonte da verdade

- Manter `main` estável; desenvolver em branches e revisar pull requests com Astra e Luna.
- `.env`, diretórios locais, tokens, chaves e dados de cadastro **não podem** ser versionados.
- Automatizar em PR: typecheck, build, testes disponíveis e verificação de ausência de segredos.
- Documentar alterações, versões e comandos. Não ativar deploy de produção a partir de commits não aprovados.

### Etapa 2 — Site público sem custos obrigatórios

- Priorizar **Cloudflare Pages** integrado ao GitHub para publicar a saída estática do Expo Web, se build e roteamento forem compatíveis.
- Validar comando `npm run build -w mobile` no ambiente de CI e descobrir a pasta real de saída do Expo (geralmente `mobile/dist`); não presumir sem verificar.
- Configurar a integração GitHub -> Cloudflare Pages, branches de preview e produção; ambiente público HTTPS, CSS/assets/fontes íntegros, sem páginas em branco.
- Publicar conteúdo institucional e **modo demonstração rotulado com dados fictícios** se o backend ainda não estiver hospedado. Não simular uma API real ocultamente.
- `EXPO_PUBLIC_*` é visível no bundle e não deve conter segredo. A URL pública de API pode ser variável de build **não secreta**.

### Etapa 3 — API e banco para uso remoto

- O backend atual não deve ser considerado portável diretamente para Cloudflare Workers. Avaliar compatibilidade Express, acesso a filesystem, criptografia, chaves locais e fluxo de sessão; execução Workers tem diferenças do Node tradicional.
- Duas opções, somente depois de testes: (A) hospedar Node/Express em serviço compatível e configurar HTTPS/CORS; (B) adaptar para Workers, com arquitetura de persistência compatível e testes, sem impor migração apressada.
- MySQL do XAMPP local não fica automaticamente acessível pela Cloudflare. É necessário banco remoto ou conectividade privada segura planejada. Hyperdrive conecta Workers a MySQL, mas requer origem acessível e configuração; não usar porta pública aberta do banco doméstico como atalho.
- Como o backend usa arquivos privados cifrados e estado em memória, revisar armazenamento durável, consistência e segurança antes de pensar em Workers ou escalonamento.
- Nunca publicar informações reais de idosos no ambiente de demonstração. Exigir autorização e plano de privacidade para qualquer uso real.

### Etapa 4 — Domínio e operação

- Usar subdomínio gratuito `*.pages.dev` inicialmente; domínio próprio somente se o usuário já tiver um ou autorizar custo.
- Conferir funcionalidades, acessibilidade, velocidade e responsiveness no HTTPS real.
- Estabelecer rollback usando deploys anteriores e manter ambiente de demonstração independente de produção.

## Custos e dependências

- Cloudflare Pages e Workers oferecem faixas gratuitas sujeitas a limites e alterações.
- GitHub e ferramentas de CI podem ter limites conforme tipo de conta e repositório.
- Banco de dados hospedado, armazenamento durável, APIs e domínio próprio **podem custar**, e não serão criados/contratados automaticamente.
- Não fazer promessa de custo zero de uma API + MySQL publicamente hospedados sem confirmar as condições do provedor na ocasião.

## Responsabilidades

**Astra:** define arquitetura de publicação, faz checklist de segurança, confirma custo, planeja reversão, aprova PR e documentação.

**Luna:** quando houver acesso e autorização, configura build e CI, verifica os assets, usa Cloudflare Pages de modo adequado, testa URL HTTPS, registra logs de build, prepara variáveis públicas sem segredos e entrega evidências.

## Critérios de conclusão futura

- Site publicado a partir da branch aprovada com URL real.
- Interface coerente (azul, Manrope, BTN, cabeçalho fixo no web), fotografia real licenciada e textos objetivos.
- Build reprodutível; links, fontes, imagens e navegação funcionando.
- Documentação final atualizada com URLs reais, tecnologias efetivamente usadas, funcionalidades que funcionam na web e limitações.
- Nenhum dado pessoal, token, chave ou senha exposto.
- Se API ainda não hospedada, o site informa o limite e oferece demonstração claramente simulada.

## Referências oficiais

- Cloudflare Pages Git integration: https://developers.cloudflare.com/pages/get-started/git-integration/
- Cloudflare Pages custom build configuration: https://developers.cloudflare.com/pages/configuration/build-configuration/
- Cloudflare Workers Express tutorial: https://developers.cloudflare.com/workers/tutorials/deploy-an-express-app/
- MySQL Hyperdrive: https://developers.cloudflare.com/hyperdrive/examples/connect-to-mysql/
