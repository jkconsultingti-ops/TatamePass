import { format } from 'date-fns'
import type { Turma } from '../types/database'

export type StatusCheckin =
  | { disponivel: true; abre: Date; fecha: Date }
  | { disponivel: false; motivo: 'nao-e-hoje' }
  | { disponivel: false; motivo: 'ainda-nao-abriu'; abre: Date }
  | { disponivel: false; motivo: 'janela-fechada'; abre: Date; fecha: Date }

function horarioParaData(horario: string, referencia: Date) {
  const [hora, minuto] = horario.split(':').map(Number)
  const data = new Date(referencia)
  data.setHours(hora, minuto, 0, 0)
  return data
}

export function statusCheckin(turma: Turma, agora = new Date()): StatusCheckin {
  if (!turma.dias_semana.includes(agora.getDay())) return { disponivel: false, motivo: 'nao-e-hoje' }

  const inicio = horarioParaData(turma.horario_inicio, agora)
  const fim = horarioParaData(turma.horario_fim, agora)

  const abre = new Date(inicio.getTime() - turma.janela_checkin_antes_horas * 3_600_000)
  const fecha = new Date(fim.getTime() + turma.janela_checkin_depois_horas * 3_600_000)

  if (agora < abre) return { disponivel: false, motivo: 'ainda-nao-abriu', abre }
  if (agora > fecha) return { disponivel: false, motivo: 'janela-fechada', abre, fecha }
  return { disponivel: true, abre, fecha }
}

export function hojeISO(agora = new Date()) {
  return format(agora, 'yyyy-MM-dd')
}
