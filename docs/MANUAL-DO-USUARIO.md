# Manual do usuário e do responsável

**FácilID / AcessoSênior — protótipo escolar**

Público: cidadão, pessoa de apoio, professor e responsável pela emissão.

[Índice da documentação](README.md) · [Instalação e configuração](INSTALACAO-E-CONFIGURACAO.md) · [Suporte e manutenção](OPERACAO-E-MANUTENCAO.md)

## 1. O que o FácilID permite fazer

O responsável emite um cartão digital. O cidadão informa o CPF, apresenta esse cartão e confirma o acesso com um PIN de seis números ou com uma credencial protegida pela biometria do aparelho. Depois, pode visualizar seu cartão digital e consultar se o acesso continua ativo.

A demonstração funciona no navegador, sem cartão físico e sem câmera. Ela precisa da API em execução e conectada ao armazenamento configurado: **modo sem hardware não significa modo offline**. Não há agendamentos ou serviços municipais nesta versão.

| Recurso | O que significa nesta versão |
| --- | --- |
| Foto do rosto | Fotografia autorizada para o cadastro. Não reconhece o rosto nem verifica se a pessoa está viva. |
| Assinatura manuscrita | Desenho feito e confirmado no quadro. Não comprova quem o desenhou. |
| Assinatura digital do cartão | Proteção aplicada pelo servidor para detectar alterações nos dados. Não transforma o protótipo em documento oficial. |
| Biometria do aparelho | Confirmação do sistema operacional para liberar uma credencial local. Não prova que o rosto ou dedo pertence ao CPF informado. |
| NFC, QR Code e texto | Formas diferentes de apresentar o mesmo cartão assinado. O cartão continua copiável. |

Use dados fictícios na apresentação escolar. A coleta de foto e desenho de uma pessoa voluntária deve ser explicada antes de pedir sua concordância. Consulte [Segurança e privacidade](SEGURANCA-E-PRIVACIDADE.md).

## 2. Antes de começar

O professor ou responsável técnico deve preparar o serviço conforme [Instalação e configuração](INSTALACAO-E-CONFIGURACAO.md). Para a atividade, confirme que:

- a aplicação está aberta e a API está disponível;
- o responsável tem sua credencial administrativa privada;
- há um cartão emitido e o cidadão conhece seu PIN;
- o volume permite ouvir as instruções, se desejado.

A credencial do responsável é diferente do PIN do cidadão. Ela é fornecida pelo operador do ambiente, a partir da configuração privada do servidor. Não deve aparecer em slides, capturas de tela, documentos compartilhados ou no código do projeto.

O botão **Ajustar conexão** abre o campo **Endereço do serviço**. Somente o responsável técnico deve alterá-lo. Trocar o endereço reinicia a tela atual e descarta o cartão preparado em memória; não apaga os registros do banco.

## 3. Entrar como cidadão: três passos

### Passo 1 — Informe seu CPF

1. Preencha **Seu CPF** com os onze números usados na emissão.
2. Toque em **Continuar**.
3. Se precisar, use **Ouvir instruções**.

A conferência de CPF deste protótipo verifica o formato com onze dígitos, não a existência de uma pessoa nem os dígitos verificadores do cadastro civil. O CPF informado precisa corresponder ao cartão apresentado.

### Passo 2 — Leia seu cartão

Escolha uma das opções disponíveis:

| Situação | Ação na tela |
| --- | --- |
| Cartão preparado pelo responsável no mesmo aplicativo | **Entrar com o cartão preparado**. |
| Cartão físico e aplicativo nativo compatível | **Aproximar cartão**; mantenha a tag próxima à área NFC do aparelho até a resposta. |
| QR Code exibido em outra tela ou impresso | **Opções da demonstração** → **Ler QR Code**; autorize a câmera se desejar. |
| Código JSON copiado do cartão | **Opções da demonstração** → **Digitar ou colar código** → preencher **Código do cartão** → **Entrar com o código**. |

No navegador, use cartão preparado, QR Code ou texto. A leitura NFC é oferecida no aplicativo nativo. A opção **Usar exemplo preparado** preenche o texto com o cartão que o responsável já emitiu; não cria uma identidade nova.

Se o CPF estiver errado, toque em **Corrigir CPF** antes de apresentar o cartão. Durante uma operação, a tela informa **Aguardando cartão…** ou **Verificando acesso…**. Os botões **Cancelar leitura** e **Cancelar verificação** permitem interromper a espera e tentar novamente.

### Passo 3 — Confirme seu acesso

**Com PIN:** preencha **PIN de 6 números** e toque em **Confirmar PIN**. É o PIN escolhido na emissão, não a senha do computador nem a credencial do responsável.

**Com biometria:** em aparelho compatível e previamente habilitado, toque em **Confirmar com biometria** e siga a confirmação do sistema operacional. Se a confirmação for cancelada, preencha o PIN no formulário apresentado. Quando a biometria estiver indisponível ou não configurada, inclusive no navegador, esse formulário aparece diretamente. O botão **Usar PIN**, quando exibido, também abre essa alternativa.

Para habilitar a biometria pela primeira vez, escolha **Usar PIN**, informe o PIN e ative **Habilitar biometria neste aparelho** antes de confirmar. Faça isso somente em celular de confiança. Se o armazenamento protegido não puder ser configurado, o aplicativo explica que os próximos acessos continuarão usando PIN; quando oferecido, use **Continuar para meu acesso**.

A confirmação do cartão expira após dois minutos. Se aparecer o aviso de expiração, toque em **Ler cartão novamente**. Várias tentativas incorretas podem bloquear temporariamente a confirmação; espere o tempo indicado antes de tentar outra vez.

## 4. Depois de entrar

A tela **Acesso liberado** apresenta **Meu cartão digital**, nome, idade e CPF parcialmente oculto.

- **Ouvir meu cartão** lê nome e idade em voz alta. Considere quem está por perto.
- **Consultar meu acesso** consulta o servidor e confirma se a sessão e o cartão continuam válidos.
- **Sair** encerra a sessão neste aplicativo e retorna à entrada.

A sessão dura quinze minutos. A tela avisa quando faltar menos de um minuto e retorna à entrada ao expirar. Um cartão bloqueado ou substituído deixa de ser aceito pelo servidor; a tela já aberta percebe a revogação na próxima consulta protegida ou ao expirar. Não há atualização por notificação em tempo real.

Fechar ou recarregar o aplicativo perde a sessão mantida em memória. Para voltar, apresente um cartão ativo e confirme novamente. A opção **Sair** não exclui o cadastro nem necessariamente remove a credencial biométrica protegida do dispositivo.

## 5. Área do responsável

### 5.1 Acessar e encerrar

Na tela inicial, toque em **Área do responsável**, preencha **Credencial do responsável** e escolha **Acessar área do responsável**. O servidor confere essa credencial antes de permitir emissão ou gestão. Ela fica em memória durante esse acesso.

Use **Encerrar acesso do responsável** ao terminar. A operação limpa a credencial, os dados do formulário e as capturas da tela. **Voltar para entrar** retorna ao fluxo do cidadão. O projeto usa uma credencial administrativa compartilhada por ambiente; não há contas individuais de operadores.

### 5.2 Emitir uma demonstração sem câmera

1. Escolha **Usar modo demonstração sem câmera**.
2. Preencha **Nome**, **CPF** e **Idade** com dados fictícios.
3. Desenhe no quadro e toque em **Confirmar assinatura**, ou use **Usar assinatura fictícia**.
4. Defina **PIN de acesso (6 números)** e repita em **Confirme o PIN**.
5. Toque em **Gerar cartão** e aguarde a confirmação.
6. Use **Usar este cartão na demonstração** para retornar ao login com o cartão preparado.

O modo utiliza uma imagem fictícia identificada como demonstração. Ele mantém as verificações de assinatura digital, estado do cartão e PIN. Não há PIN padrão para todo cidadão; guarde o escolhido na emissão e evite mostrá-lo na apresentação.

### 5.3 Emitir com coleta autorizada

1. Mantenha o modo **coleta autorizada de foto e assinatura** e preencha os dados.
2. Leia a explicação sobre armazenamento e limites da coleta com o participante.
3. Somente após a concordância, use **Concordo com a captura para esta demonstração**.
4. Toque em **Capturar foto do rosto**. Autorize a câmera, enquadre apenas o participante e escolha **Tirar foto**.
5. Confira a prévia: **Refazer foto** repete a captura; **Confirmar foto** a seleciona para a emissão.
6. Desenhe a assinatura e escolha **Confirmar assinatura**. Um toque isolado ou quadro vazio não é aceito. **Limpar assinatura** permite refazer.
7. Preencha e confirme o PIN; toque em **Gerar cartão**.

A foto é enviada ao servidor ao gerar o cartão, após sua confirmação. **Refazer foto do cadastro** apaga o desenho e sua confirmação; desenhe e confirme a assinatura novamente após a nova foto. **Cancelar coleta autorizada** limpa as capturas do formulário. Trocar para o modo demonstração também limpa foto, assinatura, PIN e consentimento da emissão em preparo.

Essas ações de tela não excluem um cadastro já concluído no servidor. Se uma operação de emissão tiver sido enviada e a conexão cair, atualize a lista antes de repetir: cancelar a espera no aparelho não garante desfazer uma gravação que o servidor já realizou.

### 5.4 Usar QR Code, texto ou tag

Após emitir ou preparar um cartão ativo, a tela mostra seu QR Code e **Código para testar em outro aparelho**. Copie o conteúdo integral; não altere os campos ou a assinatura digital. Trate QR Code e JSON como dados pessoais de acesso, mesmo que o PIN continue necessário.

No aplicativo nativo, **Gravar na tag NFC** inicia a escrita. **Cancelar gravação** interrompe a operação em andamento. A tag deve estar configurada como NDEF, ser gravável e ter capacidade suficiente para o cartão inteiro. O aplicativo não configura do zero cartões DESFire. NTAG213/215 não comportam este formato; não corte o JSON para tentar fazê-lo caber. A capacidade e a compatibilidade física devem ser verificadas antes da aula.

### 5.5 Listar, preparar, bloquear e substituir

Em **Cartões emitidos**, use **Atualizar lista**. Cada item mostra nome, CPF parcialmente oculto e estado: **ativo**, **bloqueado** ou **substituído**.

| Ação | Procedimento e resultado |
| --- | --- |
| Preparar um cartão existente | No item ativo, **Preparar demonstração de [nome]**; depois use o botão de demonstração acima. Não troca o PIN nem cria outra emissão. |
| Bloquear por perda ou uso indevido | No item ativo, **Bloquear cartão de [nome]**. O cartão deixa de permitir novos acessos e suas sessões são recusadas na próxima consulta protegida. Não há botão de desbloqueio. |
| Emitir segunda via | Preencha novamente o formulário usando **o mesmo CPF**, capture/confirme os dados do modo escolhido e defina novo PIN. **Gerar cartão** cria outra emissão e marca as anteriores como substituídas. Não existe botão separado chamado “Segunda via”. |
| Recuperar PIN esquecido | Solicite nova emissão ao responsável. O sistema não revela o PIN antigo nem oferece recuperação por e-mail. |
| Usar cadastro antigo | Registros legados preservados na migração não aparecem como cartões ativos utilizáveis. Emita uma nova via com assinatura confirmada e PIN. |

Antes de bloquear, confira o item selecionado: a tela executa a ação diretamente. Uma segunda via não reativa a tag antiga; entregue e utilize o novo cartão. A biometria habilitada para a emissão anterior também não substitui o PIN do novo cartão.

## 6. Ajuda e recuperação de erros

| Situação | Como continuar |
| --- | --- |
| CPF incompleto ou diferente do cartão | Confira os onze números; no passo 2, use **Corrigir CPF**. |
| Código inválido ou alterado | Copie novamente o cartão completo a partir da área do responsável. |
| PIN incorreto | Confira o PIN da emissão atual. Aguarde eventual bloqueio temporário. Se esqueceu, peça segunda via. |
| Biometria cancelada ou indisponível | Preencha o PIN no formulário apresentado; se precisar abri-lo e o botão estiver visível, escolha **Usar PIN**. No navegador, o formulário aparece diretamente. |
| Câmera negada ou que não inicia | No login, use **Usar código em texto**. Na emissão, **Cancelar captura** e modo demonstração. Para coleta voluntária, o responsável pode ajustar a permissão do site/aparelho. |
| Confirmação expirada | **Ler cartão novamente** e repetir a confirmação. |
| Cartão bloqueado, substituído ou antigo | Use a emissão ativa mais recente ou solicite nova emissão ao responsável. |
| Serviço sem resposta | Peça ao operador para conferir API, MySQL e endereço da conexão. Uma falha de rede não é prova de PIN incorreto. |
| Emissão sem resposta após envio | **Atualizar lista** antes de emitir novamente. Reemitir o mesmo CPF substitui o cartão anterior. |

Não tente resolver indisponibilidade apagando o banco, os arquivos privados ou as chaves do servidor. O operador deve seguir [Operação e manutenção](OPERACAO-E-MANUTENCAO.md).

## 7. Acessibilidade e apoio

O fluxo do cidadão tem três passos visíveis, textos grandes, botões e campos de texto com altura mínima de 60 unidades e rótulos para tecnologias assistivas. **Ouvir instruções** repete a orientação da etapa; **Parar áudio** aparece enquanto uma fala está ativa. Avisos de erro são apresentados em texto, além do feedback disponível no aparelho.

A voz depende dos recursos do navegador ou sistema operacional. O aplicativo não possui seletor próprio de tamanho de fonte, tema ou contraste. Ampliação de texto, leitor de tela, foco e uso em telas pequenas precisam da conferência manual descrita em [Testes e qualidade](TESTES-E-QUALIDADE.md); não há declaração de certificação de acessibilidade.

A pessoa de apoio pode explicar a etapa e indicar o botão, mantendo o cidadão no controle. Use uma instrução por vez. Na demonstração, a assinatura fictícia permite continuar sem exigir coordenação motora para desenhar; a coleta real ainda não oferece alternativa completa ao desenho manual.

## 8. Roteiro de apresentação em sala

| Etapa | Demonstração | O que explicar |
| --- | --- | --- |
| Preparação | Confirmar conexão e iniciar a aplicação; manter a credencial administrativa fora da projeção. | Banco e API estão disponíveis; hardware é opcional. |
| Emissão | Criar pessoa fictícia no modo sem câmera e usar assinatura fictícia. | O responsável emite; o cidadão não acessa essa área. |
| Acesso | Preparar o cartão, passar pelos três passos e confirmar o PIN sem exibi-lo. | Cartão válido ainda precisa do segundo fator. |
| Consulta | Exibir **Meu cartão digital** e **Consultar meu acesso**. | A sessão consulta a situação atual do cartão. |
| Recusa | Em novo acesso, informar PIN incorreto uma vez. | O erro não concede acesso; existe recuperação. |
| Substituição | Encerrar, emitir novamente o mesmo CPF e tentar usar o cartão anterior. | A segunda via revoga a emissão anterior. |
| Encerramento | Sair da sessão e encerrar a área do responsável. | Explicar limites de foto, biometria e assinatura; não apresentar o sistema como identidade civil. |

Se houver dois aparelhos, a leitura de QR Code pode complementar o roteiro. NFC, captura real e biometria do aparelho são demonstrações adicionais, dependentes de preparação e validação física.

## 9. Referências de implementação

Os nomes de controles deste manual correspondem a [mobile/App.tsx](../mobile/App.tsx), [LoginScreen.tsx](../mobile/src/screens/LoginScreen.tsx), [EmissorScreen.tsx](../mobile/src/screens/EmissorScreen.tsx) e [SucessoScreen.tsx](../mobile/src/screens/SucessoScreen.tsx). Captura e desenho: [CapturaFoto.tsx](../mobile/src/components/CapturaFoto.tsx), [AssinaturaManuscrita.tsx](../mobile/src/components/AssinaturaManuscrita.tsx). Voz e controles: [ControleAudio.tsx](../mobile/src/components/ControleAudio.tsx), [Ui.tsx](../mobile/src/components/Ui.tsx) e [theme/index.ts](../mobile/src/theme/index.ts).

Para detalhes técnicos, consulte [Arquitetura](ARQUITETURA.md), [API](API.md) e [Banco de dados](BANCO-DE-DADOS.md). Atualize este manual quando rótulos, etapas ou critérios de acesso mudarem.
