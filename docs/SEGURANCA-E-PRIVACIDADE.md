# Segurança e privacidade

[Índice da documentação](README.md)

**FácilID / AcessoSênior · referência: 26/09/2026**

Este documento descreve os controles existentes e seus limites. O FácilID é um protótipo escolar de acesso assistido; não é um sistema certificado de identificação civil. A existência de criptografia, consentimento na interface e testes automatizados não comprova adequação para uso real com dados pessoais.

## 1. Escopo e ativos protegidos

| Ativo | Localização e exposição |
| --- | --- |
| Identidade e histórico dos cartões | MySQL/MariaDB: `facilid_cartoes`, `facilid_pessoas`, `facilid_legados`, `facilid_migracoes`. CPF, nome e idade não têm cifra de aplicação no SQL. No modo JSON explícito, ficam em `DATA_DIR/usuarios.json`. |
| Cartão JSON, QR ou NFC | Contém identidade, referências por hash e assinatura RSA. É legível e copiável; assinatura não significa confidencialidade. |
| Foto e assinatura desenhada | Arquivos cifrados em `DATA_DIR/coletas/`; nenhuma rota pública entrega essas mídias. A consulta administrativa devolve somente metadados. |
| PIN e credenciais de aparelho | Índice cifrado `DATA_DIR/coletas/indice.bin`: salt/hash do PIN, hashes de credenciais e controle de tentativas. PIN em claro não é persistido. |
| Chaves do servidor | Par RSA em `DATA_DIR/keys/`, segredo JWT em `DATA_DIR/jwt.secret`, chave administrativa em `DATA_DIR/admin.token`, chave AES em `DATA_DIR/coletas/coleta.key`. JWT/admin podem vir do ambiente. |
| Sessão e credencial no aplicativo | Sessão em memória; credencial de aparelho no SecureStore nativo, protegida por autenticação do sistema. |

`DATA_DIR` é relativo à pasta `backend/`; o padrão é `backend/.local/`. Os caminhos acima indicam locais, nunca valores. Veja [banco de dados](BANCO-DE-DADOS.md) e [configuração](INSTALACAO-E-CONFIGURACAO.md).

## 2. Modelo de ameaças resumido

| Ameaça | Controle implementado | Limite que permanece |
| --- | --- | --- |
| Alterar CPF ou conteúdo do cartão | Schema estrito, CPF informado igual ao cartão, RSA e comparação com emissão registrada | A assinatura atesta dados emitidos pelo servidor, não a identidade civil da pessoa presente. |
| Copiar cartão ou QR | PIN ou credencial de aparelho exigido após leitura; estado consultado no servidor | O cartão continua copiável. CPF não é segredo; não deve contar como fator secreto. |
| Reutilizar confirmação ou confirmar em paralelo | Desafio curto, reserva antes de consultas assíncronas e consumo após sucesso | Desafios ficam em memória de uma instância; não existe coordenação entre servidores. |
| Adivinhar PIN | scrypt com salt aleatório, comparação constante e bloqueio de tentativas por emissão | PIN tem seis dígitos. Não há limitação geral por IP nem proteção completa contra exaustão de recursos. |
| Acessar área administrativa sem autorização | `X-Admin-Token`, comparação constante, autorização antes de parsers de foto/emissão | Token compartilhado: não há contas individuais, perfis de permissão ou trilha completa de auditoria. |
| Injetar SQL ou markup | Consultas parametrizadas; identificador de banco validado; SVG gerado de coordenadas validadas | Não substitui revisão de futuras consultas/rotas. Não há sanitização geral de qualquer conteúdo arbitrário. |
| Ler arquivos privados sem a chave AES | AES-256-GCM autenticado para foto, SVG e índice | Chave está na mesma árvore de dados; acesso à pasta completa compromete a proteção. |
| Interceptar tráfego na rede | Servidor inicia em loopback por padrão | HTTP local não oferece TLS. Expor a API em rede exige proteção adicional do transporte e do ambiente. |
| Perder consistência entre banco e mídia | Transações SQL e compensação de falhas comuns na emissão | Não existe transação única entre MySQL e arquivos; queda abrupta pode exigir reconciliação. |

Não há prova documentada de resistência a invasão do computador, administrador malicioso, aparelho comprometido ou ataques de carga. Esses cenários ultrapassam a demonstração atual.

## 3. Assinaturas, foto e biometria: garantias diferentes

### Assinatura digital do cartão

[`backend/src/services/assinatura.service.ts`](../backend/src/services/assinatura.service.ts) usa RSA-2048 com SHA-256. `canonicalizar()` fixa os campos e sua ordem antes da assinatura; `assinaturaService().validar()` detecta alteração desses campos. Versão, canonicalização e par de chaves não devem mudar sem estratégia de compatibilidade.

O nome `assinatura_digital_orgao` é um campo do protótipo. Não demonstra vínculo com autoridade certificadora, certificado de órgão público ou documento oficial. A chave privada é gerada localmente e deve permanecer privada.

### Foto e desenho manuscrito

A foto passa por validação de formato, estrutura, tamanho e dimensões. Não há comparação facial, detecção de presença, prova de vida ou decisão automática de identidade. A assinatura manuscrita é um desenho: o servidor gera SVG de coordenadas numéricas validadas, sem aceitar SVG arbitrário. Não verifica autoria ou semelhança com assinatura anterior.

No cartão, `rosto_hash` é SHA-256 dos bytes da foto; `assinatura_svg` contém `sha256:<hash>`, não a mídia. `digital_template` contém um marcador de ausência de coleta biométrica, não uma impressão digital. Hash não é anonimização quando vinculado ao cadastro e não serve como reconhecimento facial.

Fontes: [`backend/src/services/coleta.service.ts`](../backend/src/services/coleta.service.ts), [`backend/src/services/emissao.service.ts`](../backend/src/services/emissao.service.ts), [`backend/src/schemas/coleta.ts`](../backend/src/schemas/coleta.ts).

### Biometria do aparelho

Após PIN válido e solicitação de registro, o servidor gera uma credencial aleatória de 32 bytes, representada por 64 caracteres hexadecimais. Guarda somente seu hash; conserva até cinco hashes por emissão, removendo o mais antigo ao registrar além desse limite.

O aplicativo associa a credencial ao endereço do servidor e ao `emissaoId`. Usa SecureStore com `requireAuthentication: true` e `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. LocalAuthentication verifica disponibilidade; a leitura protegida da credencial exige autenticação nativa. Um booleano como “biometria aprovada” não libera sessão no servidor.

Não são enviados rosto, impressão digital ou template do sensor. A credencial é um segredo reutilizável: se extraído, pode ser usado até sua invalidação; não existe prova criptográfica remota do sensor. Em aparelho compartilhado, outra biometria cadastrada no sistema pode autorizar a leitura. O vínculo é com o aparelho/emissão, não uma comprovação de que o sensor pertence ao CPF. PIN permanece como alternativa, inclusive na web.

Fonte: [`mobile/src/services/biometria.service.ts`](../mobile/src/services/biometria.service.ts), [`mobile/src/services/biometria.service.web.ts`](../mobile/src/services/biometria.service.web.ts).

## 4. Autenticação, sessão e revogação

1. `POST /api/autenticar-nfc` valida formato, CPF, RSA, emissão ativa e existência da coleta. Devolve um desafio, ainda sem JWT; NFC, QR e texto seguem esse mesmo contrato.
2. O desafio expira em **dois minutos**. Há no máximo cinco por emissão e mil globais. Uma reserva impede duas confirmações simultâneas do mesmo desafio.
3. `POST /api/autenticar-confirmar` aceita **PIN ou credencial**, nunca ambos. Registrar aparelho exige PIN. Cinco falhas dentro de 30 segundos bloqueiam a emissão por 30 segundos; contadores persistem cifrados após reinício. Respostas limitadas usam `429`, `Retry-After` e `tentarEm`.
4. Após verificar o fator, o servidor consulta novamente o estado do cartão. Sucesso consome o desafio e emite JWT HS256 por **15 minutos**, com `issuer=facilid`, `audience=acessosenior`, `sub=cpf` e `emissaoId`.
5. `exigirSessao()` consulta emissão ativa e coleta em cada acesso protegido. Bloqueio ou segunda via invalida novos logins e consultas seguintes com a emissão anterior. Toda futura rota do cidadão deve aplicar esse middleware.

Sair do aplicativo limpa a sessão local, mas não cria uma lista de revogação individual de JWTs. Um token copiado pode permanecer utilizável enquanto válido e com cartão ativo. Reiniciar o backend elimina desafios pendentes; o cidadão precisa reler o cartão. Erro de banco segue como falha de infraestrutura, sem ser apresentado como credencial inválida.

Fontes: [`autenticacao.routes.ts`](../backend/src/routes/autenticacao.routes.ts), [`desafio.service.ts`](../backend/src/services/desafio.service.ts), [`auth.service.ts`](../backend/src/services/auth.service.ts), [`middleware/sessao.ts`](../backend/src/middleware/sessao.ts).

## 5. Proteção dos dados e da API

[`ArquivosColetasRepository`](../backend/src/repositories/coletas.repository.ts) cifra foto, SVG e índice separadamente com AES-256-GCM, IV aleatório e autenticação associada ao nome do registro. O PIN usa scrypt com salt aleatório de 16 bytes e saída de 32 bytes. O índice não expõe PINs ou hashes pelas rotas de metadados.

[`emissao.routes.ts`](../backend/src/routes/emissao.routes.ts) exige administrador antes dos parsers de 3 MB para foto e 64 KB para emissão. O parser geral aceita 16 KB. A imagem decodificada tem limite de 2 MB, lados de até 4096 pixels e até 12 milhões de pixels. São defesas de entrada, sem constituir inspeção antivírus ou validação biométrica.

[`app.ts`](../backend/src/app.ts) limita origens CORS, omite `X-Powered-By` e acrescenta `X-Request-Id`. Erros gerais não devolvem stack ou mensagem bruta de SQL. CORS é política do navegador, não autenticação: clientes fora do navegador ainda precisam dos controles de autorização. Swagger e saúde são públicos no servidor local.

`backend/.env` e `backend/.local/` estão ignorados no Git. Ignorar arquivos não é controle de acesso do sistema operacional; se `DATA_DIR` mudar, confirme também exclusão do Git e permissões da nova pasta. Em Windows, valide permissões de conta/pasta: modos POSIX presentes no código não garantem por si sós ACLs equivalentes. Não coloque segredos em variáveis `EXPO_PUBLIC_*`, capturas de tela, chamados, logs ou documentação.

## 6. Consentimento, retenção e uso em aula

O modo real exige `fotoId` e `consentimento=true`; o índice registra o indicador, o modo e o instante da coleta. Isso é um registro técnico simples. Não existe gestão de versão de termo, comprovação de consentimento esclarecido, fluxo de retirada ou política de retenção implementada. Sua presença não comprova conformidade legal.

Uploads pendentes expiram em 15 minutos, com máximo de 50; a limpeza ocorre ao iniciar/acessar operações do repositório, não por job contínuo. Fotos e desenhos associados a emissões permanecem armazenados. **Bloquear ou substituir cartão não apaga a coleta**, e não há fluxo administrativo completo de exclusão dos dados e suas cópias.

Para apresentações, prefira o modo demonstração e dados fictícios. Ele utiliza uma imagem artificial e não precisa de hardware; o desenho e o PIN ainda fazem parte da emissão. Não distribua QR/cartões de pessoas reais nos materiais da aula. Defina responsáveis, finalidade e tratamento dos dados antes de qualquer piloto real, com avaliação jurídica e organizacional apropriada fora deste documento.

## 7. Chaves, backup e incidentes

O backup coerente inclui banco, todo `DATA_DIR` e configuração privada necessária. Pare a API antes da cópia para evitar versões diferentes entre SQL e arquivos; proteja e restrinja o acesso ao backup. Confira restauração em ambiente separado, sem sobrescrever a base de uso. Procedimento completo: [operação e manutenção](OPERACAO-E-MANUTENCAO.md).

Não apague nem regenere chaves para resolver falhas de conexão. A perda da chave AES impede leitura das coletas; perder ou trocar o par RSA compromete continuidade dos cartões. Trocar o segredo JWT invalida sessões; trocar o token administrativo exige atualizar os responsáveis. Não há rotação automatizada de chaves com histórico de versões.

Em suspeita de cartão perdido, bloqueie a emissão e realize nova emissão assistida. Se o computador ou uma chave do servidor foi comprometido, restrinja o acesso, preserve evidências sem divulgar dados e avalie o alcance antes de restaurar ou trocar segredos. Bloquear um cartão isoladamente não resolve comprometimento do servidor. Evite publicar dumps, arquivos privados ou corpos de requisição para diagnosticar problemas; use mensagens sanitizadas e o identificador da requisição.

## 8. Requisitos ainda pendentes para uso real

- Transporte HTTPS e proteção do ambiente; usuário SQL com permissões mínimas apropriadas, sem depender do administrador local do XAMPP.
- Administradores individuais, controle de permissões, auditoria, recuperação assistida de acesso e gestão/revogação de aparelhos.
- Política operacional de retenção/exclusão, finalidade e consentimento, incluindo cópias de segurança.
- Gestão de chaves separada dos dados, rotação planejada, restauração comprovada e reconciliação após falhas entre SQL e arquivos.
- Proteção contra abuso e carga, observabilidade sem dados sensíveis e revisão independente de segurança.
- Validação em aparelhos reais e testes com o público-alvo. Mocks e exportação web não comprovam funcionamento de NFC, câmera ou biometria física.

O backend foi concebido para **uma instância**: coletas ficam em arquivos e desafios em memória. MySQL não remove essa restrição. Tags com NDEF continuam transportando uma credencial copiável; o aplicativo não utiliza autenticação criptográfica de um chip seguro. Reconhecimento facial, prova de vida e verificação de autoria de assinatura não estão implementados e exigiriam requisitos próprios antes de qualquer adoção.

Esta documentação não é laudo de segurança, certificação ou parecer de conformidade. O contrato operacional está em [API](API.md); o estado das verificações e suas limitações deve ser consultado nas evidências de validação do projeto.
