import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { Card } from '../../components/Card'
import { Badge } from '../../components/Badge'
import { DIAS_SEMANA } from '../../types/database'
import type { Turma } from '../../types/database'

export function AlunoTurmas() {
  const { profile } = useAuth()

  const turmasQuery = useQuery({
    queryKey: ['turmas', profile?.academia_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('turmas').select('*').order('horario_inicio')
      if (error) throw error
      return data as Turma[]
    },
    enabled: !!profile,
  })

  const porDia = DIAS_SEMANA.map((nome, indice) => ({
    nome,
    turmas: (turmasQuery.data ?? []).filter((t) => t.dia_semana === indice),
  })).filter((dia) => dia.turmas.length > 0)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-chalk">Grade de turmas</h1>
        <p className="mt-1 text-sm text-rope">
          Você pode fazer check-in avulso em qualquer turma da academia, dentro da janela de cada
          aula.
        </p>
      </div>
      {porDia.map((dia) => (
        <div key={dia.nome}>
          <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-rope">{dia.nome}</h2>
          <div className="mt-2 flex flex-col gap-2">
            {dia.turmas.map((t) => (
              <Card key={t.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-chalk">{t.nome}</p>
                  {profile?.turma_principal_id === t.id && <Badge tone="hanko">principal</Badge>}
                </div>
                <p className="font-mono text-xs text-rope">
                  {t.horario_inicio.slice(0, 5)}–{t.horario_fim.slice(0, 5)}
                </p>
              </Card>
            ))}
          </div>
        </div>
      ))}
      {porDia.length === 0 && (
        <Card className="text-sm text-rope">Nenhuma turma cadastrada ainda.</Card>
      )}
    </div>
  )
}
