# Contexto do FácilID

Para tarefas deste projeto, leia [PROJECT_CACHE.md](PROJECT_CACHE.md) primeiro. Use o índice para abrir somente os arquivos envolvidos e suas dependências diretas; não faça varredura completa automaticamente. O código atual prevalece sobre o cache. Atualize o cache após mudanças relevantes e nunca inclua segredos.

Estas orientações referem-se ao FácilID (`backend/`, `mobile/`, `scripts/`, `docs/` e arquivos de configuração/documentação da raiz). Os outros projetos e ZIPs listados no cache estão fora desse escopo.

## Continuidade e margem de uso

O usuário pediu preservar uma margem de 5% do limite disponível. Quando a consulta de limites estiver disponível, confira antes de trabalho substancial e entre etapas grandes. Se alguma janela aplicável estiver com 5% ou menos restante, registre pendências e próximo passo no cache e adie a próxima etapa pesada. A margem é preventiva, não reserva garantida: o limite é compartilhado entre conversas. Não comprar créditos nem resgatar resets. A automação de retomada deve permanecer ativa mesmo sem pendências, encerrando essas verificações sem inventar trabalho; não pausá-la automaticamente ao concluir uma etapa.

## Ferramentas e papéis de agentes

Para trabalhos de design, implementação e validação, leia [docs/AGENTES-MCP-SKILLS.md](docs/AGENTES-MCP-SKILLS.md). As skills de Astra, Luna e acessibilidade estão em `.agents/skills/`; a configuração MCP ilustrativa, **não instalada automaticamente**, está em `.agent-tools/mcp-servers.example.json`. Use somente ferramentas disponíveis e autorizadas no ambiente; não afirme instalação ou testes locais sem executá-los.
