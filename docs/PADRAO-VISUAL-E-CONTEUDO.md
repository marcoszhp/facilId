# FácilID — padrão visual, editorial e de interação

**Status:** especificação para implementação e revisão até a apresentação de 25/11/2026. Não confundir com funcionalidades já implementadas.  
**Responsáveis:** Astra define e verifica; Luna implementa, executa e testa.

## Princípio

O site inteiro deve parecer **um único produto**. Não copiar botões, headers e cards de bibliotecas diferentes sem unificar estilos, linguagem, espaçamento e comportamentos. A sofisticação deve vir de clareza, consistência e pequenos detalhes, não de excesso de efeitos.

## 1. Identidade coerente

- **Uma fonte:** Manrope nos componentes em que houver suporte; fallback de sistema quando indisponível. Definir escala e pesos globais.
- **Uma paleta monocromática azul:** `#0B1F3A` (profundo), `#14345B` (institucional), `#2563A6` (ação), `#418AD3` (apoio), `#DCECF9` (superfície), `#F4F9FE` (fundo) e branco; neutros funcionais permitidos. Não adicionar cores decorativas de outras famílias.
- **Tokens globais:** cores, tipografia, raio, sombras, bordas, espaçamento, durações e estados. Aplicar as mesmas regras em todas as seções e telas.
- **Alinhamento:** grade consistente; mesmas larguras máximas, recuos e distâncias verticais. Evitar seções desalinhadas e variações sem motivo.

## 2. Cabeçalho

- Na **versão web**, cabeçalho fixo ou sticky, contínuo e coerente com a hero; manter visibilidade após scroll, com altura compacta e transição discreta.
- Logo, navegação e **um único CTA principal** devem ter posições consistentes. Não repetir links de navegação só para preencher espaço.
- Ancoragem/scroll não deve esconder títulos sob o cabeçalho; teclado e leitores de tela devem funcionar.
- No aplicativo nativo, preservar navegação e acessibilidade próprias da plataforma: não aplicar CSS de site ao mobile sem análise.

## 3. Sistema BTN

Construir/reutilizar **um único componente** para botões, respeitando a plataforma:
- Variantes: `primary`, `secondary`, `outline`, `ghost`; definir quando usar cada uma.
- Estados: normal, hover (web), foco, pressionado, desabilitado, carregando.
- Tamanhos e raios padronizados, alvos de toque confortáveis (48 px ou mais nas ações principais), contrastes verificados.
- Uma seção tem **uma ação primária clara**; ações secundárias somente quando forem úteis. Não repetir botões iguais no cabeçalho, hero e várias seções sem objetivo específico.
- Nenhum botão decorativo ou sem função. Nomes verbais concretos: "Testar identificação", "Ver como funciona", "Voltar", "Confirmar".
- Não duplicar botões de login/cadastro e de demonstração se levam ao mesmo lugar. Destinos devem ser distintos.

## 4. Conteúdo sem frases de enfeite

- Cada frase precisa explicar **o que é**, **o que faz** ou **o que o usuário deve fazer**.
- Cortar clichês como "revolucionando o futuro", "uma nova era", "inovação sem limites", repetições de "simples, fácil e rápido" e blocos genéricos sem informação.
- Uma ideia por frase; títulos curtos; subtítulos concretos. Evitar jargões como "autenticação distribuída" em conteúdo dirigido ao público.
- Não criar depoimentos fictícios, estatísticas inventadas, certificações inexistentes, logos de parceiros sem permissão ou promessas técnicas não implementadas.
- Texto recomendado de hero: **"Sua identificação, sem complicação."** Subtexto: "Use o cartão ou a opção de demonstração para acessar seus dados com orientação passo a passo." Adequar após confirmar a funcionalidade exata. O título anterior "Sua identidade. Em um único toque." pode continuar como frase de destaque **somente se** não sugerir autenticação NFC sem confirmação adicional.
- CTA recomendado da hero: **"Ver demonstração"**; secundário só se tiver destino útil.
- Na demo, explicar claramente quando a leitura está sendo simulada.

## 5. Pessoa idosa e acessibilidade

- Fotografia real de pessoa idosa, obtida em banco autorizado e com autor/licença documentados. Evitar fotos artificiais, infantilização e estereótipos.
- Texto legível, contraste suficiente, escala acessível, navegação por teclado, indicadores de foco, feedback de erro, botões confortáveis, carregamento informativo.
- Efeitos devem respeitar preferência por movimento reduzido e não impedir o uso.
- A pessoa deve entender o próximo passo sem um tutorial longo.

## 6. Animações

- Uma gramática consistente: mesma curva de easing, velocidade, intensidade e distância de entrada.
- Hero pode ter uma sequência mais expressiva; seções internas usam transições mais discretas.
- Evitar loops excessivos, parallax agressivo, cores aleatórias, efeitos luminosos repetidos e bloqueio de rolagem.
- Só instalar componentes visuais compatíveis com Expo/React Native Web; adaptar snippets DOM quando necessário.

## 7. Checklist de revisão POR SEÇÃO

Para **cada** seção e cada componente:
1. Serve uma finalidade real?
2. A mensagem é específica, curta e verdadeira?
3. A cor pertence aos tokens?
4. A fonte e a hierarquia estão corretas?
5. Os botões têm objetivo único, ação real e estilo consistente?
6. O alinhamento, margens, bordas e tamanhos seguem o padrão?
7. Há cabeçalho consistente e a navegação não se quebra?
8. Passa em desktop, celular, zoom e teclado?
9. Há estados de loading, sucesso e erro legíveis?
10. Não causa regressão no fluxo existente?

Astra aprova o componente ou lista ajustes objetivos. Luna aplica e retesta. Não declarar "pronto" sem comparar o resultado real no navegador e executar os testes acessíveis.

## 8. Critérios de aceite finais

- Nenhum botão duplicado sem necessidade demonstrável.
- Nenhum botão sem ação.
- Nenhum texto genérico ou promessas não verificadas.
- Uma identidade visual consistente do começo ao fim.
- Cabeçalho fixo/sticky no site web, com navegação acessível.
- Demonstração funcional e claramente identificada.
- Documentação final curta e atualizada, com tecnologias reais e explicação para leigos (ver `docs/DOCUMENTACAO-FINAL.md`).
