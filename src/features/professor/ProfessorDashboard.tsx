import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { hojeISO } from '../../lib/checkin'
import type { Profile, Checkin, Turma, Academia } from '../../types/database'

export function ProfessorDashboard() {
  const { profile } = useAuth()
  const [copiado, setCopiado] = useState(false)

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

  const turmasHoje = useMemo(() => {
    const hoje = new Date().getDay()
    return (turmasQuery.data ?? []).filter((t) => t.dias_semana.includes(hoje))
  }, [turmasQuery.data])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-chalk">Painel</h1>

      {academiaQuery.data && (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-rope">
              Código de convite · {academiaQuery.data.nome}
            </p>
            <p className="mt-1 font-mono text-xl tracking-[0.2em] text-hanko">
              {academiaQuery.data.codigo_convite}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(academiaQuery.data.codigo_convite)
              setCopiado(true)
              setTimeout(() => setCopiado(false), 1500)
            }}
          >
            {copiado ? 'Copiado ✓' : 'Copiar código'}
          </Button>
        </Card>
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
            <Card key={t.id} className="flex items-center justify-between">
              <p className="text-sm text-chalk">{t.nome}</p>
              <p className="font-mono text-xs text-rope">
                {t.horario_inicio.slice(0, 5)}–{t.horario_fim.slice(0, 5)}
              </p>
            </Card>
          ))}
          {turmasHoje.length === 0 && <Card className="text-sm text-rope">Nenhuma turma hoje.</Card>}
        </div>
      </section>

      <div className="flex gap-4">
        <Link to="/professor/alunos" className="font-mono text-xs text-rope hover:text-hanko">
          ver todos os alunos →
        </Link>
        <Link to="/professor/turmas" className="font-mono text-xs text-rope hover:text-hanko">
          gerenciar turmas →
        </Link>
      </div>
    </div>
  )
}
