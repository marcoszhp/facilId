import { Chip, Sessao } from '../src/services/identidade';

// Dados artificiais. Testes de tela verificam comportamento, não a criptografia da API.
export const cartao: Chip = {
  versao: 2,
  emissaoId: '8af815d4-3caa-43bc-9135-a5da406b9ef1',
  cpf: '12345678900',
  nome: 'Maria Fictícia',
  idade: 72,
  rosto_hash: 'rosto-ficticio',
  digital_template: 'digital-ficticia',
  assinatura_svg: 'M10 80 Q 52 10 100 80',
  assinatura_digital_orgao: 'YXNzaW5hdHVyYS1maWN0aWNpYQ==',
};

export function sessao(overrides: Partial<Sessao> = {}): Sessao {
  return {
    sucesso: true,
    token: 'sessao-ficticia-exclusiva-do-teste',
    expiraEm: Date.now() + 15 * 60 * 1000,
    perfil: { cpf: cartao.cpf, nome: cartao.nome, idade: cartao.idade },
    ...overrides,
  };
}

export function pendente<T>() {
  let resolver!: (value: T) => void;
  let rejeitar!: (reason: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => { resolver = resolve; rejeitar = reject; });
  return { promise, resolver, rejeitar };
}
