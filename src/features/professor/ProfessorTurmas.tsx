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
import { DIAS_SEMANA } from '../../types/database'
import type { Turma } from '../../types/database'

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

  async function excluir(turma: Turma) {
    if (!confirm(`Excluir a turma "${turma.nome}"?`)) return
    const { error } = await supabase.from('turmas').delete().eq('id', turma.id)
    if (error) {
      setErro(error.message)
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['turmas', profile?.academia_id] })
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
          <Card key={turma.id} className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-chalk">{turma.nome}</p>
              <p className="font-mono text-xs text-rope">
                {turma.dias_semana.map((d) => DIAS_SEMANA[d].slice(0, 3)).join(', ')} ·{' '}
                {turma.horario_inicio.slice(0, 5)}–{turma.horario_fim.slice(0, 5)} · check-in{' '}
                {turma.janela_checkin_antes_horas}h antes – {turma.janela_checkin_depois_horas}h depois
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditando(turma)}>
                Editar
              </Button>
              <Button variant="ghost" onClick={() => excluir(turma)}>
                Excluir
              </Button>
            </div>
          </Card>
        ))}
        {turmasQuery.data?.length === 0 && (
          <Card className="text-sm text-rope">Nenhuma turma cadastrada.</Card>
        )}
      </div>
    </div>
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
