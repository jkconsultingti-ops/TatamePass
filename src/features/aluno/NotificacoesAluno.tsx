import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { statusExameMedico } from '../../lib/exameMedico'
import type { ExameMedico } from '../../types/database'

/** Sino com avisos pro próprio aluno: exame médico vencido/não enviado, e
 * foto de perfil faltando — os casos em que ele precisa agir. */
export function NotificacoesAluno() {
  const { profile } = useAuth()
  const [aberto, setAberto] = useState(false)

  const exameQuery = useQuery({
    queryKey: ['exame_medico', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exames_medicos')
        .select('*')
        .eq('aluno_id', profile!.id)
        .maybeSingle()
      if (error) throw error
      return data as ExameMedico | null
    },
    enabled: !!profile,
    refetchInterval: 60_000,
  })

  const statusExame = statusExameMedico(exameQuery.data)

  const avisos: { titulo: string; descricao: string }[] = []
  if (statusExame === 'vencido') {
    avisos.push({ titulo: 'Exame médico vencido', descricao: 'Envie um atestado médico novo.' })
  } else if (statusExame === 'sem-registro') {
    avisos.push({ titulo: 'Exame médico não enviado', descricao: 'Envie o atestado do exame médico obrigatório.' })
  }
  if (profile && !profile.foto_url) {
    avisos.push({ titulo: 'Adicionar foto de perfil', descricao: 'Deixe seu perfil completo com uma foto.' })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label="Notificações"
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-rope hover:bg-ink hover:text-chalk"
      >
        <Bell size={18} />
        {avisos.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-hanko text-[10px] font-bold text-paper">
            {avisos.length}
          </span>
        )}
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAberto(false)} />
          <div className="absolute right-0 z-40 mt-2 w-72 rounded-lg border border-rope-dim/25 bg-ink-soft p-2 shadow-lg">
            <p className="px-2 py-1 font-mono text-xs uppercase tracking-wide text-rope">Avisos</p>
            {avisos.length === 0 && <p className="px-2 py-3 text-sm text-rope">Nenhuma pendência.</p>}
            <div className="flex flex-col">
              {avisos.map((aviso) => (
                <Link
                  key={aviso.titulo}
                  to="/aluno/perfil"
                  onClick={() => setAberto(false)}
                  className="rounded-md px-2 py-2 hover:bg-ink"
                >
                  <p className="text-sm text-chalk">{aviso.titulo}</p>
                  <p className="text-xs text-rope">{aviso.descricao}</p>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
