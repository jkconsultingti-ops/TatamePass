import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { ExameMedico } from '../types/database'

export type StatusExame = 'sem-registro' | 'pendente' | 'vencido' | 'vence-em-breve' | 'em-dia'

const DIAS_ALERTA_VENCIMENTO = 30

export function statusExameMedico(
  exame: ExameMedico | null | undefined,
  agora = new Date(),
): StatusExame {
  if (!exame) return 'sem-registro'
  if (exame.status === 'pendente') return 'pendente'
  if (!exame.validade) return 'sem-registro'
  const dias = differenceInCalendarDays(parseISO(exame.validade), agora)
  if (dias < 0) return 'vencido'
  if (dias <= DIAS_ALERTA_VENCIMENTO) return 'vence-em-breve'
  return 'em-dia'
}

export const ROTULO_STATUS_EXAME: Record<StatusExame, string> = {
  'sem-registro': 'Sem exame cadastrado',
  pendente: 'Em análise',
  vencido: 'Exame vencido',
  'vence-em-breve': 'Exame vence em breve',
  'em-dia': 'Exame em dia',
}

export const TONE_STATUS_EXAME = {
  'sem-registro': 'neutral',
  pendente: 'neutral',
  vencido: 'hanko',
  'vence-em-breve': 'rope',
  'em-dia': 'mat',
} as const

/** Data (YYYY-MM-DD) um ano depois da informada — usado pra sugerir a validade a partir da emissão. */
export function somarUmAno(dataISO: string): string {
  const data = parseISO(dataISO)
  data.setFullYear(data.getFullYear() + 1)
  return data.toISOString().slice(0, 10)
}
