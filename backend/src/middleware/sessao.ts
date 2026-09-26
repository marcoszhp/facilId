import { RequestHandler } from 'express';
import { UsuariosRepository } from '../repositories/usuarios.repository';
import { authService } from '../services/auth.service';
import { ColetasRepository } from '../repositories/coletas.repository';

// Toda futura rota do cidadão deve usar este middleware, inclusive agendamentos.
export function exigirSessao(repo: UsuariosRepository, auth: ReturnType<typeof authService>, coletas: ColetasRepository): RequestHandler {
  return async (req, res, next) => {
    let claims: ReturnType<typeof auth.validar>;
    try {
      const authorization = req.header('Authorization') || '';
      if (!authorization.startsWith('Bearer ')) throw new Error();
      claims = auth.validar(authorization.slice(7));
      if (typeof claims === 'string' || !claims.sub || typeof claims.emissaoId !== 'string') throw new Error();
    } catch {
      res.status(401).json({mensagem: 'Sessão encerrada. Entre novamente com um cartão ativo.'});
      return;
    }
    // Falhas do banco seguem para o tratamento 500 do Express, sem encerrar uma
    // sessão válida por confundir indisponibilidade com uma credencial inválida.
    const registro = await repo.buscarEmissao(claims.emissaoId);
    if (!registro || registro.estado !== 'ativo' || registro.chip.cpf !== claims.sub || !coletas.obter(claims.emissaoId)) {
      res.status(401).json({mensagem: 'Sessão encerrada. Entre novamente com um cartão ativo.'});
      return;
    }
    res.locals.perfil = {cpf: registro.chip.cpf, nome: registro.chip.nome, idade: registro.chip.idade};
    res.locals.emissaoId = registro.chip.emissaoId;
    next();
  };
}
