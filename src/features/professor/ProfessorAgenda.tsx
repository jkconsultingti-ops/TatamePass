import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { useAulasCanceladas } from '../../lib/aulas'
import { Stamp } from '../../components/Stamp'
import { DIAS_SEMANA } from '../../types/database'
import type { Turma, AulaCancelada } from '../../types/database'

export function ProfessorAgenda() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [mesAtual, setMesAtual] = useState(() => startOfMonth(new Date()))
  const [diaSelecionado, setDiaSelecionado] = useState(() => new Date())
  const [erro, setErro] = useState<string | null>(null)

  const turmasQuery = useQuery({
    queryKey: ['turmas', profile?.academia_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('turmas').select('*').order('horario_inicio')
      if (error) throw error
      return data as Turma[]
    },
    enabled: !!profile,
  })
  const turmas = turmasQuery.data ?? []

  const canceladasQuery = useAulasCanceladas(profile?.academia_id)

  const dias = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(mesAtual))
    const fim = endOfWeek(endOfMonth(mesAtual))
    return eachDayOfInterval({ start: inicio, end: fim })
  }, [mesAtual])

  function turmasNoDia(dia: Date) {
    return turmas.filter((t) => t.dias_semana.includes(dia.getDay()))
  }

  async function invalidarCanceladas() {
    await queryClient.invalidateQueries({ queryKey: ['aulas_canceladas', profile?.academia_id] })
  }

  async function cancelarAula(turma: Turma, data: string, motivo: string) {
    if (!profile || !motivo.trim()) return
    setErro(null)
    const { error } = await supabase.from('aulas_canceladas').insert({
      turma_id: turma.id,
      academia_id: profile.academia_id,
      data,
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

  const dataSelecionadaISO = format(diaSelecionado, 'yyyy-MM-dd')
  const turmasDoDiaSelecionado = turmasNoDia(diaSelecionado)
  const hojeEhSelecionado = isSameDay(diaSelecionado, new Date())

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-chalk">Agenda</h1>

      {erro && <p className="font-mono text-xs text-hanko">{erro}</p>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
        <div className="rounded-2xl border border-black/5 bg-paper p-6 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Stamp className="h-8 w-8 text-hanko" />
              <p className="font-display text-2xl capitalize text-ink">
                {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {!hojeEhSelecionado && (
                <button
                  type="button"
                  onClick={() => {
                    setMesAtual(startOfMonth(new Date()))
                    setDiaSelecionado(new Date())
                  }}
                  className="mr-2 rounded-full border border-black/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-neutral-500 hover:border-hanko/40 hover:text-hanko"
                >
                  Hoje
                </button>
              )}
              <button
                type="button"
                onClick={() => setMesAtual((m) => subMonths(m, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-black/5 hover:text-ink"
                aria-label="Mês anterior"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setMesAtual((m) => addMonths(m, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-black/5 hover:text-ink"
                aria-label="Próximo mês"
              >
                ›
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-7 gap-1.5 text-center font-mono text-[11px] uppercase tracking-wide text-neutral-400">
            {DIAS_SEMANA.map((nome) => (
              <span key={nome}>{nome.slice(0, 3)}</span>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {dias.map((dia) => {
              const selecionado = isSameDay(dia, diaSelecionado)
              const hoje = isToday(dia)
              const foraDoMes = !isSameMonth(dia, mesAtual)
              return (
                <button
                  key={dia.toISOString()}
                  type="button"
                  onClick={() => setDiaSelecionado(dia)}
                  className={`flex aspect-square items-center justify-center rounded-full text-sm transition-all ${
                    selecionado
                      ? 'bg-hanko font-semibold text-white shadow-md shadow-hanko/30'
                      : hoje
                        ? 'border-2 border-hanko font-semibold text-hanko'
                        : foraDoMes
                          ? 'text-neutral-300'
                          : 'text-neutral-700 hover:bg-black/5'
                  }`}
                >
                  {format(dia, 'd')}
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-black/5 bg-paper p-6 shadow-lg shadow-black/20">
          <p className="font-mono text-[11px] uppercase tracking-wide text-neutral-400">
            {format(diaSelecionado, 'EEEE', { locale: ptBR })}
          </p>
          <p className="mt-1 font-display text-xl text-ink">
            {format(diaSelecionado, "d 'de' MMMM", { locale: ptBR })}
          </p>

          <div className="mt-5 flex flex-col gap-3">
            {turmasDoDiaSelecionado.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <span className="text-2xl">✨</span>
                <p className="text-sm text-neutral-500">Nenhuma aula neste dia</p>
              </div>
            )}
            {turmasDoDiaSelecionado.map((turma) => {
              const cancelada = canceladasQuery.data?.find(
                (c) => c.turma_id === turma.id && c.data === dataSelecionadaISO,
              )
              return (
                <TurmaDoDia
                  key={turma.id}
                  turma={turma}
                  cancelada={cancelada}
                  onCancelar={(motivo) => cancelarAula(turma, dataSelecionadaISO, motivo)}
                  onDesfazer={() => cancelada && desfazerCancelamento(cancelada)}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function TurmaDoDia({
  turma,
  cancelada,
  onCancelar,
  onDesfazer,
}: {
  turma: Turma
  cancelada: AulaCancelada | undefined
  onCancelar: (motivo: string) => void
  onDesfazer: () => void
}) {
  const [cancelando, setCancelando] = useState(false)

  return (
    <div className="rounded-xl border border-black/5 bg-white/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">{turma.nome}</p>
          <p className="mt-0.5 font-mono text-xs text-neutral-500">
            {turma.horario_inicio.slice(0, 5)}–{turma.horario_fim.slice(0, 5)}
          </p>
        </div>
        {!cancelada && !cancelando && (
          <button
            type="button"
            onClick={() => setCancelando(true)}
            className="whitespace-nowrap rounded-full border border-black/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-neutral-500 hover:border-hanko/40 hover:text-hanko"
          >
            Cancelar
          </button>
        )}
      </div>

      {cancelada && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/5 pt-3">
          <span className="inline-flex items-center rounded-full border border-hanko/30 bg-hanko/10 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-hanko">
            Cancelada — {cancelada.motivo}
          </span>
          <button
            type="button"
            onClick={onDesfazer}
            className="font-mono text-[11px] uppercase tracking-wide text-neutral-400 hover:text-hanko"
          >
            Desfazer
          </button>
        </div>
      )}

      {cancelando && (
        <input
          autoFocus
          placeholder="Motivo (ex: feriado)"
          className="mt-3 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-neutral-400 focus:border-hanko focus:outline-none"
          onBlur={(e) => {
            if (e.target.value.trim()) onCancelar(e.target.value)
            setCancelando(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setCancelando(false)
          }}
        />
      )}
    </div>
  )
}
