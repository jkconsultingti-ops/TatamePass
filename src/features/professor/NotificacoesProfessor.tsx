import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { formatarData } from '../../lib/datas'
import type { Profile, ExameMedico } from '../../types/database'

type Aviso = { id: string; alunoId: string; nome: string; titulo: string; descricao: string }

/** Sino com avisos pro professor/admin: cadastros novos aguardando revisão
 * de faixa/data de associação e exame médico enviado pelo aluno aguardando
 * aprovação. */
export function NotificacoesProfessor() {
  const { profile } = useAuth()
  const [aberto, setAberto] = useState(false)

  const alunosQuery = useQuery({
    queryKey: ['alunos', profile?.academia_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('role', 'aluno')
      if (error) throw error
      return data as Profile[]
    },
    enabled: !!profile,
    refetchInterval: 60_000,
  })

  const examesQuery = useQuery({
    queryKey: ['exames_medicos', profile?.academia_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('exames_medicos').select('*')
      if (error) throw error
      return data as ExameMedico[]
    },
    enabled: !!profile,
    refetchInterval: 60_000,
  })

  const alunoPorId = useMemo(
    () => new Map((alunosQuery.data ?? []).map((a) => [a.id, a])),
    [alunosQuery.data],
  )

  const avisos = useMemo(() => {
    const lista: Aviso[] = []
    for (const aluno of alunosQuery.data ?? []) {
      if (!aluno.revisado_pelo_professor) {
        lista.push({
          id: `revisao-${aluno.id}`,
          alunoId: aluno.id,
          nome: aluno.nome,
          titulo: 'Cadastro novo',
          descricao: `Confirmar faixa e data de associação · cadastrado em ${formatarData(aluno.criado_em)}`,
        })
      }
    }
    for (const exame of examesQuery.data ?? []) {
      if (exame.status !== 'pendente') continue
      const aluno = alunoPorId.get(exame.aluno_id)
      if (!aluno) continue
      lista.push({
        id: `exame-${exame.id}`,
        alunoId: aluno.id,
        nome: aluno.nome,
        titulo: 'Exame médico em análise',
        descricao: 'Enviado pelo aluno, aguardando aprovação',
      })
    }
    return lista
  }, [alunosQuery.data, examesQuery.data, alunoPorId])

  const basePath = profile?.role === 'admin' ? '/admin/alunos' : '/professor/alunos'

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
          <div className="absolute right-0 z-40 mt-2 w-80 rounded-lg border border-rope-dim/25 bg-ink-soft p-2 shadow-lg">
            <p className="px-2 py-1 font-mono text-xs uppercase tracking-wide text-rope">Avisos</p>
            {avisos.length === 0 && <p className="px-2 py-3 text-sm text-rope">Nenhuma pendência.</p>}
            <div className="flex flex-col">
              {avisos.map((aviso) => (
                <Link
                  key={aviso.id}
                  to={`${basePath}/${aviso.alunoId}`}
                  onClick={() => setAberto(false)}
                  className="rounded-md px-2 py-2 hover:bg-ink"
                >
                  <p className="text-sm text-chalk">
                    {aviso.nome} <span className="text-rope">· {aviso.titulo}</span>
                  </p>
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
