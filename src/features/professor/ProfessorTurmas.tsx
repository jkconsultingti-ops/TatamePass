import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Label, Input, FieldError } from '../../components/Field'
import { hojeISO } from '../../lib/checkin'
import { useAulasCanceladas } from '../../lib/aulas'
import { DIAS_SEMANA } from '../../types/database'
import type { Turma, AulaCancelada } from '../../types/database'

const turmaSchema = z.object({
  nome: z.string().min(2, 'Informe o nome da turma'),
  dias_semana: z.array(z.number().min(0).max(6)).min(1, 'Selecione pelo menos um dia'),
  horario_inicio: z.string().min(1, 'Informe o horário de início'),
  horario_fim: z.string().min(1, 'Informe o horário de término'),
  janela_checkin_antes_horas: z.coerce.number().min(0, 'Não pode ser negativo'),
  janela_checkin_depois_horas: z.coerce.number().min(0.01, 'A janela precisa ser maior que zero'),
})
type TurmaFormInput = z.input<typeof turmaSchema>
type TurmaFormOutput = z.output<typeof turmaSchema>

export function ProfessorTurmas() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [editando, setEditando] = useState<Turma | null>(null)
  const [criando, setCriando] = useState(false)
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

  const canceladasQuery = useAulasCanceladas(profile?.academia_id)

  async function excluir(turma: Turma) {
    if (!confirm(`Excluir a turma "${turma.nome}"?`)) return
    const { error } = await supabase.from('turmas').delete().eq('id', turma.id)
    if (error) {
      setErro(error.message)
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['turmas', profile?.academia_id] })
  }

  async function cancelarData(turma: Turma, data: string, motivo: string) {
    if (!profile || !data || !motivo.trim()) return
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
    await queryClient.invalidateQueries({ queryKey: ['aulas_canceladas', profile.academia_id] })
  }

  async function desfazerCancelamento(cancelada: AulaCancelada) {
    setErro(null)
    const { error } = await supabase.from('aulas_canceladas').delete().eq('id', cancelada.id)
    if (error) {
      setErro(error.message)
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['aulas_canceladas', profile?.academia_id] })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-chalk">Turmas</h1>
        {!criando && !editando && <Button onClick={() => setCriando(true)}>Nova turma</Button>}
      </div>

      {(criando || editando) && (
        <TurmaFormulario
          turma={editando}
          onCancelar={() => {
            setCriando(false)
            setEditando(null)
          }}
          onSalvo={async () => {
            setCriando(false)
            setEditando(null)
            await queryClient.invalidateQueries({ queryKey: ['turmas', profile?.academia_id] })
          }}
        />
      )}

      {erro && <p className="font-mono text-xs text-hanko">{erro}</p>}

      <div className="flex flex-col gap-3">
        {turmasQuery.data?.map((turma) => (
          <TurmaCard
            key={turma.id}
            turma={turma}
            cancelamentosFuturos={(canceladasQuery.data ?? []).filter(
              (c) => c.turma_id === turma.id && c.data >= hojeISO(),
            )}
            onEditar={() => setEditando(turma)}
            onExcluir={() => excluir(turma)}
            onCancelarData={(data, motivo) => cancelarData(turma, data, motivo)}
            onDesfazerCancelamento={desfazerCancelamento}
          />
        ))}
        {turmasQuery.data?.length === 0 && (
          <Card className="text-sm text-rope">Nenhuma turma cadastrada.</Card>
        )}
      </div>
    </div>
  )
}

function TurmaCard({
  turma,
  cancelamentosFuturos,
  onEditar,
  onExcluir,
  onCancelarData,
  onDesfazerCancelamento,
}: {
  turma: Turma
  cancelamentosFuturos: AulaCancelada[]
  onEditar: () => void
  onExcluir: () => void
  onCancelarData: (data: string, motivo: string) => void
  onDesfazerCancelamento: (cancelada: AulaCancelada) => void
}) {
  const [cancelandoData, setCancelandoData] = useState(false)
  const [data, setData] = useState('')
  const [motivo, setMotivo] = useState('')

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-chalk">{turma.nome}</p>
          <p className="font-mono text-xs text-rope">
            {turma.dias_semana.map((d) => DIAS_SEMANA[d].slice(0, 3)).join(', ')} ·{' '}
            {turma.horario_inicio.slice(0, 5)}–{turma.horario_fim.slice(0, 5)} · check-in{' '}
            {turma.janela_checkin_antes_horas}h antes – {turma.janela_checkin_depois_horas}h depois
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onEditar}>
            Editar
          </Button>
          <Button variant="ghost" onClick={onExcluir}>
            Excluir
          </Button>
        </div>
      </div>

      {cancelamentosFuturos.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-rope-dim/15 pt-3">
          {cancelamentosFuturos.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs text-hanko">
                {c.data} — {c.motivo}
              </p>
              <Button variant="ghost" onClick={() => onDesfazerCancelamento(c)}>
                Desfazer
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-rope-dim/15 pt-3">
        {cancelandoData ? (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor={`data-cancelar-${turma.id}`}>Data</Label>
              <Input
                id={`data-cancelar-${turma.id}`}
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor={`motivo-cancelar-${turma.id}`}>Motivo</Label>
              <Input
                id={`motivo-cancelar-${turma.id}`}
                placeholder="Ex: feriado"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              disabled={!data || !motivo.trim()}
              onClick={() => {
                onCancelarData(data, motivo)
                setCancelandoData(false)
                setData('')
                setMotivo('')
              }}
            >
              Confirmar
            </Button>
            <Button variant="ghost" onClick={() => setCancelandoData(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setCancelandoData(true)}>
            Cancelar uma aula
          </Button>
        )}
      </div>
    </Card>
  )
}

function TurmaFormulario({
  turma,
  onCancelar,
  onSalvo,
}: {
  turma: Turma | null
  onCancelar: () => void
  onSalvo: () => Promise<void>
}) {
  const { profile } = useAuth()
  const [erro, setErro] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TurmaFormInput, unknown, TurmaFormOutput>({
    resolver: zodResolver(turmaSchema),
    defaultValues: turma
      ? {
          nome: turma.nome,
          dias_semana: turma.dias_semana,
          horario_inicio: turma.horario_inicio.slice(0, 5),
          horario_fim: turma.horario_fim.slice(0, 5),
          janela_checkin_antes_horas: turma.janela_checkin_antes_horas,
          janela_checkin_depois_horas: turma.janela_checkin_depois_horas,
        }
      : {
          nome: '',
          dias_semana: [1],
          horario_inicio: '19:00',
          horario_fim: '20:00',
          janela_checkin_antes_horas: 1,
          janela_checkin_depois_horas: 1,
        },
  })

  return (
    <Card>
      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(async (values) => {
          setErro(null)
          try {
            if (!profile) return
            if (turma) {
              const { error } = await supabase.from('turmas').update(values).eq('id', turma.id)
              if (error) throw error
            } else {
              const { error } = await supabase.from('turmas').insert({
                ...values,
                academia_id: profile.academia_id,
                professor_id: profile.id,
              })
              if (error) throw error
            }
            await onSalvo()
          } catch (err) {
            setErro(err instanceof Error ? err.message : 'Não foi possível salvar a turma')
          }
        })}
      >
        <div>
          <Label htmlFor="nome-turma">Nome</Label>
          <Input id="nome-turma" placeholder="Ex: Jiu-jitsu adulto" {...register('nome')} />
          <FieldError>{errors.nome?.message}</FieldError>
        </div>
        <div>
          <Label>Dias de atendimento</Label>
          <Controller
            control={control}
            name="dias_semana"
            render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map((nome, indice) => {
                  const selecionado = field.value.includes(indice)
                  return (
                    <button
                      key={nome}
                      type="button"
                      onClick={() =>
                        field.onChange(
                          selecionado
                            ? field.value.filter((d) => d !== indice)
                            : [...field.value, indice].sort((a, b) => a - b),
                        )
                      }
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                        selecionado
                          ? 'bg-hanko text-paper'
                          : 'bg-ink-soft text-rope-dim hover:text-rope'
                      }`}
                    >
                      {nome.slice(0, 3)}
                    </button>
                  )
                })}
              </div>
            )}
          />
          <FieldError>{errors.dias_semana?.message}</FieldError>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="horario-inicio">Início</Label>
            <Input id="horario-inicio" type="time" {...register('horario_inicio')} />
            <FieldError>{errors.horario_inicio?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="horario-fim">Término</Label>
            <Input id="horario-fim" type="time" {...register('horario_fim')} />
            <FieldError>{errors.horario_fim?.message}</FieldError>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="janela-antes">Check-in antes do início (horas)</Label>
            <Input
              id="janela-antes"
              type="number"
              step="0.5"
              min={0}
              {...register('janela_checkin_antes_horas')}
            />
            <FieldError>{errors.janela_checkin_antes_horas?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="janela-depois">Check-in depois do término (horas)</Label>
            <Input
              id="janela-depois"
              type="number"
              step="0.5"
              min={0.5}
              {...register('janela_checkin_depois_horas')}
            />
            <FieldError>{errors.janela_checkin_depois_horas?.message}</FieldError>
          </div>
        </div>
        <FieldError>{erro ?? undefined}</FieldError>
        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {turma ? 'Salvar' : 'Criar turma'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
