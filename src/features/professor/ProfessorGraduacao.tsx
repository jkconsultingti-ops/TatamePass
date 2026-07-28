import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import {
  useFaixasConfig,
  faixasDoTipo,
  estadoAtual,
  statusProgresso,
  proximoEvento,
  type EstadoGraduacao,
  type StatusProgresso,
} from '../../lib/graduacao'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Badge } from '../../components/Badge'
import { Belt } from '../../components/Belt'
import { Meter } from '../../components/Meter'
import { Label, Input } from '../../components/Field'
import { ROTULO_TIPO_TURMA } from '../../types/database'
import type { Checkin, FaixaConfig, Graduacao, Profile, Turma, TipoTurma } from '../../types/database'

const TIPOS_TURMA = ['adulto', 'infantil'] as const satisfies readonly TipoTurma[]

type Aba = 'alunos' | 'config'

export function ProfessorGraduacao() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const faixasQuery = useFaixasConfig()
  const [erro, setErro] = useState<string | null>(null)
  const [aba, setAba] = useState<Aba>('alunos')

  const alunosQuery = useQuery({
    queryKey: ['alunos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('role', 'aluno').order('nome')
      if (error) throw error
      return data as Profile[]
    },
    enabled: !!profile,
  })

  const graduacoesQuery = useQuery({
    queryKey: ['graduacoes-todas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('graduacoes').select('*')
      if (error) throw error
      return data as Graduacao[]
    },
    enabled: !!profile,
  })

  const checkinsQuery = useQuery({
    queryKey: ['checkins-todos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('checkins').select('*')
      if (error) throw error
      return data as Checkin[]
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

  const turmaPorId = useMemo(
    () => new Map((turmasQuery.data ?? []).map((t) => [t.id, t])),
    [turmasQuery.data],
  )

  async function invalidarTudo() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['faixas_config'] }),
      queryClient.invalidateQueries({ queryKey: ['graduacoes-todas'] }),
    ])
  }

  async function salvarFaixa(faixa: FaixaConfig, patch: Partial<FaixaConfig>) {
    setErro(null)
    const { error } = await supabase.from('faixas_config').update(patch).eq('id', faixa.id)
    if (error) {
      setErro(error.message)
      return
    }
    await invalidarTudo()
  }

  async function concederGrau(alunoId: string, evento: { faixa_id: string; grau: number }) {
    if (!profile) return
    setErro(null)
    const { error } = await supabase.from('graduacoes').insert({
      aluno_id: alunoId,
      faixa_id: evento.faixa_id,
      grau: evento.grau,
      concedido_por: profile.id,
    })
    if (error) {
      setErro(error.message)
      return
    }
    await invalidarTudo()
  }

  const faixas = useMemo(() => faixasQuery.data ?? [], [faixasQuery.data])

  const roster = useMemo(() => {
    if (faixas.length === 0) return []
    const graduacoesPorAluno = new Map<string, Graduacao[]>()
    for (const g of graduacoesQuery.data ?? []) {
      const lista = graduacoesPorAluno.get(g.aluno_id) ?? []
      lista.push(g)
      graduacoesPorAluno.set(g.aluno_id, lista)
    }
    const checkinsPorAluno = new Map<string, Checkin[]>()
    for (const c of checkinsQuery.data ?? []) {
      const lista = checkinsPorAluno.get(c.aluno_id) ?? []
      lista.push(c)
      checkinsPorAluno.set(c.aluno_id, lista)
    }

    return (alunosQuery.data ?? []).map((aluno) => {
      const tipoTurma =
        (aluno.turma_principal_id ? turmaPorId.get(aluno.turma_principal_id)?.tipo_turma : undefined) ?? 'adulto'
      const faixasDoAluno = faixasDoTipo(faixas, tipoTurma)
      const estado = estadoAtual(graduacoesPorAluno.get(aluno.id) ?? [], faixasDoAluno, aluno.criado_em)!
      const checkinsDesde = (checkinsPorAluno.get(aluno.id) ?? []).filter((c) => c.data > estado.desde)
      const status = statusProgresso(estado, faixasDoAluno, checkinsDesde)
      return { aluno, estado, status }
    })
  }, [alunosQuery.data, graduacoesQuery.data, checkinsQuery.data, faixas, turmaPorId])

  const rosterOrdenado = useMemo(() => {
    return [...roster].sort((a, b) => {
      if (a.status.ultimaFaixa !== b.status.ultimaFaixa) return a.status.ultimaFaixa ? 1 : -1
      if (a.status.elegivel !== b.status.elegivel) return a.status.elegivel ? -1 : 1
      const faltamA = (a.status.aulasNecessarias ?? 0) - a.status.aulasFeitas
      const faltamB = (b.status.aulasNecessarias ?? 0) - b.status.aulasFeitas
      return faltamA - faltamB
    })
  }, [roster])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-chalk">Graduação</h1>
        <p className="mt-1 text-sm text-rope">
          {aba === 'alunos'
            ? 'Conceda graus para os alunos que já estiverem elegíveis.'
            : 'Ajuste quantas aulas e graus cada faixa exige antes de subir.'}
        </p>
      </div>

      <div className="flex gap-1 self-start rounded-sm border border-rope-dim/40 p-1">
        <button
          type="button"
          onClick={() => setAba('alunos')}
          className={`rounded-sm px-4 py-2 font-mono text-xs uppercase tracking-wide transition-colors ${
            aba === 'alunos' ? 'bg-hanko/15 text-hanko' : 'text-rope hover:text-chalk'
          }`}
        >
          Alunos
        </button>
        <button
          type="button"
          onClick={() => setAba('config')}
          className={`rounded-sm px-4 py-2 font-mono text-xs uppercase tracking-wide transition-colors ${
            aba === 'config' ? 'bg-hanko/15 text-hanko' : 'text-rope hover:text-chalk'
          }`}
        >
          Configurar faixas
        </button>
      </div>

      {erro && <p className="font-mono text-xs text-hanko">{erro}</p>}

      {aba === 'config' &&
        TIPOS_TURMA.map((tipo) => {
          const faixasDoTipoAtual = faixasDoTipo(faixas, tipo)
          if (faixasDoTipoAtual.length === 0) return null
          return (
            <Card key={tipo} className="max-w-2xl p-6">
              <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.14em] text-rope">
                Regras de progressão — {ROTULO_TIPO_TURMA[tipo]}
              </h2>
              <div className="mb-1 hidden gap-3 border-b border-rope-dim/15 pb-2 font-mono text-xs uppercase tracking-wide text-rope sm:flex">
                <span className="whitespace-nowrap sm:w-60 sm:shrink-0">Faixa</span>
                <span className="whitespace-nowrap sm:w-36 sm:flex-none">Aulas por grau</span>
                <span className="whitespace-nowrap sm:w-36 sm:flex-none">Graus até subir</span>
              </div>
              <div className="flex flex-col">
                {faixasDoTipoAtual.map((faixa, indice) => (
                  <FaixaRow
                    key={faixa.id}
                    faixa={faixa}
                    ultima={indice === faixasDoTipoAtual.length - 1}
                    onSalvar={(patch) => salvarFaixa(faixa, patch)}
                  />
                ))}
              </div>
            </Card>
          )
        })}

      {aba === 'alunos' && (
        <Card className="p-6">
          <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.14em] text-rope">
            Alunos — ordenado por quem está mais perto de graduar
          </h2>
          <div className="flex flex-col">
            {rosterOrdenado.map(({ aluno, estado, status }) => (
              <RosterRow
                key={aluno.id}
                aluno={aluno}
                estado={estado}
                status={status}
                onConceder={() => {
                  const evento = proximoEvento(estado, status)
                  if (evento) concederGrau(aluno.id, evento)
                }}
              />
            ))}
            {rosterOrdenado.length === 0 && (
              <p className="py-4 text-sm text-rope">Nenhum aluno cadastrado ainda.</p>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

function FaixaRow({
  faixa,
  ultima,
  onSalvar,
}: {
  faixa: FaixaConfig
  ultima: boolean
  onSalvar: (patch: Partial<FaixaConfig>) => void
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-rope-dim/15 py-3 last:border-none sm:flex-row sm:items-center">
      <div className="flex items-center gap-3 sm:w-60 sm:shrink-0">
        <Belt nome={faixa.nome} tamanho="sm" />
        <span className="font-semibold text-chalk">{faixa.nome}</span>
      </div>
      <div className="flex gap-3">
        <div className="flex-1 sm:w-36 sm:flex-none">
          <Label className="sm:hidden">Aulas por grau</Label>
          {ultima ? (
            <span className="text-sm text-rope-dim">—</span>
          ) : (
            <Input
              type="number"
              min={1}
              defaultValue={faixa.aulas_por_grau ?? undefined}
              onBlur={(e) => onSalvar({ aulas_por_grau: Number(e.target.value) })}
              className="w-full sm:w-20"
            />
          )}
        </div>
        <div className="flex-1 sm:w-36 sm:flex-none">
          <Label className="sm:hidden">Graus até subir</Label>
          {ultima ? (
            <span className="text-sm text-rope-dim">—</span>
          ) : (
            <Input
              type="number"
              min={1}
              defaultValue={faixa.graus_por_faixa ?? undefined}
              onBlur={(e) => onSalvar({ graus_por_faixa: Number(e.target.value) })}
              className="w-full sm:w-20"
            />
          )}
        </div>
      </div>
    </div>
  )
}

function RosterRow({
  aluno,
  estado,
  status,
  onConceder,
}: {
  aluno: Profile
  estado: EstadoGraduacao
  status: StatusProgresso
  onConceder: () => void
}) {
  const iniciais = aluno.nome
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  return (
    <div className="flex flex-col gap-3 border-b border-rope-dim/15 py-3 last:border-none sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
      <div className="flex items-center gap-3 sm:contents">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-rope-dim/40 bg-ink text-xs font-bold text-rope">
          {iniciais}
        </div>
        <div className="min-w-0 flex-1 sm:min-w-[150px] sm:flex-none">
          <p className="truncate text-sm font-semibold text-chalk">{aluno.nome}</p>
          <Belt
            nome={estado.faixa.nome}
            grau={estado.grau}
            maxGraus={estado.faixa.graus_por_faixa}
            tamanho="sm"
            className="mt-1"
          />
        </div>
      </div>
      {status.ultimaFaixa ? (
        <p className="text-xs text-rope sm:flex-1">Faixa máxima atingida</p>
      ) : (
        <div className="sm:min-w-[160px] sm:flex-1">
          <Meter fracao={status.aulasNecessarias ? status.aulasFeitas / status.aulasNecessarias : 0} />
          <p className="mt-1 text-xs text-rope">
            {status.aulasFeitas} / {status.aulasNecessarias} aulas
          </p>
        </div>
      )}
      <div className="flex items-center gap-3 sm:contents">
        {!status.ultimaFaixa && (
          <Badge tone={status.elegivel ? 'mat' : 'neutral'}>
            {status.elegivel ? 'Elegível' : `Faltam ${(status.aulasNecessarias ?? 0) - status.aulasFeitas}`}
          </Badge>
        )}
        <Button disabled={!status.elegivel} onClick={onConceder} className="flex-1 sm:flex-none">
          Conceder grau
        </Button>
      </div>
    </div>
  )
}
