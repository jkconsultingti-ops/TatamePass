import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { Card } from '../../components/Card'
import type { Profile, Checkin } from '../../types/database'

export function ProfessorAlunos() {
  const { profile } = useAuth()

  const alunosQuery = useQuery({
    queryKey: ['alunos', profile?.academia_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'aluno')
        .order('nome')
      if (error) throw error
      return data as Profile[]
    },
    enabled: !!profile,
  })

  const checkinsQuery = useQuery({
    queryKey: ['checkins-academia', profile?.academia_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('checkins').select('*')
      if (error) throw error
      return data as Checkin[]
    },
    enabled: !!profile,
  })

  const resumoPorAluno = useMemo(() => {
    const mapa = new Map<string, { total: number; ultima: string | null }>()
    for (const c of checkinsQuery.data ?? []) {
      const atual = mapa.get(c.aluno_id) ?? { total: 0, ultima: null }
      atual.total += 1
      if (!atual.ultima || c.data > atual.ultima) atual.ultima = c.data
      mapa.set(c.aluno_id, atual)
    }
    return mapa
  }, [checkinsQuery.data])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-chalk">Alunos</h1>
      <Card className="divide-y divide-rope-dim/15 p-0">
        {alunosQuery.data?.map((aluno) => {
          const resumo = resumoPorAluno.get(aluno.id)
          return (
            <Link
              key={aluno.id}
              to={`/professor/alunos/${aluno.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-ink"
            >
              <div className="flex items-center gap-3">
                {aluno.foto_url ? (
                  <img src={aluno.foto_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-ink" />
                )}
                <p className="text-sm text-chalk">{aluno.nome}</p>
              </div>
              <p className="whitespace-nowrap font-mono text-xs text-rope">
                {resumo ? `${resumo.total} check-ins · último em ${resumo.ultima}` : 'sem check-ins'}
              </p>
            </Link>
          )
        })}
        {alunosQuery.data?.length === 0 && (
          <p className="p-4 text-sm text-rope">Nenhum aluno ainda. Compartilhe o código de convite da academia.</p>
        )}
      </Card>
    </div>
  )
}
