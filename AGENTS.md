# Contexto do FácilID

Para tarefas deste projeto, leia [PROJECT_CACHE.md](PROJECT_CACHE.md) primeiro. Use o índice para abrir somente os arquivos envolvidos e suas dependências diretas; não faça varredura completa automaticamente. O código atual prevalece sobre o cache. Atualize o cache após mudanças relevantes e nunca inclua segredos.

Estas orientações referem-se ao FácilID (`backend/`, `mobile/`, `scripts/`, `docs/` e arquivos de configuração/documentação da raiz). Os outros projetos e ZIPs listados no cache estão fora desse escopo.

## Continuidade e margem de uso

O usuário pediu preservar uma margem de 5% do limite disponível. Quando a consulta de limites estiver disponível, confira antes de trabalho substancial e entre etapas grandes. Se alguma janela aplicável estiver com 5% ou menos restante, registre pendências e próximo passo no cache e adie a próxima etapa pesada. A margem é preventiva, não reserva garantida: o limite é compartilhado entre conversas. Não comprar créditos nem resgatar resets. A automação de retomada deve permanecer ativa mesmo sem pendências, encerrando essas verificações sem inventar trabalho; não pausá-la automaticamente ao concluir uma etapa.

## Ferramentas e papéis de agentes

Para trabalhos de design, implementação e validação, leia [docs/AGENTES-MCP-SKILLS.md](docs/AGENTES-MCP-SKILLS.md). As skills de Astra, Luna e acessibilidade estão em `.agents/skills/`; a configuração MCP ilustrativa, **não instalada automaticamente**, está em `.agent-tools/mcp-servers.example.json`. Use somente ferramentas disponíveis e autorizadas no ambiente; não afirme instalação ou testes locais sem executá-los.

## Design, textos e entrega final

A identidade visual e as regras de conteúdo obrigatórias estão em [docs/PADRAO-VISUAL-E-CONTEUDO.md](docs/PADRAO-VISUAL-E-CONTEUDO.md). Exigir cabeçalho consistente/sticky na web, botões sem repetição, uma fonte e uma paleta, textos curtos e concretos. A documentação simples para pessoas leigas está em [docs/DOCUMENTACAO-FINAL.md](docs/DOCUMENTACAO-FINAL.md); atualizar contra o código realmente entregue antes da apresentação.

## Publicação futura

O código já está no GitHub; a hospedagem no Cloudflare permanece planejada, não executada. Consulte [docs/PLANO-PUBLICACAO-GITHUB-CLOUDFLARE.md](docs/PLANO-PUBLICACAO-GITHUB-CLOUDFLARE.md) antes de configurar CI/CD ou expor serviços. Site web, API Node e MySQL requerem decisões independentes. Não publicar segredos, abrir acesso ao banco local ou criar serviços pagos sem autorização.
