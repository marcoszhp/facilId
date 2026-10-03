import swaggerJsdoc from 'swagger-jsdoc';
const ref = (name: string) => ({'$ref': `#/components/schemas/${name}`});
const response = (description: string, schema: object) => ({description, headers: {'X-Request-Id': {description: 'Identificador de correlação, sem dados pessoais.', schema: {type: 'string', format: 'uuid'}}}, content: {'application/json': {schema}}});
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
const instante = {type: 'string', format: 'date-time', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$', description: 'ISO UTC canônico, com milissegundos e Z.'};
const erroSessao = {'401': response('Sessão expirada, cartão bloqueado ou substituído', ref('Erro'))};
const saude=(indisponivel:boolean)=>({type:'object',additionalProperties:false,required:['status','api','persistencia',...(indisponivel?['mensagem']:[])],properties:{
  status:{type:'string',enum:[indisponivel?'indisponivel':'ok']},
  api:{type:'object',additionalProperties:false,required:['status'],properties:{status:{type:'string',enum:['disponivel']}}},
  persistencia:{type:'object',additionalProperties:false,required:['tipo','status'],properties:{
    tipo:{type:'string',enum:['mysql','json','nao_informado']},
    status:{type:'string',enum:indisponivel?['indisponivel']:['disponivel','nao_verificada']},
  }},
  ...(indisponivel?{mensagem:{type:'string',example:'Banco de dados indisponível.'}}:{}),
}});
const desenho = {type:'object',additionalProperties:false,required:['largura','altura','tracos'],properties:{
  largura:{type:'integer',enum:[320]},altura:{type:'integer',enum:[180]},
  tracos:{type:'array',minItems:1,maxItems:32,description:'Até 1500 pontos no total; pelo menos um segmento com deslocamento após arredondar para 2 casas.',items:{type:'array',minItems:2,maxItems:512,items:{type:'object',additionalProperties:false,required:['x','y'],properties:{x:{type:'number',minimum:0,maximum:320},y:{type:'number',minimum:0,maximum:180}}}}}
}};
const emissao = {type:'object',additionalProperties:false,required:[...cadastro.required,'modo','assinatura','pin'],properties:{
  ...cadastro.properties, modo:{type:'string',enum:['real','demonstracao']}, fotoId:id,
  assinatura:desenho,pin:{type:'string',pattern:'^[0-9]{6}$',writeOnly:true},consentimento:{type:'boolean'}
},description:'No modo real, fotoId pendente e consentimento:true são obrigatórios. Demonstração usa imagem artificial e não aceita fotoId. PIN não integra o cartão e só é persistido com scrypt/salt dentro do índice cifrado.'};
export const swagger = swaggerJsdoc({definition: {
  openapi: '3.0.3',
  info: {title: 'FácilID — demonstração local', version: '2.1.0', description: 'Rotas administrativas exigem X-Admin-Token. Foto capturada e assinatura desenhada ficam cifradas no servidor; o cartão mantém apenas hashes, sem reconhecimento facial ou verificação de autoria. Biometria do aparelho protege uma credencial local; o servidor não recebe digital nem aceita um booleano como prova. CPF + cartão gera desafio; PIN ou credencial de aparelho previamente registrada confirma o acesso. Cartões anteriores sem coleta/PIN exigem reemissão. Use dados fictícios ou voluntários com consentimento.'},
  components: {
    securitySchemes: {
      bearerAuth: {type: 'http', scheme: 'bearer', bearerFormat: 'JWT'},
      adminToken: {type: 'apiKey', in: 'header', name: 'X-Admin-Token'}
    },
    schemas: {
      Cadastro: cadastro,
      Emissao: emissao,
      Desenho: desenho,
      Foto: {type:'object',additionalProperties:false,required:['base64','mimeType'],properties:{base64:{type:'string',format:'byte',maxLength:2796204,description:'JPEG/PNG sem prefixo data:, até 2 MB decodificados e 4096 por dimensão (máximo 12 MP).'},mimeType:{type:'string',enum:['image/jpeg','image/png']}}},
      ReferenciaFoto: {type:'object',required:['id','hash'],properties:{id,hash:{type:'string',pattern:'^[a-f0-9]{64}$'}},description:'Referência privada pendente, válida por 15 minutos e consumida por uma emissão; não é URL.'},
      Desafio: {type:'object',required:['desafioId','expiraEm'],properties:{desafioId:id,expiraEm:{type:'integer',format:'int64',description:'Expiração em Unix epoch milissegundos, 2 minutos. Não concede acesso.'}}},
      Confirmacao: {type:'object',additionalProperties:false,required:['desafioId'],properties:{desafioId:id,pin:{type:'string',pattern:'^[0-9]{6}$',writeOnly:true},credencialDispositivo:{type:'string',pattern:'^[a-f0-9]{64}$',writeOnly:true},registrarDispositivo:{type:'boolean'}},oneOf:[{required:['pin'],not:{required:['credencialDispositivo']}},{required:['credencialDispositivo'],not:{required:['pin']}}],description:'Exatamente PIN ou credencialDispositivo. registrarDispositivo:true somente com PIN. PIN incorreto permite repetir o desafio; sucesso o consome. Cinco falhas bloqueiam por 30 segundos, mesmo com novo desafio ou reinício.'},
      Coleta: {type:'object',properties:{modo:{type:'string',enum:['real','demonstracao']},fotoHash:{type:'string'},assinaturaHash:{type:'string'},mimeType:{type:'string'},coletadoEm:{type:'integer',format:'int64'},consentimento:{type:'boolean'}},description:'Somente metadados, nunca foto, SVG, PIN, salt ou credencial de aparelho.'},
      Chip: {type: 'object', additionalProperties: false, required: [...cadastro.required, 'versao', 'emissaoId', 'rosto_hash', 'digital_template', 'assinatura_svg', 'assinatura_digital_orgao'], properties: {
        ...cadastro.properties, versao: {type: 'integer', enum: [2]}, emissaoId: id,
        rosto_hash: {type: 'string',minLength:1,maxLength:128,description:'SHA-256 dos bytes da foto; modo demonstração usa imagem artificial.'}, digital_template: {type: 'string',minLength:1,maxLength:128,description:'Marcador BIOMETRIA_LOCAL_NAO_COLETADA ou DEMONSTRACAO_SEM_BIOMETRIA, nunca um template biométrico.'}, assinatura_svg: {type: 'string',minLength:1,maxLength:300,description:'Nome legado: agora armazena sha256:<hash do SVG gerado de coordenadas>, não o SVG.'},
        assinatura_digital_orgao: {type: 'string',pattern:'^[A-Za-z0-9+/]+={0,2}$',maxLength:1024, description: 'RSA-SHA256 em base64; cobre os campos de identidade, versao e emissaoId'}
      }},
      EventoAdministrativo: {type: 'object', additionalProperties: false, required: ['id', 'emissaoId', 'cpf', 'nome', 'tipo', 'ocorridoEm', 'motivo'], properties: {
        id, emissaoId: id, cpf: cadastro.properties.cpf, nome: cadastro.properties.nome,
        tipo: {type: 'string', enum: ['emissao', 'bloqueio', 'substituicao']}, ocorridoEm: instante,
        motivo: {type: 'string', description: 'Descrição fixa da operação, definida pelo servidor, sem texto livre nem operador individual.'}
      }},
      ResumoCartao: {type: 'object', properties: {...cadastro.properties, emissaoId: id, estado}},
      PaginaCartoes: {type: 'object', additionalProperties: false, required: ['itens', 'total', 'pagina', 'limite'], properties: {
        itens: {type: 'array', items: ref('ResumoCartao')}, total: {type: 'integer', minimum: 0},
        pagina: {type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER}, limite: {type: 'integer', minimum: 1, maximum: 100}
      }},
      Erro: {type: 'object', properties: {mensagem: {type: 'string'}, sucesso:{type:'boolean',enum:[false],description:'Presente nas recusas da primeira etapa de autenticação.'}, tentarEm:{type:'integer',format:'int64',description:'Retomada após limite de fatores, em Unix epoch milissegundos.'}, requestId: {type: 'string', format: 'uuid', description: 'Correlação opcional; também disponível no cabeçalho X-Request-Id'}}},
      Perfil: {type: 'object', properties: cadastro.properties},
      Atendimento: {type: 'object', additionalProperties: false, required: ['id', 'protocolo', 'cpf', 'nome', 'horario', 'status', 'criadoEm', 'atualizadoEm'], properties: {
        id, protocolo: {type: 'string', pattern: '^FID-[A-F0-9]{12}$'}, cpf: cadastro.properties.cpf, nome: cadastro.properties.nome,
        horario: instante, status: {type: 'string', enum: ['agendado', 'confirmado', 'concluido']}, criadoEm: instante, atualizadoEm: instante
      }, description: 'Atendimento simulado na secretaria. CPF e nome vêm exclusivamente da sessão; o histórico permanece vinculado ao CPF após reemissão do cartão.'},
      Sessao: {type: 'object', required: ['sucesso', 'token', 'perfil', 'expiraEm'], properties: {
        sucesso: {type: 'boolean'}, token: {type: 'string'}, perfil: ref('Perfil'),
        expiraEm: {type: 'integer', format: 'int64', description: 'Instante de expiração em milissegundos desde Unix epoch'},
        credencialDispositivo: {type:'string',pattern:'^[a-f0-9]{64}$',description:'Retornada somente ao registrar com PIN. Cliente deve guardá-la exclusivamente em armazenamento protegido por autenticação do sistema, nunca AsyncStorage/web.'}
      }}
    }
  },
  paths: {
    '/api/atendimentos/horarios': {get: {summary: 'Consultar horários disponíveis da secretaria simulada', security: [{bearerAuth: []}], description: 'Hoje até hoje+13 em America/Sao_Paulo, segunda a sexta às 9h, 10h, 11h, 14h e 15h. Sem calendário de feriados. Retorna somente instantes futuros ainda livres. A reserva pode disputar um horário já apresentado; nesse caso POST retorna 409. Não aceita parâmetros de consulta.', responses: {
      '200': response('Horários em ISO UTC', {type: 'object', required: ['horarios'], properties: {horarios: {type: 'array', items: instante}}}), '400': response('Consulta inválida', ref('Erro')), ...erroSessao
    }}},
    '/api/atendimentos': {
      post: {summary: 'Agendar atendimento simulado para o cidadão da sessão', security: [{bearerAuth: []}], description: 'Reserva exclusiva e persistente por horário. Corpo estrito: CPF/nome enviados pelo cliente são recusados. Repetir uma reserva existente retorna 409; consulte meus atendimentos quando a resposta anterior tiver sido perdida.', requestBody: body({type: 'object', additionalProperties: false, required: ['horario'], properties: {horario: instante}}), responses: {
        '201': response('Atendimento agendado com protocolo', ref('Atendimento')), '400': response('Corpo inválido, horário passado ou fora da grade', ref('Erro')), '409': response('Horário ou protocolo já reservado; atualize a lista e escolha novamente', ref('Erro')), ...erroSessao
      }},
      get: {summary: 'Responsável consulta todos os atendimentos simulados', security: admin, description: 'Ordenados por horário; não aceita parâmetros de consulta.', responses: {'200': response('Atendimentos', {type: 'array', items: ref('Atendimento')}), '400': response('Consulta inválida', ref('Erro')), ...erroAdmin}}
    },
    '/api/atendimentos/meus': {get: {summary: 'Consultar somente os atendimentos do CPF autenticado', security: [{bearerAuth: []}], description: 'CPF sempre vem do JWT revalidado. Ordenados por horário; não aceita filtros ou parâmetros de consulta.', responses: {'200': response('Atendimentos do cidadão', {type: 'array', items: ref('Atendimento')}), '400': response('Consulta inválida', ref('Erro')), ...erroSessao}}},
    '/api/atendimentos/{id}/status': {patch: {summary: 'Responsável avança o estado de um atendimento', security: admin, parameters: [{in: 'path', name: 'id', required: true, schema: id}], description: 'Somente agendado → confirmado → concluido. Repetir o estado atual é idempotente e preserva atualizadoEm; não permite saltar uma etapa ou voltar.', requestBody: body({type: 'object', additionalProperties: false, required: ['status'], properties: {status: {type: 'string', enum: ['confirmado', 'concluido']}}}), responses: {'200': response('Atendimento atualizado', ref('Atendimento')), '400': response('Identificador ou corpo inválido', ref('Erro')), '404': response('Atendimento não encontrado', ref('Erro')), '409': response('Transição não permitida', ref('Erro')), ...erroAdmin}}},
    '/health': {get: {summary:'Verificar API e persistência sem credenciais',description:'API disponível significa que este endpoint respondeu. No servidor MySQL executa SELECT 1; JSON identifica a simulação sem MySQL e não testa escrita em arquivos. Repositório customizado sem tipo declarado usa nao_informado; sem verificador usa nao_verificada. Não expõe host, URL, credenciais ou erros do driver. API sem resposta não permite concluir o estado do banco, inclusive se o banco impediu a inicialização do servidor. Não autentica cidadão nem certifica câmera, NFC, biometria ou integridade de todas as coletas.',responses:{
      '200':response('API acessível; conferir tipo e status da persistência',saude(false)),
      '503':response('API acessível, verificação da persistência falhou',saude(true))
    }}},
    '/api/emissao': {post: {
      summary: 'Emitir cartão com foto, assinatura desenhada e PIN', description: 'Toda emissão recebe UUID novo. Cartão anterior, suas sessões e credenciais de aparelho ficam inválidos. Corpo limitado a 64 KB; RSA/canonicalizador preservados.',
      security: admin, requestBody: body(ref('Emissao')),
      responses: {'201': response('Novo cartão assinado', ref('Chip')), '400': response('Cadastro inválido', ref('Erro')), ...erroAdmin}
    }},
    '/api/emissao/foto': {post:{summary:'Enviar foto privada de uma emissão',description:'Autorização administrativa é conferida antes do parser de 3 MB. Imagem decodificada limitada a 2 MB, formato/dimensões verificados. Até 50 pendências; limpeza de expiradas ao iniciar ou operar o repositório.',security:admin,requestBody:body(ref('Foto')),responses:{'201':response('Referência de uso único',ref('ReferenciaFoto')),'400':response('Formato inválido',ref('Erro')),'413':response('Foto ou corpo grande demais',ref('Erro')),'429':response('Muitas fotos pendentes',ref('Erro')),...erroAdmin}}},
    '/api/eventos': {get: {
      summary: 'Consultar histórico administrativo de cartões', security: admin,
      description: 'Eventos de emissão, bloqueio e substituição gravados atomicamente com o estado do cartão. Mais recentes primeiro, por ocorridoEm e, em empate, pela ordem inversa de gravação. Não aceita parâmetros de consulta. Repetir bloqueio ou substituir cartão já substituído não duplica eventos. Dados anteriores à implantação ficam sem eventos retroativos. Motivos são definidos pelo servidor; não inclui operador individual, PIN, credenciais ou mídias.',
      responses: {'200': response('Eventos administrativos', {type: 'array', items: ref('EventoAdministrativo')}), '400': response('Consulta inválida', ref('Erro')), ...erroAdmin}
    }},
    '/api/usuarios': {get: {
      summary: 'Listar histórico de emissões sem credenciais assinadas', security: admin,
      description: 'Sem parâmetros, preserva o retorno ResumoCartao[]. Para paginar, envie pagina e limite juntos, uma única vez cada, como inteiros positivos seguros escritos somente com dígitos, sem zeros iniciais. Limite máximo 100. Parâmetros desconhecidos, repetidos, parciais ou malformados retornam 400; a autorização administrativa precede a validação da consulta. A ordem original é preservada e páginas além do total retornam itens vazios. Atualmente a listagem completa é fatiada em memória; para volumes maiores, mover contagem e paginação para SQL.',
      parameters: [
        {in: 'query', name: 'pagina', required: false, description: 'Obrigatório junto com limite; primeira página é 1.', schema: {type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER}, example: 1},
        {in: 'query', name: 'limite', required: false, description: 'Obrigatório junto com pagina; no máximo 100 cartões por página.', schema: {type: 'integer', minimum: 1, maximum: 100}, example: 20}
      ],
      responses: {'200': response('Array sem consulta; objeto paginado quando pagina e limite são enviados', {oneOf: [{type: 'array', items: ref('ResumoCartao')}, ref('PaginaCartoes')]}), '400': response('Consulta inválida', ref('Erro')), ...erroAdmin}
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
    '/api/cartoes/{emissaoId}/coleta': {get:{summary:'Consultar somente metadados da coleta',security:admin,parameters:parametroId,responses:{'200':response('Metadados privados',ref('Coleta')),'400':response('Identificador inválido',ref('Erro')),'404':response('Coleta não encontrada',ref('Erro')),...erroAdmin}}},
    '/api/autenticar-nfc': {post: {
      summary: 'Iniciar verificação com CPF e cartão ativo', description:'Esta etapa nunca emite JWT. É necessário confirmar o segundo fator.',requestBody: body({type: 'object', required: ['cpfDigitado', 'dadosChip'], additionalProperties: false, properties: {cpfDigitado: cadastro.properties.cpf, dadosChip: ref('Chip')}}),
      responses: {'200': response('Desafio de 2 minutos', ref('Desafio')), '401': response('Cartão recusado ou precisa de reemissão', ref('Erro')),'429':response('Muitos desafios pendentes',ref('Erro'))}
    }},
    '/api/autenticar-confirmar': {post:{summary:'Confirmar PIN ou credencial protegida do aparelho',requestBody:body(ref('Confirmacao')),responses:{'200':response('Sessão de 15 minutos',ref('Sessao')),'400':response('Escolha inválida de fator',ref('Erro')),'401':response('Fator incorreto, desafio vencido/consumido ou cartão revogado',ref('Erro')),'409':response('Uma confirmação já reservou este desafio; aguarde sua resposta',ref('Erro')),'429':{...response('Tentativas limitadas por emissão; Retry-After informa a espera',ref('Erro')),headers:{...response('',{}).headers,'Retry-After':{description:'Segundos até uma nova tentativa; pelo menos 1.',schema:{type:'integer',minimum:1}}}}}}},
    '/api/perfil': {get: {
      summary: 'Consultar perfil com sessão válida e cartão ativo', security: [{bearerAuth: []}],
      responses: {'200': response('Perfil', ref('Perfil')), '401': response('Sessão expirada, cartão bloqueado ou substituído', ref('Erro'))}
    }}
  }
}, apis: []});

// Respostas comuns dos parsers e do tratador geral já existentes no app.
// Esta declaração complementa a documentação sem alterar as rotas.
const operacoes=(swagger as {paths:Record<string,Record<string,{responses:Record<string,unknown>}>>}).paths;
for(const [rota,metodos] of Object.entries(operacoes)){
  if(!rota.startsWith('/api/'))continue;
  for(const [metodo,operacao] of Object.entries(metodos)){
    operacao.responses['500']=response('Falha interna ou de persistência; não indica credencial inválida',ref('Erro'));
    if(metodo==='post'||metodo==='patch'){
      operacao.responses['400']??=response('JSON em formato inválido',ref('Erro'));
      operacao.responses['413']??=response('Corpo maior que o limite do endpoint',ref('Erro'));
    }
  }
}
