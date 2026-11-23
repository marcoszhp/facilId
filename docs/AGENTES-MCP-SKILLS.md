# Arquitetura gratuita de agentes, MCP e Skills — FácilID

**Estado:** configuração proposta para clientes MCP; sem instalação automática no computador.  
**Escopo:** desenvolvimento e demonstração em 25/11/2026.  
**Base existente:** monorepo npm: Expo 54 / React Native Web em `mobile/`, Express/TypeScript em `backend/`, MySQL/MariaDB com modo JSON explícito. Consulte `PROJECT_CACHE.md` e verifique o código antes de agir.

## Decisões de arquitetura

- **Astra = arquiteto e revisor.** Examina impacto, escolhe componentes compatíveis, define tickets e critérios de aceite, revisa evidências. Não altera os mesmos arquivos que Luna em paralelo.
- **Luna = executor com acesso autorizado.** Implementa, inicia serviços no ambiente de trabalho, usa browser automatizado, captura evidências e executa testes. Se não possuir terminal/arquivos/navegador, declara limitação, sem fingir que rodou o projeto.
- **Fonte da verdade:** código no repositório, contratos atuais, `PROJECT_CACHE.md` como índice e `AGENTS.md`. Não duplicar regras conflitantes.
- **Fluxo:** Astra especifica -> Luna altera branch -> executa `npm run check`, `npm run typecheck`, `npm test` e `npm run build` conforme aplicáveis -> usa Playwright para validar no browser -> Astra revisa -> PR. Relatar testes não executados.
- **Mudanças sensíveis:** autenticação, cartão assinado, CPF, biometria, banco e criptografia precisam de revisão dedicada e testes; nenhuma refatoração por estética nesses módulos.

## MCPs recomendados (software gratuito; a disponibilidade no cliente deve ser verificada)

| Prioridade | Ferramenta | Responsabilidade | Referência oficial |
| --- | --- | --- | --- |
| P0 | **Serena** | Navegação semântica e edição precisa do repositório, evitando varreduras e alterações cegas | https://github.com/oraios/serena |
| P0 | **Playwright MCP** | Abrir a versão web local, executar fluxos, conferir botões, layout e capturas | https://github.com/microsoft/playwright-mcp |
| P1 | **Context7 MCP** | Consultar documentação das versões utilizadas; plano gratuito sujeito a cota e eventual chave gratuita | https://github.com/upstash/context7 |
| P1 | **Chrome DevTools MCP** | Diagnosticar console, rede e desempenho, se disponível | https://github.com/ChromeDevTools/chrome-devtools-mcp |
| Opcional | **GitHub MCP** | Consultar issues, PRs e arquivos caso a integração nativa do agente não resolva | https://github.com/github/github-mcp-server |

Configuração ilustrativa: `.agent-tools/mcp-servers.example.json`. **Não copie automaticamente para todos os clientes:** Codex, VS Code, outros agentes e aplicativos podem exigir formatos diferentes. Preferir a configuração própria de cada cliente. Executar os MCPs somente no ambiente autorizado.

**Custos:** os projetos recomendados são gratuitos ou de código aberto para os usos descritos. Context7 aplica limites no plano gratuito. Taxas de APIs de modelos de IA, infraestrutura e eventuais licenças de assets são independentes; não assumir que todo serviço associado é gratuito. Revisar licenças e termos antes da instalação.

## Skills locais e ativação

As Skills desta proposta usam o formato aberto `SKILL.md`: https://agentskills.io/specification

- `.agents/skills/astra-orquestracao/SKILL.md`: pesquisa, especificação, aceite e gestão de riscos.
- `.agents/skills/luna-implementacao/SKILL.md`: execução, testes e relatório técnico.
- `.agents/skills/qa-acessibilidade-senior/SKILL.md`: verificação para usuários idosos, navegação e acessibilidade.

As Skills só passam a funcionar em agentes que **suportem e leiam esse diretório**. Se o cliente não descobrir esse caminho, configurá-lo conforme sua documentação. Salvar a Skill no GitHub não instala um MCP nem dá acesso ao PC.

## Decisões para interface

- **Uma única fonte:** Manrope, somente se o mecanismo atual permitir aplicar sem quebrar mobile/web; fallback para fonte do sistema em indisponibilidade.
- **Uma família cromática:** azul monocromático (`#0B1F3A`, `#14345B`, `#2563A6`, `#418AD3`, `#DCECF9`, `#F4F9FE`) e neutros de contraste.
- **Sistema BTN:** `primary`, `secondary`, `outline`, `ghost` com estados acessíveis; ações com altura confortável (alvo 48 px+), rótulos claros, foco visível. Não impor CSS web a componentes React Native.
- **Hero:** “Sua identidade. Em um único toque.”; animação de cartão NFC e aparelho pode ser ilustrativa. Evitar uma suposta autenticação real em demonstração.
- **Foto:** imagem **fotográfica real** de pessoa idosa, com fonte/licença conferida e registro do autor. Não usar geração por IA nem depoimento inventado.
- **Compatibilidade:** React Bits, Magic UI, Aceternity, shadcn/ui e Three.js são referências, **não dependências automaticamente adequadas ao Expo/React Native Web**. Testar cada pacote em branch isolada antes da adoção.
- **Acessibilidade:** alto contraste, leitura clara, teclados, zoom, toque, áudio opcional, `prefers-reduced-motion` na web quando aplicável, estados de carregamento e erros compreensíveis.

## Demo e privacidade

O fluxo atual NÃO é “NFC sozinho autentica o usuário”. O repositório descreve cartão JSON assinado e confirmação por PIN/credencial local, com modo web sem hardware. Preservar esse contrato e demonstrar os estados reais do produto. Nunca prometer segurança biométrica que o produto não implementa. Utilizar dados fictícios e explicitar “Modo demonstração”; não expor CPF real, senha, token de administrador ou fotos privadas em screenshots/logs.

## Checklist operacional (Luna)

1. Ler `AGENTS.md` e `PROJECT_CACHE.md`; examinar somente arquivos envolvidos. Conferir `package.json`, `mobile/package.json`, `backend/package.json`.
2. Confirmar Node, npm, `uv`/Python para Serena, Chrome/Chromium para inspeção e configuração do banco para a demo. Não modificar configurações do sistema sem autorização.
3. No PC autorizado, instalar dependências **somente se necessário**, conforme lockfile; não instalar pacotes escolhidos apenas pelo nome.
4. Rodar backend e frontend com os scripts já existentes (`npm run dev` e `npm run web`) quando o ambiente estiver disponível. Confirmar portas reais, conexão do banco e erros.
5. Rodar `npm run check`, `npm run typecheck`, `npm test` e `npm run build` conforme viabilidade. A integração MySQL exige ambiente e dados de teste apropriados.
6. Fazer testes de navegador em tamanhos desktop/celular e verificar ações da jornada. Checar console, requisições, acessibilidade, carga e fallback.
7. Enviar ao Astra lista de arquivos alterados, comandos usados, resultados reais, evidências, riscos e próximos passos. Não afirmar testes que não executou.

## Escopo por prioridade até 25/11

- **P0:** inicialização local estável, demonstração e autenticação existente sem regressões, testes críticos.
- **P1:** hero, BTN, tokens azuis, tipografia única e responsividade.
- **P2:** fotografia real licenciada, animações secundárias, otimização de bundle e refinamentos.

Não instalar uma coleção de plugins por instalar. Priorizar no máximo os quatro MCPs principais e testar um de cada vez. Manter um fallback manual com terminal e Git caso uma integração falhe.
