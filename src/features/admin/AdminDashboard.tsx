import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { hojeISO } from '../../lib/checkin'
import { useAulasCanceladas, aulaCanceladaEm } from '../../lib/aulas'
import { InstalarAppCard } from '../../components/InstalarAppCard'
import type { Profile, Checkin, Turma, Academia, AulaCancelada } from '../../types/database'

export function AdminDashboard() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [erro, setErro] = useState<string | null>(null)

  const academiaQuery = useQuery({
    queryKey: ['academia', profile?.academia_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academias')
        .select('*')
        .eq('id', profile!.academia_id)
        .single()
      if (error) throw error
      return data as Academia
    },
    enabled: !!profile,
  })

  const alunosQuery = useQuery({
    queryKey: ['alunos', profile?.academia_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('role', 'aluno')
      if (error) throw error
      return data as Profile[]
    },
    enabled: !!profile,
  })

  const checkinsHojeQuery = useQuery({
    queryKey: ['checkins-hoje', profile?.academia_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('checkins').select('*').eq('data', hojeISO())
      if (error) throw error
      return data as Checkin[]
    },
    enabled: !!profile,
  })

  const turmasQuery = useQuery({
    queryKey: ['turmas', profile?.academia_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('turmas').select('*').order('horario_inicio')
      if (error) throw error
      return data as Turma[]
    },
    enabled: !!profile,
  })

  const canceladasQuery = useAulasCanceladas(profile?.academia_id)

  const turmasHoje = useMemo(() => {
    const hoje = new Date().getDay()
    return (turmasQuery.data ?? []).filter((t) => t.dias_semana.includes(hoje))
  }, [turmasQuery.data])

  async function invalidarCanceladas() {
    await queryClient.invalidateQueries({ queryKey: ['aulas_canceladas', profile?.academia_id] })
  }

  async function cancelarAulaHoje(turma: Turma, motivo: string) {
    if (!profile || !motivo.trim()) return
    setErro(null)
    const { error } = await supabase.from('aulas_canceladas').insert({
      turma_id: turma.id,
      academia_id: profile.academia_id,
      data: hojeISO(),
      motivo: motivo.trim(),
      cancelado_por: profile.id,
    })
    if (error) {
      setErro(error.message)
      return
    }
    await invalidarCanceladas()
  }

  async function desfazerCancelamento(cancelada: AulaCancelada) {
    setErro(null)
    const { error } = await supabase.from('aulas_canceladas').delete().eq('id', cancelada.id)
    if (error) {
      setErro(error.message)
      return
    }
    await invalidarCanceladas()
  }

  return (
    <div className="flex flex-col gap-6">
      <InstalarAppCard />

      <h1 className="font-display text-2xl font-semibold text-chalk">Painel</h1>

      {academiaQuery.data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <LinkConvite titulo="Convite para aluno" codigo={academiaQuery.data.codigo_convite} />
          <LinkConvite
            titulo="Convite para professor"
            codigo={academiaQuery.data.codigo_convite_professor}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="font-mono text-xs uppercase tracking-wide text-rope">Alunos</p>
          <p className="mt-1 font-display text-3xl text-chalk">{alunosQuery.data?.length ?? '—'}</p>
        </Card>
        <Card>
          <p className="font-mono text-xs uppercase tracking-wide text-rope">Check-ins hoje</p>
          <p className="mt-1 font-display text-3xl text-hanko">
            {checkinsHojeQuery.data?.length ?? '—'}
          </p>
        </Card>
        <Card>
          <p className="font-mono text-xs uppercase tracking-wide text-rope">Turmas hoje</p>
          <p className="mt-1 font-display text-3xl text-chalk">{turmasHoje.length}</p>
        </Card>
      </div>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-rope">Aulas de hoje</h2>
        <div className="mt-3 flex flex-col gap-2">
          {turmasHoje.map((t) => (
            <AulaHojeCard
              key={t.id}
              turma={t}
              cancelada={aulaCanceladaEm(canceladasQuery.data, t.id, hojeISO())}
              onCancelar={(motivo) => cancelarAulaHoje(t, motivo)}
              onDesfazer={(cancelada) => desfazerCancelamento(cancelada)}
            />
          ))}
          {turmasHoje.length === 0 && <Card className="text-sm text-rope">Nenhuma turma hoje.</Card>}
        </div>
        {erro && <p className="mt-2 font-mono text-xs text-hanko">{erro}</p>}
      </section>

      <div className="flex flex-wrap gap-4">
        <Link to="/admin/alunos" className="font-mono text-xs text-rope hover:text-hanko">
          ver todos os alunos →
        </Link>
        <Link to="/admin/turmas" className="font-mono text-xs text-rope hover:text-hanko">
          gerenciar turmas →
        </Link>
        <Link to="/admin/professores" className="font-mono text-xs text-rope hover:text-hanko">
          gerenciar professores →
        </Link>
      </div>
    </div>
  )
}

function LinkConvite({ titulo, codigo }: { titulo: string; codigo: string }) {
  const [copiado, setCopiado] = useState(false)
  const link = `${window.location.origin}/convite/${codigo}`

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-mono text-xs uppercase tracking-wide text-rope">{titulo}</p>
        <p className="mt-1 truncate font-mono text-sm text-hanko">{link}</p>
      </div>
      <Button
        variant="secondary"
        onClick={async () => {
          await navigator.clipboard.writeText(link)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 1500)
        }}
      >
        {copiado ? 'Copiado ✓' : 'Copiar link'}
      </Button>
    </Card>
  )
}

function AulaHojeCard({
  turma,
  cancelada,
  onCancelar,
  onDesfazer,
}: {
  turma: Turma
  cancelada: AulaCancelada | undefined
  onCancelar: (motivo: string) => void
  onDesfazer: (cancelada: AulaCancelada) => void
}) {
  const [cancelando, setCancelando] = useState(false)

  if (cancelada) {
    return (
      <Card className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-chalk">{turma.nome}</p>
          <p className="font-mono text-xs text-hanko">Cancelada — {cancelada.motivo}</p>
        </div>
        <Button variant="ghost" onClick={() => onDesfazer(cancelada)}>
          Desfazer
        </Button>
      </Card>
    )
  }

  return (
    <Card className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-chalk">{turma.nome}</p>
        <p className="font-mono text-xs text-rope">
          {turma.horario_inicio.slice(0, 5)}–{turma.horario_fim.slice(0, 5)}
        </p>
      </div>
      {cancelando ? (
        <input
          autoFocus
          placeholder="Motivo (ex: feriado)"
          className="w-48 rounded-sm border border-rope-dim/50 bg-ink px-2.5 py-1.5 text-sm text-chalk focus:border-hanko focus:outline-none"
          onBlur={(e) => {
            if (e.target.value.trim()) onCancelar(e.target.value)
            setCancelando(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setCancelando(false)
          }}
        />
      ) : (
        <Button variant="ghost" onClick={() => setCancelando(true)}>
          Cancelar aula de hoje
        </Button>
      )}
    </Card>
  )
}
