import { Chip, Sessao } from '../src/services/identidade';

// Dados artificiais. Testes de tela verificam comportamento, não a criptografia da API.
export const cartao: Chip = {
  versao: 2,
  emissaoId: '8af815d4-3caa-43bc-9135-a5da406b9ef1',
  cpf: '12345678900',
  nome: 'Maria Fictícia',
  idade: 72,
  rosto_hash: 'a'.repeat(64),
  digital_template: 'DEMONSTRACAO_SEM_BIOMETRIA',
  assinatura_svg: 'sha256:' + 'b'.repeat(64),
  assinatura_digital_orgao: 'YXNzaW5hdHVyYS1maWN0aWNpYQ==',
};

export function desafio() {
  return { desafioId: 'f9a94c62-51d3-4386-8a4f-c47d399ade12', expiraEm: Date.now() + 120_000 };
}

export function cadastroDemo() {
  return {
    cpf: cartao.cpf, nome: cartao.nome, idade: cartao.idade,
    modo: 'demonstracao' as const,
    pin: '123456',
    assinatura: {
      largura: 320 as const, altura: 180 as const,
      tracos: [[{ x: 12, y: 70 }, { x: 90, y: 45 }, { x: 175, y: 92 }]],
    },
  };
}

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
