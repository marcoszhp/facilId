# Referência da API

[Índice](README.md) · [Arquitetura](ARQUITETURA.md) · [Segurança](SEGURANCA-E-PRIVACIDADE.md)

## Contrato e convenções

API HTTP/JSON, base local padrão `http://127.0.0.1:3000`. O contrato OpenAPI 3.0.3 tem versão documental `2.1.0`. Consulte [openapi.json](openapi.json) para ferramentas ou `/docs` na API em execução para o Swagger interativo. Esse JSON é exportado de [swagger.ts](../backend/src/docs/swagger.ts), não de uma base de usuários.

`npm run docs:api` recompila o backend e atualiza o arquivo exportado; não inicia a API nem conecta ao banco. As validações efetivas permanecem nos [schemas](../backend/src/schemas/coleta.ts) e [routers](../backend/src/routes/autenticacao.routes.ts). Descrições de regras cruzadas também fazem parte do contrato: nem toda regra de negócio é expressa apenas pelo tipo de um campo.

| Convenção | Regra |
| --- | --- |
| Corpo | `Content-Type: application/json`; objetos de entrada são estritos, sem propriedades arbitrárias. |
| Administração | `X-Admin-Token`; obrigatório para emissão e gestão. Não é JWT de cidadão. |
| Cidadão | `Authorization: Bearer <token>` apenas nas rotas de sessão. |
| Identificadores | `emissaoId`, `fotoId`, `desafioId` são UUIDs. Não são intercambiáveis. |
| Tempo | `expiraEm`, `coletadoEm`, `tentarEm` em milissegundos Unix; claim JWT `exp` em segundos. |
| Correlação | `X-Request-Id` em todas as respostas; `requestId` no corpo de erros do tratador geral. |
| Limites de corpo | Foto 3 MB no parser/2 MB decodificada; emissão 64 KB; parser geral 16 KB. |
| Normalização | Cliente remove pontos, hífen e espaços do CPF. API espera exatamente 11 números. Nome é aparado pelo schema de cadastro. |

Erros 500 não significam senha incorreta ou sessão expirada. Clientes devem manter o contexto e permitir repetição apropriada; não substituir indisponibilidade por autenticação fictícia bem-sucedida.

## Tipos principais

| Tipo | Campos e significado |
| --- | --- |
| `Perfil` | `cpf:string`, `nome:string`, `idade:number`; nome 2–100 caracteres, idade inteira 0–130. |
| `Chip` | Perfil + `versao:2`, `emissaoId`, `rosto_hash`, `digital_template`, `assinatura_svg`, `assinatura_digital_orgao`. Não editar o objeto recebido: assinatura depende de seu conteúdo. |
| `ResumoCartao` | Perfil + `emissaoId` e `estado` (`ativo`, `bloqueado`, `substituido`); não contém assinatura RSA. |
| `Desenho` | `largura:320`, `altura:180`, `tracos` de pontos `{x,y}`. Até 32 traços, 512 pontos por traço e 1500 no total; pelo menos um segmento com deslocamento. |
| `DadosEmissao` | Perfil + `modo` (`real`/`demonstracao`), `assinatura:Desenho`, `pin` de seis números; no real, `fotoId` e `consentimento:true`. |
| `MetadadosColeta` | `modo`, `fotoHash`, `assinaturaHash`, `mimeType`, `coletadoEm`, `consentimento`. Sem foto/SVG/PIN/salt/credencial. |
| `Desafio` | `{desafioId,expiraEm}`; prazo de dois minutos, ainda sem sessão. |
| `Sessao` | `{sucesso:true,token,perfil,expiraEm}`; pode incluir `credencialDispositivo` apenas ao cadastrar aparelho. |

Os campos históricos `rosto_hash` e `assinatura_svg` armazenam hashes na emissão atual; `digital_template` é um marcador de ausência de template. `assinatura_digital_orgao` é base64 de RSA-SHA256. A API não oferece download público dos arquivos privados.

## Endpoints administrativos

Todas as operações desta seção exigem a chave administrativa. UUID inválido gera 400; falta de chave/chave incorreta gera 401. Não existe endpoint para criar uma conta administrativa ou recuperar a chave.

### POST `/api/emissao/foto`

Entrada: `{base64, mimeType}`, em que `mimeType` é `image/jpeg` ou `image/png` e base64 não contém prefixo `data:`. A imagem decodificada tem até 2 MB, até 4096 por dimensão e até 12 milhões de pixels. O servidor valida estrutura/dimensões, não identidade facial.

Saída 201: `{id, hash}`. A referência expira em 15 minutos e é consumida por uma emissão; não é URL. Há no máximo 50 uploads pendentes. Erros: 400 imagem inválida, 413 tamanho excedido, 429 excesso de pendências, 500 armazenamento indisponível. Autorização ocorre antes do parser grande.

### POST `/api/emissao`

Entrada `DadosEmissao`. Modo real exige referência de foto pendente e consentimento; modo demonstração rejeita `fotoId` e usa imagem artificial. O backend gera SVG de coordenadas validadas: não aceita markup SVG enviado pelo cliente.

Saída 201: `Chip` assinado com UUID novo. Nova emissão para o mesmo CPF torna cartões anteriores `substituido`. Erros: 400 cadastro/desenho/foto/PIN inválidos ou foto expirada; 413 corpo grande; 500 falha interna/persistência. O PIN nunca aparece no cartão nem na resposta.

### GET `/api/usuarios`

Saída 200: `ResumoCartao[]`, ordenado pelo histórico de emissão. Query parameters são recusados com 400. Não há paginação, busca por parâmetro ou listagem de `facilid_legados` nesta rota. Credencial assinada completa é obtida separadamente para cartão ativo.

### GET `/api/cartoes/:emissaoId`

Saída 200: `Chip` ativo, para responsável preparar demonstração/gravação. 404 se não encontrado; 409 se bloqueado ou substituído. A API não reativa cartão e não modifica sua assinatura.

### POST `/api/cartoes/:emissaoId/bloquear`

Sem campos obrigatórios de corpo; cliente atual envia `{}`. Saída 200: `{emissaoId,estado}`. Operação idempotente: ativo vira bloqueado, bloqueado permanece bloqueado e substituído permanece substituído. 404 quando ausente. Sessões são recusadas na próxima operação protegida.

### GET `/api/cartoes/:emissaoId/coleta`

Saída 200: `MetadadosColeta`. 404 se não há coleta para o UUID. A rota consulta metadados privados por emissão, inclusive históricos ainda retidos, e não serve mídia nem funciona como verificação de cartão ativo.

## Autenticação e sessão

### POST `/api/autenticar-nfc`

Apesar do nome, atende NFC, QR e texto pelo mesmo contrato. Entrada: `{cpfDigitado,dadosChip}`, com o **Chip completo, sem alterações**, retornado pela emissão.

Valida formato, CPF correspondente, assinatura RSA, registro ativo e presença de coleta/PIN. Saída 200: `Desafio`. Não retorna JWT. Recusas de cartão/formato/CPF/RSA/legado usam 401 com `{sucesso:false,mensagem}`. O limite global de desafios gera 429. Reiniciar o backend perde desafios pendentes, exigindo nova leitura.

### POST `/api/autenticar-confirmar`

Entrada: `desafioId` e **exatamente um** de `pin` ou `credencialDispositivo`. Credencial de aparelho tem 64 caracteres hexadecimais e só existe após cadastro autorizado. `registrarDispositivo:true` requer PIN.

Sucesso 200: `Sessao`; ao registrar aparelho, acrescenta `credencialDispositivo`, que o cliente deve guardar exclusivamente em armazenamento protegido pelo sistema. Não colocar no estado público da sessão, AsyncStorage, logs ou navegador.

| Status | Condição | Tratamento do cliente |
| --- | --- | --- |
| 400 | Corpo inválido, dois fatores juntos ou registro sem PIN. | Corrigir entrada; não repetir automaticamente. |
| 401 | Fator incorreto ou desafio expirado/consumido/cartão inválido. | Ler mensagem: PIN incorreto permite nova tentativa; expiração/revogação exige nova leitura/ajuda. |
| 409 | Outra requisição já reservou o mesmo desafio. | Aguardar a resposta em andamento. |
| 429 | Cinco erros no intervalo aplicável bloquearam a emissão. | Respeitar `Retry-After` em segundos e `tentarEm` em milissegundos. |
| 500 | Falha interna/armazenamento. | Oferecer repetição após recuperação; nenhum JWT foi entregue. |

Desafio bem-sucedido é consumido. Antes do JWT, o servidor relê o estado do cartão, pois pode ter ocorrido bloqueio ou segunda via enquanto aguardava o banco. A reserva é liberada em falha recuperável. Novo desafio não elimina o bloqueio persistido por emissão.

### GET `/api/perfil`

Exige Bearer JWT. Saída 200: `Perfil`. 401 indica token inválido/expirado, cartão revogado ou coleta ausente. 500 indica falha de persistência, não falha de autenticação. Toda chamada revalida o estado do cartão; um JWT ainda dentro dos 15 minutos não ignora bloqueio.

## Saúde e documentação

- GET `/health`: 200 `{status:"ok"}`; se a verificação de persistência falhar, 503 `{status:"indisponivel",mensagem:"Banco de dados indisponível."}`. O servidor MySQL usa `SELECT 1`; esse resultado não certifica sensores, backups ou toda a mídia.
- GET `/openapi.json`: contrato em execução. GET `/docs`: Swagger UI, com rotas que podem alterar dados quando acionadas. Use **Try it out** apenas em uma base apropriada à demonstração.
- Endereço desconhecido: 404 `{mensagem:"Endereço não encontrado."}`. Erros de parser/tamanho normalmente incluem `requestId` pelo tratador geral.

## Exemplo integrado de demonstração

O exemplo abaixo **emite um cartão artificial** e pode substituir emissão anterior do CPF fictício. Execute somente na sua base de demonstração, com a API já iniciada, a partir da raiz. O PIN mostrado pertence exclusivamente ao exemplo; não é padrão do sistema. Variáveis recebem segredos temporariamente em memória; não as imprima nem salve o transcript.

```powershell
$base = 'http://127.0.0.1:3000'
$admin = (Get-Content -Raw -LiteralPath backend/.local/admin.token).Trim()
# Se ADMIN_TOKEN estiver definido no servidor, use a mesma configuração privada.
$cadastro = @{
  cpf = '12345678900'; nome = 'Pessoa Ficticia'; idade = 72
  modo = 'demonstracao'; pin = '624815'
  assinatura = @{
    largura = 320; altura = 180
    tracos = ,@(@{x=20;y=120}, @{x=100;y=40}, @{x=240;y=110})
  }
}
$chip = Invoke-RestMethod "$base/api/emissao" -Method Post `
  -Headers @{'X-Admin-Token'=$admin} -ContentType 'application/json' `
  -Body ($cadastro | ConvertTo-Json -Depth 10)
$desafio = Invoke-RestMethod "$base/api/autenticar-nfc" -Method Post `
  -ContentType 'application/json' `
  -Body (@{cpfDigitado=$cadastro.cpf;dadosChip=$chip} | ConvertTo-Json -Depth 10)
$sessao = Invoke-RestMethod "$base/api/autenticar-confirmar" -Method Post `
  -ContentType 'application/json' `
  -Body (@{desafioId=$desafio.desafioId;pin=$cadastro.pin} | ConvertTo-Json)
$perfil = Invoke-RestMethod "$base/api/perfil" `
  -Headers @{Authorization="Bearer $($sessao.token)"}
# Confirme o perfil fictício localmente; não exponha o token nem o cartão.
Remove-Variable admin,cadastro,chip,desafio,sessao,perfil
```

Clientes nativos devem preferir o transporte existente em [api.service.ts](../mobile/src/services/api.service.ts), que separa cabeçalhos, normaliza CPF e aceita cancelamento. O servidor não deve receber uma simples flag de “biometria aprovada”.

[Próximo: testes e qualidade](TESTES-E-QUALIDADE.md)
