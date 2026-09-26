# Operação, manutenção e diagnóstico

[Índice](README.md) · [Instalação](INSTALACAO-E-CONFIGURACAO.md) · [Banco](BANCO-DE-DADOS.md)

## Rotina de operação local

1. Inicie MySQL no XAMPP e confirme que está disponível.
2. Inicie uma única API (`npm run dev`) e o cliente (`npm run web` ou Dev Client).
3. Confira `/health`; entre como responsável somente para tarefas administrativas.
4. Use dados fictícios em demonstrações habituais; confirme com o voluntário antes de coleta real.
5. Ao encerrar, saia das sessões, interrompa os terminais e feche a área administrativa.

Migração não é rotina diária. Não apague arquivos privados nem regenere chaves para solucionar erro de rede, porta ou banco. Não execute duas cópias do backend sobre a mesma pasta de coletas.

## Diagnóstico por sintoma

| Sintoma | Verificação / ação indicada |
| --- | --- |
| MySQL indisponível / API não inicia | Iniciar MySQL no painel; conferir host/porta privados; `npm run db:check`. Não trocar para JSON automaticamente. |
| Acesso ao banco recusado | Conferir `DB_USER/DB_PASSWORD` no arquivo local e variáveis do terminal. Não publicar senha/log bruto do driver. |
| Banco ou tabelas ausentes | Conferir `DB_NAME`; em ambiente correto executar `npm run db:setup`, depois `db:check`. Não criar outro banco para ocultar divergência. |
| Migração recusada por conflito | Manter API parada; comparar origem e histórico por responsável técnico; preservar ambos. Bloqueios/cartões novos no destino não devem ser sobrescritos. |
| API: porta ocupada | Identificar a instância que já está usando PORT. Reutilizar ou encerrar a instância conhecida; não matar processos arbitrários. |
| Web abre, mas requisições falham | Conferir URL da API e `/health`; distinguir rede de CORS; se Expo mudou a porta, ajustar `CORS_ORIGIN` e reiniciar API. |
| API no celular não encontra localhost | Usar `10.0.2.2` no emulador, USB com adb reverse ou IP do computador em rede configurada. localhost no aparelho aponta para o próprio aparelho. |
| “Acesso restrito ao responsável” | Usar a chave correta do ambiente; JWT de cidadão não substitui `X-Admin-Token`. Se houver ADMIN_TOKEN externo, arquivo antigo pode não ser a chave em uso. |
| Cartão antigo / sem coleta | Emitir novamente com assinatura e PIN; não inventar um PIN para dados antigos. |
| PIN errado / muitas tentativas | Conferir PIN com cuidado; após bloqueio aguardar o prazo indicado. Não tentar contornar com novo desafio. Esquecimento exige nova emissão pelo responsável. |
| Verificação expirada | Ler cartão novamente; desafio dura dois minutos e não sobrevive ao reinício do backend. |
| Verificação já em andamento | Aguardar operação anterior; não disparar confirmações duplicadas. |
| Foto expirou ou já foi usada | Refazer captura; upload é temporário e de uso único. |
| Foto/SVG inválidos ou grandes | Usar captura/quadro do app, resolução permitida e desenho com deslocamento; não colar SVG arbitrário. |
| Câmera negada | Rever permissão/contexto seguro ou escolher demonstração sem câmera. |
| Biometria indisponível/cancelada/invalidada | Continuar com PIN. Mudança de cadastro biométrico pode invalidar credencial protegida; reabilitar em aparelho confiável. |
| NFC não funciona no navegador | Usar QR/texto/cartão preparado; leitura NFC nativa requer Dev Client e aparelho compatível. |
| Tag pequena / somente leitura | Usar tag NDEF gravável com espaço suficiente; não truncar JSON/assinatura. |
| Chave RSA/AES ausente ou incompatível | Restaurar conjunto coerente de backup; não substituir chave isolada e esperar que cartões/coletas continuem válidos. |
| Falha 500 ao consultar perfil | Infraestrutura não disponível; manter opção de tentar novamente. 401 tem significado diferente e encerra sessão. |

## Coleta de evidências sem dados pessoais

Registre data, versão/commit, plataforma, passo, resultado esperado/obtido, status HTTP e `X-Request-Id`. Não anexar CPF real, cartão JSON completo, PIN, token, foto, assinatura ou arquivos `.local`. O identificador de correlação é emitido, mas não existe coletor central de logs; não anunciar rastreamento distribuído.

Os relatórios automatizados ficam em `reports/latest.json`, `reports/cycle-*.json` e logs por etapa. Eles são locais e ignorados pelo Git. Não use um relatório de fonte anterior como prova de uma alteração nova.

## Backup e restauração

O estado recuperável é um **conjunto**: banco SQL, toda a pasta privada indicada por `DATA_DIR` e configuração/segredos externos aplicáveis. Exportar apenas SQL perde mídia e fatores; copiar apenas `.local` perde o histórico ativo do MySQL.

Procedimento de backup proposto:

1. Agendar uma pausa e encerrar a API, sem novas emissões/confirmações.
2. Exportar estrutura e dados das quatro tabelas do banco escolhido, por ferramenta administrativa apropriada ao MariaDB local.
3. Copiar integralmente o diretório privado e preservar configuração de conexão e segredos de ambiente que não estejam em arquivos. Guardar em destino privado com acesso restrito, fora do repositório e de compartilhamentos públicos.
4. Registrar data, versão do código/banco, localização protegida e verificação de integridade do conjunto, sem colocar valores secretos no relatório.
5. Validar restauração em **banco e diretório separados**, com a API principal parada, antes de depender desse backup.

Na restauração, usar primeiro um destino isolado e vazio; configurar explicitamente DB_NAME/DATA_DIR correspondentes, conferir tabelas, iniciar somente uma API e executar verificação de leitura. Não testar emitindo segunda via ou bloqueando cartões na base original. Depois da conferência, uma troca do ambiente principal requer plano de retorno e preservação da cópia anterior.

Esse procedimento é orientação operacional; não existe script de backup/restore automático, ensaio de desastre completo ou garantia de recuperação testada nesta edição. Transações SQL e compensações de arquivos não substituem esse ensaio. Não fazer cópia bruta dos arquivos internos do MariaDB enquanto o serviço está em uso como se fosse exportação consistente.

## Atualização e contribuição

1. Leia [PROJECT_CACHE.md](../PROJECT_CACHE.md); veja diferenças locais e identifique os módulos envolvidos.
2. Para trabalho isolado, crie branch com prefixo `codex/` ou o padrão acordado pelo responsável. Preserve alterações existentes do usuário.
3. Altere somente o escopo necessário. Mudança de contrato exige schemas backend, tipos/transporte mobile, Swagger e docs correspondentes.
4. Execute testes proporcionais; para persistência, inclua SQL isolado. Faça ciclo completo antes de entrega funcional ampla, conforme [qualidade](TESTES-E-QUALIDADE.md).
5. Se alterar a declaração pública, execute `npm run docs:api`; revise `docs/openapi.json`.
6. Atualize o cache e a evidência sem afirmar teste não executado; revise o diff antes de publicar.

Não incluir `.env`, `.local`, builds, dependências ou projetos vizinhos no commit. Prefira seleção explícita de arquivos a `git add .`. O histórico desta pasta contém outros projetos/ZIPs que não pertencem ao FácilID.

O lockfile fixa dependências. Não usar atualização forçada para silenciar audit; Expo, React Native, renderizador de testes e NFC precisam de versões compatíveis. Documente a decisão, riscos e validação ao atualizar. Não há CI, lint ou processo de release automatizado implantado por estes guias.

## Build e distribuição

`npm run build` compila o backend para `backend/dist` e exporta web para `mobile/dist`. Esses artefatos não iniciam serviços, não incluem banco e não configuram HTTPS. `npm run start -w backend` executa o backend compilado; exige configuração, schema e pasta privada corretos.

Para uma nova máquina de demonstração, siga instalação/preparo com dados fictícios novos ou restaure um conjunto privado validado. Uma cópia pública do GitHub nunca deve transportar segredos de outro ambiente. A URL usada pelo app e as credenciais locais de biometria também pertencem ao ambiente.

Disponibilização pública exige trabalho adicional: hospedagem adequada, HTTPS, banco restrito, contas administrativas individuais, observabilidade, backup testado e política de dados. Não há instrução nesta edição que torne XAMPP público ou transforme o protótipo em serviço de produção.

## Continuidade do trabalho assistido

O loop `check:watch` executa verificações quando detecta mudanças; não escreve correções. A automação de retomada do assistente é recurso externo ao app e pode depender de computador ligado, aplicativo aberto, permissões e limite de uso. Ela não representa disponibilidade do FácilID nem substitui testes/monitoramento do servidor.

Ao interromper trabalho, registrar no cache: etapa concluída, arquivos alterados, verificação executada, pendência concreta e próximo passo. Evitar retomar com releitura completa ou refazer trabalho já aprovado.

[Voltar ao índice](README.md)
