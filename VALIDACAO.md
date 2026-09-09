# Validação realizada

Data: 6 de setembro de 2026. Ambiente: Windows, Node.js 24.20.0, npm 11.19.0.

## Ciclos e correções

- Primeira rodada: 26 testes aprovados; tipo do registro NFC recusado pelo TypeScript. Corrigida a interpretação de `type` como texto ou vetor de bytes.
- Build web: o Expo tentava gravar cache fora da pasta autorizada. Adicionado inicializador que mantém o cache no projeto.
- Setup: o executor TypeScript falhou ao consultar o perfil Windows. Scripts passaram a compilar com TypeScript e executar com Node; geração RSA, seed e servidor foram executados com sucesso.
- Preparação Android foi separada do comando de build para não disparar por convenção de lifecycle do npm.
- Rodada completa posterior: tipos, 26 testes e compilação backend/web aprovados.
- Observador contínuo: uma sonda temporária com asserção falsa produziu `status: failed` e código 1 na etapa de testes, mantendo tipos/build independentes. A sonda foi removida após comprovar a detecção; ela não pertence à suíte do produto. O observador deve voltar a aprovar as fontes corrigidas.
- Revisão Android: adicionadas declaração de consulta ao serviço TTS, NFC/câmera opcionais e mensagem para tag somente leitura.

## Fluxos observados no navegador

- Carregamento do exemplo Maria Silva, login com cartão assinado e exibição do cartão digital.
- Consulta ao endpoint protegido com retorno “Seu acesso está ativo”.
- Saída da sessão e abertura da tela de emissão.
- Emissão de Ana Exemplo, CPF fictício 22233344455, com JSON e QR Code exibidos.
- Tentativa com CPF diferente recusada na interface com mensagem clara.

## Cobertura automatizada

26 casos cobrem emissão, login, assinatura falsa, adulteração dos campos, ordem de propriedades, cartão desconhecido/substituído, reinício com persistência, validação de cadastro, JSON inválido/excessivo, JWT expirado/adulterado, perfil protegido, documentação, validação compartilhada com mobile e incompatibilidade de capacidade com NTAG213/215.

O resultado mais recente é registrado em `reports/latest.json`; os logs e históricos ficam na mesma pasta. Esse relatório se refere aos comandos executados, não a uma certificação de hardware ou acessibilidade.

## Pendências materiais

- Java e ADB não estão disponíveis no PATH. Não foi possível compilar/executar Android neste ambiente. O prebuild gerou a estrutura e permissões; isso não equivale a uma build nativa aprovada.
- Leitura/gravação NFC, câmera/QR real, voz e vibração precisam de validação em aparelho. A aparência web e a árvore de acessibilidade foram inspecionadas; TalkBack e fontes ampliadas no Android ainda precisam de teste manual.
- O JSON RSA não cabe nas tags NTAG213/215 citadas no prompt. Use NDEF de capacidade maior, conforme README e análise.
