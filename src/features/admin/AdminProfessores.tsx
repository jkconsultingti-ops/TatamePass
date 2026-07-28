import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Badge } from '../../components/Badge'
import type { Profile } from '../../types/database'

export function AdminProfessores() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [erro, setErro] = useState<string | null>(null)

  const staffQuery = useQuery({
    queryKey: ['staff', profile?.academia_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['professor', 'admin'])
        .order('nome')
      if (error) throw error
      return data as Profile[]
    },
    enabled: !!profile,
  })

  const admins = staffQuery.data?.filter((p) => p.role === 'admin') ?? []

  async function mudarRole(pessoa: Profile, novoRole: 'admin' | 'professor') {
    setErro(null)
    const { error } = await supabase.from('profiles').update({ role: novoRole }).eq('id', pessoa.id)
    if (error) {
      setErro(error.message)
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['staff', profile?.academia_id] })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-chalk">Professores</h1>
        <p className="mt-1 text-sm text-rope">
          Promova um professor a admin, ou rebaixe um admin a professor. Pra alguém novo entrar direto
          como professor, manda o link de convite de professor que está no Painel.
        </p>
      </div>

      {erro && <p className="font-mono text-xs text-hanko">{erro}</p>}

      <Card className="divide-y divide-rope-dim/15 p-0">
        {staffQuery.data?.map((pessoa) => {
          const souEu = pessoa.id === profile?.id
          const ultimoAdmin = pessoa.role === 'admin' && admins.length <= 1
          return (
            <div key={pessoa.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex items-center gap-3">
                {pessoa.foto_url ? (
                  <img src={pessoa.foto_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-ink" />
                )}
                <div>
                  <p className="text-sm text-chalk">
                    {pessoa.nome} {souEu && <span className="text-rope">(você)</span>}
                  </p>
                  <Badge tone={pessoa.role === 'admin' ? 'hanko' : 'neutral'}>{pessoa.role}</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                {pessoa.role === 'professor' ? (
                  <Button variant="secondary" onClick={() => mudarRole(pessoa, 'admin')}>
                    Promover a admin
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    disabled={souEu && ultimoAdmin}
                    title={souEu && ultimoAdmin ? 'Você é o único admin da academia' : undefined}
                    onClick={() => mudarRole(pessoa, 'professor')}
                  >
                    Rebaixar a professor
                  </Button>
                )}
              </div>
            </div>
          )
        })}
        {staffQuery.data?.length === 0 && (
          <p className="p-4 text-sm text-rope">
            Nenhum professor ainda. Compartilhe o link de convite de professor.
          </p>
        )}
      </Card>
    </div>
  )
}
