import { format, parseISO } from 'date-fns'

/** Formata uma data (YYYY-MM-DD ou ISO completo) como DD/MM/AAAA pra exibição. */
export function formatarData(data: string | null | undefined): string {
  if (!data) return '—'
  return format(parseISO(data), 'dd/MM/yyyy')
}
