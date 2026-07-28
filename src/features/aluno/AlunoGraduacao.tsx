import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { useFaixasConfig, faixasDoTipo, estadoAtual, statusProgresso, rotuloEvento } from '../../lib/graduacao'
import { formatarData } from '../../lib/datas'
import { Card } from '../../components/Card'
import { Belt } from '../../components/Belt'
import { Meter } from '../../components/Meter'
import type { Checkin, Graduacao, Turma } from '../../types/database'

export function AlunoGraduacao() {
  const { profile } = useAuth()
  const faixasQuery = useFaixasConfig()

  const graduacoesQuery = useQuery({
    queryKey: ['graduacoes-historico', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('graduacoes')
        .select('*')
        .eq('aluno_id', profile!.id)
        .order('concedido_em', { ascending: false })
      if (error) throw error
      return data as Graduacao[]
    },
    enabled: !!profile,
  })

  const turmasQuery = useQuery({
    queryKey: ['turmas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('turmas').select('*')
      if (error) throw error
      return data as Turma[]
    },
    enabled: !!profile,
  })

  const turmaPrincipal = profile?.turma_principal_id
    ? turmasQuery.data?.find((t) => t.id === profile.turma_principal_id)
    : undefined
  const faixas = faixasDoTipo(faixasQuery.data ?? [], turmaPrincipal?.tipo_turma ?? 'adulto')
  const graduacoes = graduacoesQuery.data ?? []
  const estado = profile && faixas.length > 0 ? estadoAtual(graduacoes, faixas, profile.criado_em) : null

  const checkinsQuery = useQuery({
    queryKey: ['checkins-desde', profile?.id, estado?.desde],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .eq('aluno_id', profile!.id)
        .gt('data', estado!.desde)
      if (error) throw error
      return data as Checkin[]
    },
    enabled: !!profile && !!estado,
  })

  if (!estado) return null

  const status = statusProgresso(estado, faixas, checkinsQuery.data ?? [])

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col items-start gap-5 p-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-8 sm:p-8">
        <div className="sm:hidden">
          <Belt nome={estado.faixa.nome} grau={estado.grau} maxGraus={estado.faixa.graus_por_faixa} tamanho="md" />
        </div>
        <div className="hidden sm:block">
          <Belt nome={estado.faixa.nome} grau={estado.grau} maxGraus={estado.faixa.graus_por_faixa} tamanho="lg" />
        </div>
        <div className="w-full flex-1 sm:w-auto sm:min-w-[240px]">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-rope">Faixa atual</p>
          <h1 className="font-display text-2xl font-semibold text-chalk">
            {estado.faixa.nome}
            {estado.grau > 0 ? ` · ${estado.grau}º grau` : ''}
          </h1>
          <p className="mt-2 max-w-md text-sm text-rope">
            {status.ultimaFaixa
              ? 'Você atingiu a faixa mais alta desta sequência.'
              : status.elegivel
                ? `Elegível para ${status.proximaConcessaoPromove ? `a faixa ${status.proximaFaixa?.nome}` : 'o próximo grau'} — fale com o professor.`
                : `Faltam ${(status.aulasNecessarias ?? 0) - status.aulasFeitas} aulas para o próximo grau.`}
          </p>

          {!status.ultimaFaixa && (
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="font-mono uppercase tracking-wide text-rope">Progresso para o próximo grau</span>
                <span className="font-mono font-semibold tabular-nums text-chalk">
                  {status.aulasFeitas} / {status.aulasNecessarias} aulas
                </span>
              </div>
              <Meter fracao={status.aulasNecessarias ? status.aulasFeitas / status.aulasNecessarias : 0} />
            </div>
          )}
        </div>
      </Card>

      <Card className="p-8">
        <p className="mb-5 font-mono text-xs uppercase tracking-[0.14em] text-rope">Jornada de faixas</p>
        <div className="flex items-center">
          {faixas.map((f, i) => {
            const concluida = f.ordem < estado.faixa.ordem
            const atual = f.id === estado.faixa.id
            return (
              <div key={f.id} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold ${
                      atual
                        ? 'border-hanko bg-hanko text-paper ring-4 ring-hanko/20'
                        : concluida
                          ? 'border-mat bg-mat text-paper'
                          : 'border-rope-dim/40 bg-ink-soft text-rope'
                    }`}
                  >
                    {concluida ? '✓' : atual ? `${estado.grau}°` : f.ordem}
                  </div>
                  <span className={`font-mono text-xs ${atual ? 'text-hanko' : 'text-rope'}`}>{f.nome}</span>
                </div>
                {i < faixas.length - 1 && (
                  <div className={`mb-6 h-0.5 flex-1 ${concluida ? 'bg-mat' : 'bg-rope-dim/30'}`} />
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <Card className="p-0">
        <p className="p-5 pb-0 font-mono text-xs uppercase tracking-[0.14em] text-rope">Histórico de graduação</p>
        <div className="mt-3 divide-y divide-rope-dim/15">
          {graduacoes.map((g) => (
            <div key={g.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="font-medium text-chalk">
                {rotuloEvento(g, faixas.find((f) => f.id === g.faixa_id))}
              </span>
              <span className="font-mono text-xs text-rope">{formatarData(g.concedido_em)}</span>
            </div>
          ))}
          {graduacoes.length === 0 && (
            <p className="px-5 py-4 text-sm text-rope">
              Ainda sem histórico — você começa na faixa {faixas[0]?.nome}.
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
