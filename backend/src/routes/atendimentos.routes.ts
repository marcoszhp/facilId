import { RequestHandler, Router } from 'express';
import { z } from 'zod';
import { exigirSessao } from '../middleware/sessao';
import { AtendimentosRepository } from '../repositories/atendimentos.repository';
import { ColetasRepository } from '../repositories/coletas.repository';
import { UsuariosRepository } from '../repositories/usuarios.repository';
import { agendamentoSchema, atualizacaoAtendimentoSchema } from '../schemas/atendimento';
import { exigirAdministrador } from '../services/admin.service';
import { horariosDaGrade, novoAtendimento } from '../services/atendimento.service';
import { authService } from '../services/auth.service';

const semConsulta: RequestHandler = (req, res, next) => {
  if (Object.keys(req.query).length) {res.status(400).json({mensagem: 'Esta consulta não aceita parâmetros.'}); return;}
  next();
};
export function atendimentosRoutes(atendimentos: AtendimentosRepository, usuarios: UsuariosRepository, auth: ReturnType<typeof authService>, coletas: ColetasRepository, adminToken: string) {
  const router = Router(), sessao = exigirSessao(usuarios, auth, coletas), administrador = exigirAdministrador(adminToken);
  router.get('/atendimentos/horarios', sessao, semConsulta, async (_req, res) => {
    const grade = horariosDaGrade();
    const ocupados = new Set(grade.length ? await atendimentos.horariosOcupados(grade[0], grade[grade.length - 1]) : []);
    res.json({horarios: grade.filter(horario => !ocupados.has(horario))});
  });
  router.get('/atendimentos/meus', sessao, semConsulta, async (_req, res) => {
    res.json(await atendimentos.listar(res.locals.perfil.cpf));
  });
  router.post('/atendimentos', sessao, semConsulta, async (req, res) => {
    const dados = agendamentoSchema.safeParse(req.body);
    if (!dados.success) {res.status(400).json({mensagem: 'Envie somente um horário da grade no formato ISO UTC apresentado.'}); return;}
    res.status(201).json(await atendimentos.reservar(novoAtendimento(res.locals.perfil, dados.data.horario)));
  });
  router.get('/atendimentos', administrador, semConsulta, async (_req, res) => {res.json(await atendimentos.listar());});
  router.patch('/atendimentos/:id/status', administrador, semConsulta, async (req, res) => {
    const dados = atualizacaoAtendimentoSchema.safeParse(req.body);
    if (!z.string().uuid().safeParse(req.params.id).success || !dados.success) {res.status(400).json({mensagem: 'Informe um atendimento válido e o estado confirmado ou concluído.'}); return;}
    const atendimento = await atendimentos.atualizarStatus(req.params.id as string, dados.data.status);
    if (!atendimento) {res.status(404).json({mensagem: 'Atendimento não encontrado.'}); return;}
    res.json(atendimento);
  });
  return router;
}
