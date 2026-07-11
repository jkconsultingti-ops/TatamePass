import { format } from 'date-fns'
import type { Turma } from '../types/database'

export type StatusCheckin =
  | { disponivel: true; fim: Date; limite: Date }
  | { disponivel: false; motivo: 'nao-e-hoje' }
  | { disponivel: false; motivo: 'antes-do-fim'; fim: Date }
  | { disponivel: false; motivo: 'janela-fechada'; fim: Date; limite: Date }

export function statusCheckin(turma: Turma, agora = new Date()): StatusCheckin {
  if (turma.dia_semana !== agora.getDay()) return { disponivel: false, motivo: 'nao-e-hoje' }

  const [horaFim, minutoFim] = turma.horario_fim.split(':').map(Number)
  const fim = new Date(agora)
  fim.setHours(horaFim, minutoFim, 0, 0)

  const limite = new Date(fim.getTime() + turma.janela_checkin_minutos * 60_000)

  if (agora < fim) return { disponivel: false, motivo: 'antes-do-fim', fim }
  if (agora > limite) return { disponivel: false, motivo: 'janela-fechada', fim, limite }
  return { disponivel: true, fim, limite }
}

export function hojeISO(agora = new Date()) {
  return format(agora, 'yyyy-MM-dd')
}
