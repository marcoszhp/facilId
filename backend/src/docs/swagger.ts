import swaggerJsdoc from 'swagger-jsdoc';
const ref = (name:string)=>({'$ref':`#/components/schemas/${name}`});
const response=(description:string,schema:object)=>({description,content:{'application/json':{schema}}});
const body=(schema:object)=>({required:true,content:{'application/json':{schema}}});
const cadastro={type:'object',additionalProperties:false,required:['cpf','nome','idade'],properties:{cpf:{type:'string',pattern:'^[0-9]{11}$',example:'12345678900'},nome:{type:'string',minLength:2,maxLength:100,example:'Maria Silva'},idade:{type:'integer',minimum:0,maximum:130,example:72}}};
export const swagger=swaggerJsdoc({definition:{openapi:'3.0.3',info:{title:'FácilID — demonstração local',version:'1.0.0',description:'Dados fictícios. Emissão e listagem administrativas abertas exclusivamente para demonstração local. Não há PIN neste fluxo.'},
  components:{securitySchemes:{bearerAuth:{type:'http',scheme:'bearer',bearerFormat:'JWT'}},schemas:{
    Cadastro:cadastro,Chip:{type:'object',additionalProperties:false,required:[...cadastro.required,'rosto_hash','digital_template','assinatura_svg','assinatura_digital_orgao'],properties:{...cadastro.properties,rosto_hash:{type:'string'},digital_template:{type:'string'},assinatura_svg:{type:'string'},assinatura_digital_orgao:{type:'string',description:'RSA-SHA256 em base64'}}},
    Erro:{type:'object',properties:{mensagem:{type:'string'}}},Perfil:{type:'object',properties:cadastro.properties},
    Sessao:{type:'object',properties:{sucesso:{type:'boolean'},token:{type:'string'},perfil:ref('Perfil')}}}},
  paths:{
    '/api/emissao':{post:{summary:'Emitir ou substituir cartão fictício',requestBody:body(ref('Cadastro')),responses:{'201':response('Cartão assinado',ref('Chip')),'400':response('Cadastro inválido',ref('Erro'))}}},
    '/api/usuarios':{get:{summary:'Listar cartões da demonstração',responses:{'200':response('Cartões',{type:'array',items:ref('Chip')}),'400':response('Consulta inválida',ref('Erro'))}}},
    '/api/autenticar-nfc':{post:{summary:'Autenticar com CPF e cartão',requestBody:body({type:'object',required:['cpfDigitado','dadosChip'],additionalProperties:false,properties:{cpfDigitado:cadastro.properties.cpf,dadosChip:ref('Chip')}}),responses:{'200':response('Sessão de 15 minutos',ref('Sessao')),'401':response('Autenticação recusada',ref('Erro'))}}},
    '/api/perfil':{get:{summary:'Consultar perfil com sessão válida',security:[{bearerAuth:[]}],responses:{'200':response('Perfil',ref('Perfil')),'401':response('Sessão inválida',ref('Erro'))}}}
  }},apis:[]});
