import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { statusCheckin, hojeISO } from '../../lib/checkin'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Badge } from '../../components/Badge'
import { Stamp } from '../../components/Stamp'
import type { Turma, Checkin, Graduacao } from '../../types/database'

export function AlunoDashboard() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [erro, setErro] = useState<string | null>(null)
  const [marcando, setMarcando] = useState<string | null>(null)

  const turmasQuery = useQuery({
    queryKey: ['turmas', profile?.academia_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('turmas').select('*').order('horario_inicio')
      if (error) throw error
      return data as Turma[]
    },
    enabled: !!profile,
  })

  const checkinsQuery = useQuery({
    queryKey: ['checkins', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .eq('aluno_id', profile!.id)
        .order('data', { ascending: false })
        .limit(30)
      if (error) throw error
      return data as Checkin[]
    },
    enabled: !!profile,
  })

  const graduacoesQuery = useQuery({
    queryKey: ['graduacoes', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('graduacoes')
        .select('*')
        .eq('aluno_id', profile!.id)
        .order('concedido_em', { ascending: false })
        .limit(1)
      if (error) throw error
      return data as Graduacao[]
    },
    enabled: !!profile,
  })

  const turmasHoje = useMemo(() => {
    const hoje = new Date().getDay()
    return (turmasQuery.data ?? []).filter((t) => t.dia_semana === hoje)
  }, [turmasQuery.data])

  const checkinsHoje = useMemo(() => {
    const hoje = hojeISO()
    return new Set((checkinsQuery.data ?? []).filter((c) => c.data === hoje).map((c) => c.turma_id))
  }, [checkinsQuery.data])

  async function fazerCheckin(turma: Turma) {
    if (!profile) return
    setErro(null)
    setMarcando(turma.id)
    try {
      const avulso = profile.turma_principal_id !== turma.id
      const { error } = await supabase.from('checkins').insert({
        aluno_id: profile.id,
        turma_id: turma.id,
        academia_id: profile.academia_id,
        data: hojeISO(),
        avulso,
      })
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['checkins', profile.id] })
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível fazer o check-in')
    } finally {
      setMarcando(null)
    }
  }

  const faixaAtual = graduacoesQuery.data?.[0]

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="font-display text-2xl font-semibold text-chalk">
          Olá, {profile?.nome?.split(' ')[0]}
        </h1>
        <p className="mt-2 text-sm text-rope">
          {faixaAtual ? (
            <>
              Faixa atual:{' '}
              <Badge tone="mat">
                {faixaAtual.faixa}
                {faixaAtual.grau ? ` · grau ${faixaAtual.grau}` : ''}
              </Badge>
            </>
          ) : (
            'Ainda sem graduação registrada'
          )}
        </p>
      </section>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-rope">Aulas de hoje</h2>
        <div className="mt-3 flex flex-col gap-3">
          {turmasHoje.length === 0 && (
            <Card className="text-sm text-rope">Nenhuma turma cadastrada para hoje.</Card>
          )}
          {turmasHoje.map((turma) => (
            <TurmaCheckinCard
              key={turma.id}
              turma={turma}
              principal={profile?.turma_principal_id === turma.id}
              jaFezCheckin={checkinsHoje.has(turma.id)}
              carregando={marcando === turma.id}
              onCheckin={() => fazerCheckin(turma)}
            />
          ))}
        </div>
        {erro && <p className="mt-2 font-mono text-xs text-hanko">{erro}</p>}
      </section>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-rope">Histórico de presença</h2>
        <Card className="mt-3 divide-y divide-rope-dim/15 p-0">
          {(checkinsQuery.data ?? []).length === 0 && (
            <p className="p-4 text-sm text-rope">Nenhum check-in ainda.</p>
          )}
          {(checkinsQuery.data ?? []).map((c) => {
            const turma = turmasQuery.data?.find((t) => t.id === c.turma_id)
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm text-chalk">{turma?.nome ?? 'Turma'}</p>
                  <p className="font-mono text-xs text-rope">{c.data}</p>
                </div>
                {c.avulso && <Badge>avulso</Badge>}
              </div>
            )
          })}
        </Card>
      </section>
    </div>
  )
}

function TurmaCheckinCard({
  turma,
  principal,
  jaFezCheckin,
  carregando,
  onCheckin,
}: {
  turma: Turma
  principal: boolean
  jaFezCheckin: boolean
  carregando: boolean
  onCheckin: () => void
}) {
  const status = statusCheckin(turma)
  return (
    <Card className="flex items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <p className="font-medium text-chalk">{turma.nome}</p>
          {principal && <Badge tone="hanko">principal</Badge>}
        </div>
        <p className="mt-1 font-mono text-xs text-rope">
          {turma.horario_inicio.slice(0, 5)}–{turma.horario_fim.slice(0, 5)}
        </p>
      </div>
      {jaFezCheckin ? (
        <Stamp className="h-10 w-10 shrink-0 text-mat-light" />
      ) : status.disponivel ? (
        <Button onClick={onCheckin} disabled={carregando}>
          {carregando ? 'Carimbando…' : 'Check-in'}
        </Button>
      ) : (
        <span className="whitespace-nowrap font-mono text-xs text-rope-dim">
          {status.motivo === 'antes-do-fim' && `libera às ${format(status.fim, 'HH:mm')}`}
          {status.motivo === 'janela-fechada' && 'janela encerrada'}
          {status.motivo === 'nao-e-hoje' && '—'}
        </span>
      )}
    </Card>
  )
}
