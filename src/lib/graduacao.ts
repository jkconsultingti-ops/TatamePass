import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Checkin, FaixaConfig, Graduacao, TipoTurma } from '../types/database'

/** Traz as faixas dos dois tipos de turma de uma vez; use `faixasDoTipo` para filtrar. */
export function useFaixasConfig() {
  return useQuery({
    queryKey: ['faixas_config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('faixas_config').select('*').order('ordem')
      if (error) throw error
      return data as FaixaConfig[]
    },
  })
}

/** Faixas são pré-definidas por tipo de turma (adulto/infantil) — cada aluno
 * segue a sequência do tipo da turma principal dele (padrão: adulto). */
export function faixasDoTipo(faixas: FaixaConfig[], tipo: TipoTurma): FaixaConfig[] {
  return faixas.filter((f) => f.tipo_turma === tipo)
}

export type EstadoGraduacao = {
  faixa: FaixaConfig
  grau: number
  desde: string
}

/** Faixa/grau atuais a partir do histórico. Sem histórico, começa na 1ª faixa, grau 0. */
export function estadoAtual(
  graduacoes: Graduacao[],
  faixasOrdenadas: FaixaConfig[],
  criadoEm: string,
): EstadoGraduacao | null {
  if (faixasOrdenadas.length === 0) return null
  const ultima = [...graduacoes].sort((a, b) => b.concedido_em.localeCompare(a.concedido_em))[0]
  if (!ultima) return { faixa: faixasOrdenadas[0], grau: 0, desde: criadoEm }
  const faixa = faixasOrdenadas.find((f) => f.id === ultima.faixa_id)
  if (!faixa) return { faixa: faixasOrdenadas[0], grau: 0, desde: criadoEm }
  return { faixa, grau: ultima.grau ?? 0, desde: ultima.concedido_em }
}

export type StatusProgresso = {
  aulasFeitas: number
  aulasNecessarias: number | null
  elegivel: boolean
  ultimaFaixa: boolean
  proximaFaixa: FaixaConfig | null
  /** true = a próxima concessão promove de faixa; false = só concede grau na faixa atual */
  proximaConcessaoPromove: boolean
}

export function statusProgresso(
  estado: EstadoGraduacao,
  faixasOrdenadas: FaixaConfig[],
  checkinsDesde: Checkin[],
): StatusProgresso {
  const { faixa, grau } = estado
  const ultimaFaixa = faixa.graus_por_faixa === null || faixa.aulas_por_grau === null
  const proximaFaixa = ultimaFaixa
    ? null
    : (faixasOrdenadas.find((f) => f.ordem === faixa.ordem + 1) ?? null)

  const aulasFeitas = checkinsDesde.length
  const aulasNecessarias = faixa.aulas_por_grau
  const elegivel = !ultimaFaixa && aulasNecessarias !== null && aulasFeitas >= aulasNecessarias
  // graus_por_faixa é o número de graus que cabem na faixa (ex: 4) — só promove
  // depois de já ter esse número completo (o 5º "grau" é, na verdade, a troca de faixa).
  const proximaConcessaoPromove =
    !ultimaFaixa && faixa.graus_por_faixa !== null && grau + 1 > faixa.graus_por_faixa

  return { aulasFeitas, aulasNecessarias, elegivel, ultimaFaixa, proximaFaixa, proximaConcessaoPromove }
}

export function rotuloEvento(graduacao: Graduacao, faixa: FaixaConfig | undefined): string {
  if (!faixa) return 'Graduação'
  if (!graduacao.grau || graduacao.grau === 0) return `Promovido para ${faixa.nome}`
  return `${graduacao.grau}º grau — ${faixa.nome}`
}

/** Próximo evento a conceder: grau seguinte na mesma faixa, ou promoção para a próxima. */
export function proximoEvento(
  estado: EstadoGraduacao,
  status: StatusProgresso,
): { faixa_id: string; grau: number } | null {
  if (status.ultimaFaixa) return null
  if (status.proximaConcessaoPromove) {
    if (!status.proximaFaixa) return null
    return { faixa_id: status.proximaFaixa.id, grau: 0 }
  }
  return { faixa_id: estado.faixa.id, grau: estado.grau + 1 }
}
