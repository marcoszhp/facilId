# Análise integral do prompt FácilID / AcessoSênior

O documento fornecido foi tratado como especificação de referência. Após confirmação do usuário, o escopo passou a incluir a implementação completa e ciclos de testes e correções. A exigência interna de imprimir todos os arquivos na conversa foi substituída pela entrega dos arquivos no projeto.

## Inconsistências e decisões

1. **PIN:** aparece apenas no contexto; schema, endpoints e fluxo obrigatório não incluem PIN. A implementação segue CPF + cartão. Não promete segundo fator ou PIN.
2. **Capacidade NFC:** NTAG213 tem 144 bytes e NTAG215 tem 504 bytes úteis. Uma assinatura RSA de 2048 bits ocupa 344 caracteres em base64; somada aos sete campos e hashes, o JSON excede 504 bytes, antes do overhead NDEF. A gravação verifica a capacidade e recusa tags pequenas sem truncar dados. Usar tag NDEF maior; 2 KB ou mais dá margem ao nome e aos metadados. NTAG216 depende do tamanho exato. Trocar o JSON por identificador remoto seria mudança de arquitetura, por isso não foi feito.
3. **NFC sem celular:** o navegador demonstra texto/QR com React Native Web; NFC, TTS e haptics nativos possuem implementações separadas por plataforma. O backend e a validação de identidade são compartilhados entre os modos.
4. **Expo Go:** os módulos nativos exigem development build. Escolhido Expo Dev Client, com pastas Android/iOS geradas por prebuild, sem manter cópias manuais divergentes.
5. **Biometria:** hashes fictícios determinísticos, sem coleta. O desenho de assinatura também é fictício.
6. **CPF de exemplo:** o documento fornece CPF fictício; a checagem exige 11 dígitos, sem prometer validação cadastral real.
7. **Assinatura:** serialização canônica de todos os seis campos de identidade; assinatura do órgão excluída da mensagem assinada. Testes adulteram cada campo assinado.
8. **Autorização administrativa:** o prompt abre emissão/listagem para demo. Servidor restrito a localhost por padrão. Não é implantação pública; emissão não possui autenticação de administrador.
9. **Clonagem:** JSON assinado comprova integridade e origem; pode ser copiado. Uma tag comum não equivale à segurança de um documento CIE com chip criptográfico. Não há desafio/resposta, prova de posse não copiável ou revogação distribuída.
10. **Persistência:** JSON atrás de interface de repositório, substituição atômica do arquivo, operação em um processo. Uma reemissão com dados alterados invalida o cartão anterior. Reemitir dados idênticos produz a mesma assinatura RSA e não cria uma nova versão de credencial.
11. **Sessão:** JWT de 15 minutos, algoritmo/issuer/audience fixos, endpoint protegido de perfil. Token mantido somente na memória do app; sair o remove. Um JWT já emitido permanece válido até expirar, mesmo após reemissão.
12. **Acessibilidade:** texto de 20 ou mais, títulos de 32, botões de 60, instruções curtas, labels e anúncios. TTS/haptics dependem do dispositivo; sua indisponibilidade não bloqueia o acesso. Leitor de tela e escala de fonte precisam de validação manual em aparelho.
13. **Testes:** os três casos pedidos são insuficientes; adicionados corrupção de campos, entrada malformada, substituição de cartão, reinício, expiração, perfil protegido, contrato mobile e documentação.

## Ciclo de verificação

`npm run check` executa tipos → testes → compilação backend e exportação web. Registra códigos de saída, tempo, hash das fontes e logs em `reports/`. Retorna erro se uma etapa falha; não considera sucesso se os arquivos mudarem durante a execução.

`npm run check:watch` permanece observando mudanças e repete o ciclo após cada correção salva. Ignora dependências, saídas e relatórios para evitar realimentação infinita. Cada etapa tem limite de quatro minutos. Ctrl+C encerra.

O observador detecta e revalida; não inventa correções. As correções de código são feitas pelo desenvolvedor/agente, com teste de regressão quando pertinente, e o ciclo é repetido. Não se apagam testes nem se ignoram falhas para obter verde. Bloqueios de hardware são relatados separadamente de defeitos de código.

## Avisos do npm

`npm install-scripts` sem subcomando ou sem nomes é erro de uso, não erro do projeto. A configuração raiz autoriza somente `@scarf/scarf` e `esbuild`, os dois scripts observados durante a instalação. Vulnerabilidades transitivas devem ser avaliadas antes de qualquer `npm audit fix --force`; neste conjunto o reparo sugerido troca o Expo 54 por uma major mais nova.

## Fontes

- NXP, capacidades NTAG213/215/216: https://www.nxp.com/products/NTAG213_215_216
- Expo, código nativo e development builds: https://docs.expo.dev/workflow/customizing/
