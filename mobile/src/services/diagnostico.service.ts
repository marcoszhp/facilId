import { z } from 'zod';

const saudeSchema=z.object({
  status:z.enum(['ok','indisponivel']),
  api:z.object({status:z.literal('disponivel')}),
  persistencia:z.object({
    tipo:z.enum(['mysql','json','nao_informado']),
    status:z.enum(['disponivel','indisponivel','nao_verificada']),
  }),
});
export type Diagnostico=
  | {api:'acessivel';persistencia:z.infer<typeof saudeSchema>['persistencia']}
  | {api:'sem_resposta'}
  | {api:'incompativel'};

// Só um contrato coerente pode afirmar o estado do banco. Mensagens do servidor
// e do transporte nunca são apresentadas no diagnóstico.
export function interpretarSaude(statusHttp:number,dados:unknown):Diagnostico{
  const leitura=saudeSchema.safeParse(dados);
  if(!leitura.success)return {api:'incompativel'};
  const {status,persistencia}=leitura.data;
  const coerente=(statusHttp===200&&status==='ok'&&persistencia.status!=='indisponivel')
    ||(statusHttp===503&&status==='indisponivel'&&persistencia.status==='indisponivel');
  return coerente?{api:'acessivel',persistencia}:{api:'incompativel'};
}

export function textosDiagnostico(resultado:Diagnostico):{api:string;banco:string;orientacao:string}{
  if(resultado.api==='sem_resposta')return {
    api:'API: sem resposta.',banco:'Banco de dados: não verificado.',
    orientacao:'Confira a conexão e se o serviço está iniciado. Sem resposta da API, não é possível saber a situação do banco.',
  };
  if(resultado.api==='incompativel')return {
    api:'API: resposta incompatível.',banco:'Banco de dados: não verificado.',
    orientacao:'Confira o endereço configurado e se a versão do serviço oferece este diagnóstico.',
  };
  const {tipo,status}=resultado.persistencia;
  if(tipo==='json')return {
    api:'API: acessível.',banco:'MySQL: não utilizado. Armazenamento JSON de simulação.',
    orientacao:status==='indisponivel'?'O armazenamento da simulação está indisponível.':
      'Este modo de simulação não verifica uma conexão com MySQL.',
  };
  if(tipo==='nao_informado'||status==='nao_verificada')return {
    api:'API: acessível.',banco:'Banco de dados: não verificado.',
    orientacao:'O serviço não informou o tipo de armazenamento ou não executou a verificação.',
  };
  return {api:'API: acessível.',banco:status==='disponivel'?'MySQL: disponível.':'MySQL: indisponível.',
    orientacao:status==='disponivel'?'A API conseguiu consultar o banco nesta verificação.':
      'A API respondeu, mas não conseguiu consultar o banco. Confira o MySQL e a configuração do serviço.'};
}
