import swaggerJsdoc from 'swagger-jsdoc';
const ref = (name: string) => ({'$ref': `#/components/schemas/${name}`});
const response = (description: string, schema: object) => ({description, content: {'application/json': {schema}}});
const body = (schema: object) => ({required: true, content: {'application/json': {schema}}});
const cadastro = {type: 'object', additionalProperties: false, required: ['cpf', 'nome', 'idade'], properties: {
  cpf: {type: 'string', pattern: '^[0-9]{11}$', example: '12345678900'},
  nome: {type: 'string', minLength: 2, maxLength: 100, example: 'Maria Silva'},
  idade: {type: 'integer', minimum: 0, maximum: 130, example: 72}
}};
const id = {type: 'string', format: 'uuid'};
const estado = {type: 'string', enum: ['ativo', 'bloqueado', 'substituido']};
const admin = [{adminToken: []}];
const parametroId = [{in: 'path', name: 'emissaoId', required: true, schema: id}];
const erroAdmin = {'401': response('Chave administrativa ausente ou incorreta', ref('Erro'))};
export const swagger = swaggerJsdoc({definition: {
  openapi: '3.0.3',
  info: {title: 'FácilID — demonstração local', version: '2.0.0', description: 'Dados fictícios. Rotas administrativas exigem X-Admin-Token, configurado por ADMIN_TOKEN ou .local/admin.token no servidor. Não forneça essa chave ao cidadão. Cartões v1 precisam de reemissão; o arquivo original é preservado na migração. Cartões copiáveis não provam presença física. Não há PIN neste fluxo.'},
  components: {
    securitySchemes: {
      bearerAuth: {type: 'http', scheme: 'bearer', bearerFormat: 'JWT'},
      adminToken: {type: 'apiKey', in: 'header', name: 'X-Admin-Token'}
    },
    schemas: {
      Cadastro: cadastro,
      Chip: {type: 'object', additionalProperties: false, required: [...cadastro.required, 'versao', 'emissaoId', 'rosto_hash', 'digital_template', 'assinatura_svg', 'assinatura_digital_orgao'], properties: {
        ...cadastro.properties, versao: {type: 'integer', enum: [2]}, emissaoId: id,
        rosto_hash: {type: 'string'}, digital_template: {type: 'string'}, assinatura_svg: {type: 'string'},
        assinatura_digital_orgao: {type: 'string', description: 'RSA-SHA256 em base64; cobre os campos de identidade, versao e emissaoId'}
      }},
      ResumoCartao: {type: 'object', properties: {...cadastro.properties, emissaoId: id, estado}},
      Erro: {type: 'object', properties: {mensagem: {type: 'string'}, requestId: {type: 'string', format: 'uuid', description: 'Correlação opcional; também disponível no cabeçalho X-Request-Id'}}},
      Perfil: {type: 'object', properties: cadastro.properties},
      Sessao: {type: 'object', required: ['sucesso', 'token', 'perfil', 'expiraEm'], properties: {
        sucesso: {type: 'boolean'}, token: {type: 'string'}, perfil: ref('Perfil'),
        expiraEm: {type: 'integer', format: 'int64', description: 'Instante de expiração em milissegundos desde Unix epoch'}
      }}
    }
  },
  paths: {
    '/api/emissao': {post: {
      summary: 'Emitir ou substituir cartão fictício', description: 'Toda emissão recebe UUID novo, mesmo com dados idênticos. Emissões anteriores do CPF e suas sessões ficam inválidas.',
      security: admin, requestBody: body(ref('Cadastro')),
      responses: {'201': response('Novo cartão assinado', ref('Chip')), '400': response('Cadastro inválido', ref('Erro')), ...erroAdmin}
    }},
    '/api/usuarios': {get: {
      summary: 'Listar histórico de emissões sem credenciais assinadas', security: admin,
      responses: {'200': response('Resumos dos cartões v2', {type: 'array', items: ref('ResumoCartao')}), '400': response('Consulta inválida', ref('Erro')), ...erroAdmin}
    }},
    '/api/cartoes/{emissaoId}': {get: {
      summary: 'Responsável recupera cartão ativo para a demonstração', security: admin, parameters: parametroId,
      responses: {'200': response('Cartão ativo', ref('Chip')), '400': response('Identificador inválido', ref('Erro')), '404': response('Cartão não encontrado', ref('Erro')), '409': response('Cartão bloqueado ou substituído', ref('Erro')), ...erroAdmin}
    }},
    '/api/cartoes/{emissaoId}/bloquear': {post: {
      summary: 'Bloquear cartão e revogar suas sessões', description: 'Operação idempotente; cartão substituído permanece substituído. Sessões são recusadas na próxima chamada protegida.',
      security: admin, parameters: parametroId,
      responses: {'200': response('Estado atual', {type: 'object', properties: {emissaoId: id, estado}}), '400': response('Identificador inválido', ref('Erro')), '404': response('Cartão não encontrado', ref('Erro')), ...erroAdmin}
    }},
    '/api/autenticar-nfc': {post: {
      summary: 'Autenticar com CPF e cartão v2 ativo', requestBody: body({type: 'object', required: ['cpfDigitado', 'dadosChip'], additionalProperties: false, properties: {cpfDigitado: cadastro.properties.cpf, dadosChip: ref('Chip')}}),
      responses: {'200': response('Sessão de 15 minutos vinculada à emissão', ref('Sessao')), '401': response('Autenticação recusada', ref('Erro'))}
    }},
    '/api/perfil': {get: {
      summary: 'Consultar perfil com sessão válida e cartão ativo', security: [{bearerAuth: []}],
      responses: {'200': response('Perfil', ref('Perfil')), '401': response('Sessão expirada, cartão bloqueado ou substituído', ref('Erro'))}
    }}
  }
}, apis: []});
