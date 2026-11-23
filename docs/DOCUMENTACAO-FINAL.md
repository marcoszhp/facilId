# FácilID — documentação para apresentação

**Versão inicial de leitura simples — 22/11/2026.** Este documento será atualizado e validado no encerramento da implementação. As novidades visuais planejadas ainda não devem ser descritas como prontas.

## O que é o FácilID?

O FácilID (também chamado AcessoSênior no projeto) é um protótipo de identificação e acesso pensado para pessoas idosas e usuários com pouca familiaridade com tecnologia. O sistema usa um cartão com informações digitais e etapas de confirmação para permitir o acesso.

## Como funciona?

1. Um responsável registra a pessoa e emite um cartão digital.
2. A pessoa apresenta esse cartão pelo método disponível no dispositivo, como NFC, QR Code ou demonstração preparada.
3. O sistema confere o cartão e exige confirmação por PIN ou, quando disponível e configurada, credencial protegida pela biometria do aparelho.
4. Depois da confirmação, a pessoa pode consultar suas informações e recursos disponíveis.

**Importante:** o NFC sozinho não confirma a identidade. A versão de demonstração pode funcionar sem hardware NFC, com dados fictícios e avisos claros.

## Linguagens utilizadas

| Linguagem | Para que serve no projeto |
| --- | --- |
| **TypeScript** | Escreve a lógica do aplicativo e do servidor, com verificações de tipos para reduzir erros. |
| **JavaScript** | Usado em scripts que automatizam tarefas de desenvolvimento e execução. |
| **SQL** | Define e consulta as tabelas do banco de dados. |

**TSX/JSX:** forma de escrever interfaces dentro do código TypeScript/JavaScript. Não é uma linguagem separada usada para substituir as anteriores.

## Principais tecnologias

| Tecnologia | Explicação simples |
| --- | --- |
| **React Native + Expo** | Ferramentas para construir o aplicativo e permitir o uso da interface também no navegador. |
| **React Native Web** | Faz a interface do aplicativo funcionar na web. |
| **Node.js + Express** | Recebem solicitações do aplicativo e executam as regras no servidor. |
| **MySQL / MariaDB** | Banco de dados que guarda informações do cadastro e cartões, conforme a configuração. |
| **NFC** | Comunicação por aproximação disponível em dispositivos compatíveis. |
| **JWT** | Tecnologia usada para representar sessões autenticadas. |

## Partes do sistema

- **Interface:** telas que a pessoa utiliza.
- **Servidor (API):** verifica solicitações, acesso e regras do sistema.
- **Banco de dados:** armazena os cadastros e registros necessários.
- **Integração com dispositivo:** usa recursos como NFC, câmera e biometria quando disponíveis.

## Recursos que o protótipo já documenta

- Emissão, bloqueio e segunda via de cartões.
- Confirmação de acesso com PIN e opção de biometria local em aparelhos compatíveis.
- Demonstração sem NFC físico usando dados de exemplo.
- Consulta de informações e fluxo de atendimentos demonstrativos.
- Tratamento de situações de erro, como cartão inválido ou conexão indisponível.

Esses recursos constam do código e da documentação consultados no repositório. **A execução completa não foi testada neste trabalho**.

## Limites e cuidados

- É um protótipo educacional; não deve ser apresentado como sistema oficial de identificação.
- Fotos e assinaturas no protótipo não equivalem a reconhecimento facial ou prova de autoria.
- O uso da biometria do aparelho não significa que o aplicativo armazena digitais ou imagens do sensor.
- Para a apresentação, preferir cadastros fictícios e não exibir dados pessoais reais.

## O que mudou no novo design? (preencher após implementar)

**Pendente de validação.** A proposta inclui azul monocromático, fonte Manrope, botões padronizados, cabeçalho coerente, imagem fotográfica real de pessoa idosa e uma demonstração clara. Não declarar esses itens entregues até a Luna implementar e o Astra aprovar.

## Validação antes de finalizar esta documentação

Ao concluir o projeto, Luna deve:
1. Verificar o código **final** e atualizar linguagens, bibliotecas, recursos e versões usados de fato.
2. Remover qualquer item que tenha sido planejado mas não desenvolvido.
3. Anotar em duas ou três linhas como a demonstração funciona.
4. Informar testes realmente executados e eventuais limitações.
5. Revisar o texto para que qualquer pessoa sem conhecimentos técnicos entenda.
6. Solicitar aprovação final do Astra.

A versão publicada após essa revisão deve ser curta e adequada à apresentação, sem listas enormes de dependências.
