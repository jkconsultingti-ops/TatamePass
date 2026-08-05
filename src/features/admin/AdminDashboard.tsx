import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { format, startOfMonth } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Meter } from '../../components/Meter'
import { hojeISO } from '../../lib/checkin'
import { useAulasCanceladas, aulaCanceladaEm } from '../../lib/aulas'
import { useFaixasConfig, faixasDoTipo, estadoAtual, statusProgresso } from '../../lib/graduacao'
import { statusExameMedico } from '../../lib/exameMedico'
import { InstalarAppCard } from '../../components/InstalarAppCard'
import { GraficoFaixas } from '../professor/GraficoFaixas'
import type {
  Profile,
  Checkin,
  Turma,
  Academia,
  AulaCancelada,
  ExameMedico,
  Graduacao,
} from '../../types/database'

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

  const examesQuery = useQuery({
    queryKey: ['exames_medicos', profile?.academia_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('exames_medicos').select('*')
      if (error) throw error
      return data as ExameMedico[]
    },
    enabled: !!profile,
  })

  const graduacoesQuery = useQuery({
    queryKey: ['graduacoes-todas', profile?.academia_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('graduacoes').select('*')
      if (error) throw error
      return data as Graduacao[]
    },
    enabled: !!profile,
  })

  const checkinsTotaisQuery = useQuery({
    queryKey: ['checkins-todos', profile?.academia_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('checkins').select('*')
      if (error) throw error
      return data as Checkin[]
    },
    enabled: !!profile,
  })

  const faixasQuery = useFaixasConfig()

  const turmasHoje = useMemo(() => {
    const hoje = new Date().getDay()
    return (turmasQuery.data ?? []).filter((t) => t.dias_semana.includes(hoje))
  }, [turmasQuery.data])

  const alertasExame = useMemo(() => {
    const porAluno = new Map((examesQuery.data ?? []).map((e) => [e.aluno_id, e]))
    let vencidos = 0
    let venceEmBreve = 0
    for (const aluno of alunosQuery.data ?? []) {
      const status = statusExameMedico(porAluno.get(aluno.id))
      if (status === 'vencido') vencidos += 1
      if (status === 'vence-em-breve') venceEmBreve += 1
    }
    return { vencidos, venceEmBreve }
  }, [examesQuery.data, alunosQuery.data])

  const turmaPorId = useMemo(
    () => new Map((turmasQuery.data ?? []).map((t) => [t.id, t])),
    [turmasQuery.data],
  )

  const graduacoesPorAluno = useMemo(() => {
    const mapa = new Map<string, Graduacao[]>()
    for (const g of graduacoesQuery.data ?? []) {
      const lista = mapa.get(g.aluno_id) ?? []
      lista.push(g)
      mapa.set(g.aluno_id, lista)
    }
    return mapa
  }, [graduacoesQuery.data])

  const checkinsPorAluno = useMemo(() => {
    const mapa = new Map<string, Checkin[]>()
    for (const c of checkinsTotaisQuery.data ?? []) {
      const lista = mapa.get(c.aluno_id) ?? []
      lista.push(c)
      mapa.set(c.aluno_id, lista)
    }
    return mapa
  }, [checkinsTotaisQuery.data])

  // Faixa/grau atual + elegibilidade de cada aluno — mesmo cálculo usado em
  // ProfessorGraduacao.tsx, refeito aqui só pra alimentar o tile "Elegíveis".
  const roster = useMemo(() => {
    const faixasTodas = faixasQuery.data ?? []
    if (faixasTodas.length === 0) return []
    return (alunosQuery.data ?? []).flatMap((aluno) => {
      const turma = aluno.turma_principal_id ? turmaPorId.get(aluno.turma_principal_id) : undefined
      const faixasDoAluno = faixasDoTipo(faixasTodas, turma?.tipo_turma ?? 'adulto')
      if (faixasDoAluno.length === 0) return []
      const estado = estadoAtual(graduacoesPorAluno.get(aluno.id) ?? [], faixasDoAluno, aluno.criado_em)!
      const checkinsDesde = (checkinsPorAluno.get(aluno.id) ?? []).filter((c) => c.data > estado.desde)
      const status = statusProgresso(estado, faixasDoAluno, checkinsDesde)
      return [{ aluno, estado, status }]
    })
  }, [alunosQuery.data, faixasQuery.data, graduacoesPorAluno, checkinsPorAluno, turmaPorId])

  const elegiveis = useMemo(() => roster.filter((r) => r.status.elegivel).length, [roster])

  const distribuicaoFaixas = useMemo(() => {
    const faixasAdulto = faixasDoTipo(faixasQuery.data ?? [], 'adulto')
    const contagem = new Map<string, number>()
    for (const r of roster) contagem.set(r.estado.faixa.id, (contagem.get(r.estado.faixa.id) ?? 0) + 1)
    return faixasAdulto.map((f) => ({ nome: f.nome, quantidade: contagem.get(f.id) ?? 0 }))
  }, [faixasQuery.data, roster])

  const checkinsPorTurmaMes = useMemo(() => {
    const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const porTurma = new Map<string, number>()
    for (const c of checkinsTotaisQuery.data ?? []) {
      if (c.data < inicioMes) continue
      porTurma.set(c.turma_id, (porTurma.get(c.turma_id) ?? 0) + 1)
    }
    return (turmasQuery.data ?? [])
      .map((t) => ({ nome: t.nome, quantidade: porTurma.get(t.id) ?? 0 }))
      .sort((a, b) => b.quantidade - a.quantidade)
  }, [checkinsTotaisQuery.data, turmasQuery.data])

  const maiorCheckinTurmaMes = Math.max(1, ...checkinsPorTurmaMes.map((t) => t.quantidade))

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

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3">
          <Card className="flex h-full flex-col items-center gap-1 p-4 text-center">
            <p className="font-display text-2xl text-chalk">{alunosQuery.data?.length ?? '—'}</p>
            <p className="font-mono text-xs uppercase tracking-wide text-rope">Alunos</p>
          </Card>
          <Card className="flex h-full flex-col items-center gap-1 p-4 text-center">
            <p className="font-display text-2xl text-hanko">{checkinsHojeQuery.data?.length ?? '—'}</p>
            <p className="font-mono text-xs uppercase tracking-wide text-rope">Check-ins hoje</p>
          </Card>
          <Card className="flex h-full flex-col items-center gap-1 p-4 text-center">
            <p className="font-display text-2xl text-chalk">{turmasHoje.length}</p>
            <p className="font-mono text-xs uppercase tracking-wide text-rope">Turmas hoje</p>
          </Card>
          <Card className="flex h-full flex-col items-center gap-1 p-4 text-center">
            <p className="font-display text-2xl text-hanko">{alertasExame.vencidos}</p>
            <p className="font-mono text-xs uppercase tracking-wide text-rope">Exames vencidos</p>
            <div className="flex min-h-9 flex-col items-center justify-center gap-0.5">
              {alertasExame.venceEmBreve > 0 && (
                <p className="font-mono text-xs text-rope">+{alertasExame.venceEmBreve} vencendo</p>
              )}
            </div>
          </Card>
          <Card className="flex h-full flex-col items-center gap-1 p-4 text-center">
            <p className="font-display text-2xl text-mat">{elegiveis}</p>
            <p className="font-mono text-xs uppercase tracking-wide text-rope">Elegíveis pra graduar</p>
            <div className="flex min-h-9 flex-col items-center justify-center gap-0.5">
              {elegiveis > 0 && (
                <Link to="/admin/graduacao" className="font-mono text-xs text-hanko hover:underline">
                  ver na Graduação →
                </Link>
              )}
            </div>
          </Card>
        </div>

        <Card className="flex flex-col gap-3 lg:w-72">
          <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-rope">Distribuição de faixas</h2>
          <div className="flex flex-1 flex-col justify-center gap-2">
            <GraficoFaixas dados={distribuicaoFaixas} />
          </div>
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

      <section>
        <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-rope">Check-ins por turma este mês</h2>
        <Card className="mt-3 flex flex-col gap-3">
          {checkinsPorTurmaMes.map((t) => (
            <div key={t.nome} className="flex items-center gap-3">
              <p className="w-28 shrink-0 truncate text-sm text-chalk sm:w-40">{t.nome}</p>
              <Meter fracao={t.quantidade / maiorCheckinTurmaMes} className="flex-1" />
              <span className="w-8 shrink-0 text-right text-sm font-semibold text-chalk">{t.quantidade}</span>
            </div>
          ))}
          {checkinsPorTurmaMes.length === 0 && <p className="text-sm text-rope">Nenhuma turma cadastrada.</p>}
        </Card>
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
