# Fontes visuais e decisões do Fácil ID 2.0

Consulta e seleção: 22/11/2026. A direção visual e os componentes foram criados para o Fácil ID; nenhum template foi copiado.

## Fotografias reais

| Arquivo em `website/assets/` | Autoria e fonte | Uso |
| --- | --- | --- |
| `pessoa-tecnologia-1280.webp`, `pessoa-tecnologia-640.webp` | [Kampus Production — An Elderly Man using a Tablet](https://www.pexels.com/photo/an-elderly-man-using-a-tablet-7983611/) | Fotografia principal de homem idoso negro utilizando um tablet. |
| `conexao-idoso-640.webp` | [Ron Lach — Photo of an Elderly Man Talking on Phone](https://www.pexels.com/photo/photo-of-an-elderly-man-talking-on-phone-7870681/) | Retrato complementar de homem idoso negro utilizando um telefone. |

As duas fotografias foram conferidas visualmente e são fotografias de banco, não imagens geradas por IA. O pedido de representação de pessoas idosas negras orientou a seleção. Não são depoimentos de clientes e não atribuem endosso às pessoas retratadas.

A [licença Pexels](https://www.pexels.com/license/) permite uso gratuito e adaptação em sites. Proíbe, entre outros usos, implicar endosso e representar pessoas de forma ofensiva. A autoria foi registrada aqui, mesmo sem exigência de crédito na interface. Os arquivos foram redimensionados e comprimidos em WebP pelo serviço de imagens do Pexels. O enquadramento responsivo é aplicado pela página; identidade e características das pessoas foram preservadas.

## Tipografia

[Manrope](https://fonts.google.com/specimen/Manrope), pesos variáveis 400–800, subconjunto latino com acentos portugueses. Arquivo WOFF2 hospedado no próprio site, aproximadamente 24 KB. Licença SIL Open Font License em `website/assets/Manrope-OFL.txt`, obtida do [repositório oficial Google Fonts](https://github.com/google/fonts/tree/main/ofl/manrope).

## Referências consultadas

- [Motion — animate](https://motion.dev/docs/animate): coordenação de movimento e uso de transformações.
- [GSAP — documentação](https://gsap.com/docs/v3/): organização de sequências e animações.
- [React Bits](https://reactbits.dev/), [Magic UI](https://magicui.design/) e [Aceternity UI](https://ui.aceternity.com/): referências de composição e microinterações; não instaladas.
- [Motion Primitives](https://motion-primitives.com/) e [Codrops](https://tympanus.net/codrops/): consulta tentada; acesso automatizado retornou 403. Não usadas como evidência técnica.
- [MDN — Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API/Using_the_Web_Animations_API): animações nativas sem dependência adicional.
- [W3C — WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/): referência para contraste, teclado, foco, redimensionamento e movimento. Resultados dos testes não equivalem a uma certificação de conformidade.

## Decisão arquitetural

O institucional já vive em `website/`, separado do Expo. HTML semântico, CSS e módulos JavaScript atendem à demonstração local, à composição em perspectiva, à navegação acessível e às animações necessárias. Não foi identificada uma limitação que justificasse migrar esta página para React/Vite. A escolha mantém o carregamento pequeno e a configuração atual de Cloudflare Pages: sem comando de build e saída `website`.

O aplicativo Expo, o servidor Express e o armazenamento MySQL/arquivos privados mantêm suas responsabilidades. A demonstração do institucional não se conecta à API nem cria uma sessão autenticada. A branch de revisão deve ser publicada como preview; a substituição de `main` depende da aprovação da nova versão.
