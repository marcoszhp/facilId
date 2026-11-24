# Fácil ID 2.0

Atualização: 23 de novembro de 2026.

## O que é e para quem foi criado

O Fácil ID / AcessoSênior organiza a apresentação de um cartão digital e a confirmação de acesso às informações de uma pessoa. Foi pensado especialmente para pessoas idosas e para quem tem pouca familiaridade com tecnologia.

O site apresenta o projeto e permite experimentar seu fluxo com dados fictícios. O aplicativo operacional é uma parte separada do projeto.

## Como funciona o aplicativo

1. A pessoa apresenta um cartão digital assinado, por NFC ou QR Code, conforme o dispositivo.
2. O servidor verifica o cartão e solicita uma confirmação adicional: PIN ou uma credencial protegida pelo aparelho, quando configurada.
3. Após a confirmação, o aplicativo permite consultar o perfil e os atendimentos disponíveis.

O responsável pode emitir, consultar e bloquear cartões, além de acompanhar atendimentos e eventos administrativos. O aplicativo também possui orientação por voz, conforme os recursos do aparelho. Esses recursos pertencem ao aplicativo; o site institucional não é uma entrada para essas operações.

## O que mudou no site

- Abertura com celular e cartão em perspectiva, animação finita e opção de rever.
- Navegação fixa com menu adaptado ao celular e suporte a teclado.
- Sequência visual de três etapas, seção fotográfica e diagrama de funcionamento.
- Duas fotografias reais de idosos negros, com autoria e licença registradas em [Fontes visuais](FONTES-VISUAIS.md).
- Demonstração interativa com estados de processamento, confirmação, sucesso e erro.
- Fonte Manrope hospedada no próprio site, imagens WebP responsivas e animações que respeitam a preferência por movimento reduzido.
- Exemplo de ampliação de texto; o zoom do navegador funciona em toda a página.
- Revisão editorial com menos chamadas repetidas, espaçamento ajustado e um aviso curto sobre os limites da simulação.
- Rodapé azul-marinho com o crédito aos alunos do SENAC, menção a @marcoszhp e links para Instagram e GitHub.

## Demonstração

A área **Modo demonstração** funciona apenas no navegador. O cartão e o perfil de **Marcos Edimundo** são fictícios. O PIN de exemplo é **1234**.

É possível apresentar o cartão, preencher o PIN pelo teclado da tela ou pelo teclado físico, confirmar, ver o resultado e reiniciar. Ao concluir, aparece um cartão de identificação inspirado na composição do CIE, com avatar ilustrativo, nome Marcos Edimundo, datas e identificador fictícios. O cartão traz a indicação de que não possui validade documental. Um PIN diferente mostra uma mensagem de erro e permite tentar novamente. A opção de cartão inválido explica por que a confirmação não pode continuar. Reiniciar cancela as etapas pendentes.

A demonstração não lê NFC, não autentica pessoas, não chama a API e não guarda os dados digitados. As telas em perspectiva da abertura são ilustrações do fluxo, não capturas do aplicativo operacional. Sem JavaScript, o conteúdo continua legível e a demonstração exibe uma explicação alternativa.

## Linguagens e tecnologias

| Parte | Tecnologias | Responsabilidade |
| --- | --- | --- |
| Site `website/` | HTML, CSS e JavaScript em módulos | Apresentação e demonstração local |
| Aplicativo `mobile/` | TypeScript, React Native e Expo | Telas operacionais e recursos do aparelho |
| Servidor `backend/` | TypeScript, Node.js e Express | Regras, validação do cartão e sessão |
| Armazenamento | MySQL/MariaDB e arquivos privados cifrados | Cartões, histórico, fotos e fatores |
| Verificação do site | Playwright, Chrome e axe | Fluxos, capturas e verificações automatizadas |

O institucional já estava separado do Expo. Foi mantido como site estático porque permite implementar o desenho e as interações sem adicionar um framework ou bibliotecas de animação. O backend e os mecanismos de autenticação não foram alterados nesta reconstrução.

## Executar e conferir

Na raiz do repositório:

```powershell
python -m http.server 8765 --bind 127.0.0.1 --directory website
```

Abra `http://127.0.0.1:8765`. Não é necessário configurar variáveis de ambiente nem iniciar a API para usar o site. Os resultados da reconstrução estão em [Validação do site](VALIDACAO-SITE-2.md); a rodada mais recente está em [Validação editorial](VALIDACAO-EDITORIAL.md).

## Publicação e reversão

Repositório: [marcoszhp/facilId](https://github.com/marcoszhp/facilId). A produção existente está em [facilid.pages.dev](https://facilid.pages.dev/).

A reconstrução foi publicada em produção em 23/11/2026, após autorização do usuário, pelo [pull request #3](https://github.com/marcoszhp/facilId/pull/3), commit `9ada16e`. O endereço oficial permanece **https://facilid.pages.dev/**. A revisão editorial e os créditos foram publicados pelo [pull request #4](https://github.com/marcoszhp/facilId/pull/4), commit `59ddeaf`, com sete verificações adicionais aprovadas no endereço público. O registro completo fica em [Validação editorial](VALIDACAO-EDITORIAL.md).

Cloudflare Pages utiliza a raiz do repositório, nenhum comando de build e a pasta de saída **website**. Os arquivos já estão prontos para publicação. A navegação usa âncoras da própria página, sem necessidade de reescrita de rotas. Fotos, fonte, CSS e JavaScript são locais; a hospedagem fornece HTTPS. Não há segredos ou variáveis de ambiente no institucional.

As [prévias do Pages](https://developers.cloudflare.com/pages/configuration/preview-deployments/) permitem avaliar branches sem substituir a produção. Se uma versão aprovada precisar ser revertida depois da publicação, o painel permite selecionar uma implantação de produção anterior e usar [Rollback to this deployment](https://developers.cloudflare.com/pages/configuration/rollbacks/). Uma prévia não é um alvo de rollback. O Git deve refletir a reversão antes de uma publicação seguinte.

O deploy do site não hospeda automaticamente o servidor Node.js, o banco MySQL ou os arquivos privados do aplicativo. A infraestrutura desses serviços exige configuração própria.

## Limitações

NFC sozinho não autentica uma pessoa. O cartão pode ser copiado; a confirmação adicional continua necessária. A disponibilidade de NFC e credenciais protegidas depende do dispositivo. Foto não significa reconhecimento facial, e a biometria local não comprova identidade civil. O Fácil ID não substitui documentos oficiais.

Os testes de navegador não substituem validação em hardware real nem sessões com pessoas idosas e usuários de leitores de tela. Os resultados de acessibilidade e desempenho estão delimitados no relatório de validação; não representam certificação WCAG ou medições de usuários reais.
