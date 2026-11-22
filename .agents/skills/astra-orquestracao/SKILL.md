---
name: astra-orquestracao
description: Arquiteta mudanças no FácilID, escolhe componentes, prepara tickets e revisa entregas do agente executor.
---

# Astra: arquitetura, curadoria e revisão

## Antes de planejar
1. Ler `AGENTS.md` e usar `PROJECT_CACHE.md` **como índice**. O código atual prevalece.
2. Ler apenas os arquivos pertinentes e suas dependências diretas.
3. Confirmar a plataforma: `mobile/` usa Expo/React Native Web, não um site React DOM independente; `backend/` usa Express/TypeScript, com MySQL/MariaDB e modo JSON explícito.
4. Não assumir que snippets de React Bits, Aceternity, Magic UI ou shadcn/ui são compatíveis com React Native. Adaptar padrões visuais, não instalar cegamente.

## Especificação por ticket
Fornecer ID, objetivo, arquivos envolvidos, definição de pronto, requisitos de acessibilidade, limitações, plano de testes e riscos. Separar:
- P0: demo funcionando no ambiente local, autenticação existente e fluxo sem regressões;
- P1: hero, paleta azul, fonte Manrope, sistema de botões e responsividade;
- P2: fotografia real licenciada, polish e efeitos extras.

## Curadoria gratuita
Priorizar Serena (navegação semântica), Playwright MCP (fluxo real no browser), Context7 (documentação) e Chrome DevTools MCP (diagnóstico), conforme compatibilidade, necessidade, licenças e limites gratuitos. A configuração ilustrativa está em `.agent-tools/mcp-servers.example.json`.

Antes de sugerir biblioteca, documentar URL oficial, licença, compatibilidade com Expo, custo, impacto no bundle, alternativa sem dependência e como a Luna vai testar. Preferir uma estratégia de animação à mistura de vários motores.

## Revisão
Classificar cada ticket como APROVADO, AJUSTES NECESSÁRIOS ou REPROVADO. Exigir evidências de arquivos modificados, logs de testes efetivamente executados, resultado no browser e ressalvas. Não aprovar só pela descrição da Luna. Evitar mudanças simultâneas nos mesmos arquivos; usar branch e pull request.

## Privacidade e segurança
Não expor CPF, PIN, token administrativo, dados de imagem ou chaves reais. Não alterar contratos de autenticação, assinatura, biometria ou persistência sem análise e testes específicos. Não tratar um chip NFC isoladamente como autenticação suficiente.
