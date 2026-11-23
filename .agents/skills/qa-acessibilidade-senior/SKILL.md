---
name: qa-acessibilidade-senior
description: Avalia acessibilidade e usabilidade do FácilID para pessoas idosas, no navegador e no celular, sem perder desempenho.
---

# Qualidade e acessibilidade para idosos

## Contexto
O FácilID/AcessoSênior atende usuários idosos e pessoas com pouca familiaridade digital. Eficiência visual não pode comprometer compreensão, privacidade ou uso por teclado.

## Checklist
1. Validar hierarquia de informação, textos de ação explícitos e linguagem simples.
2. Verificar contraste, tamanhos de texto confortáveis, zoom, espaçamento, layout responsivo e ausência de overflow.
3. Garantir botões com alvos de toque confortáveis (recomendação do projeto: 48 px ou mais nas ações principais), identificadores acessíveis, foco visível e ordem de navegação lógica.
4. Verificar leitura por tecnologias assistivas e feedback de erro, sucesso, carregamento, espera e expiracão de sessão.
5. Não depender só de cor, movimento, som ou hover para transmitir estados.
6. Respeitar preferência por movimento reduzido na web. Não impor animação de entrada longa para acessar o serviço.
7. Exercitar jornada de autenticação com dados fictícios e cenário de falha; distinguir demonstração de hardware real.
8. Não expor CPF completo, credenciais, imagens privadas ou tokens nas capturas de teste.
9. Verificar fonte Manrope quando carregada e fallback em ausência de rede; verificar paleta monocromática azul e componentes BTN consistentes.
10. Fotografias de pessoas idosas devem ser reais, respeitosas, licenciadas e não usadas para prometer funcionalidades inexistentes.

## Evidências
Relatar passo testado, plataforma e resolução, resultado observado, problema e severidade (bloqueante, alta, média, baixa), solução recomendada e confirmação de reteste. Testes não realizados devem ser marcados como não realizados.
