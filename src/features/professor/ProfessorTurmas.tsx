import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
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
  dia_semana: z.coerce.number().min(0).max(6),
  horario_inicio: z.string().min(1, 'Informe o horário de início'),
  horario_fim: z.string().min(1, 'Informe o horário de término'),
  janela_checkin_minutos: z.coerce.number().min(1, 'A janela precisa ser maior que zero'),
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
      const { data, error } = await supabase
        .from('turmas')
        .select('*')
        .order('dia_semana')
        .order('horario_inicio')
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
                {DIAS_SEMANA[turma.dia_semana]} · {turma.horario_inicio.slice(0, 5)}–
                {turma.horario_fim.slice(0, 5)} · janela {turma.janela_checkin_minutos}min
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
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TurmaFormInput, unknown, TurmaFormOutput>({
    resolver: zodResolver(turmaSchema),
    defaultValues: turma
      ? {
          nome: turma.nome,
          dia_semana: turma.dia_semana,
          horario_inicio: turma.horario_inicio.slice(0, 5),
          horario_fim: turma.horario_fim.slice(0, 5),
          janela_checkin_minutos: turma.janela_checkin_minutos,
        }
      : {
          nome: '',
          dia_semana: 1,
          horario_inicio: '19:00',
          horario_fim: '20:00',
          janela_checkin_minutos: 60,
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
          <Label htmlFor="dia-semana">Dia da semana</Label>
          <select
            id="dia-semana"
            {...register('dia_semana')}
            className="w-full rounded-sm border border-rope-dim/50 bg-ink px-3.5 py-2.5 text-sm text-chalk focus:border-hanko focus:outline-none focus:ring-1 focus:ring-hanko"
          >
            {DIAS_SEMANA.map((nome, indice) => (
              <option key={nome} value={indice}>
                {nome}
              </option>
            ))}
          </select>
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
        <div>
          <Label htmlFor="janela">Janela de check-in após o fim (minutos)</Label>
          <Input id="janela" type="number" min={1} {...register('janela_checkin_minutos')} />
          <FieldError>{errors.janela_checkin_minutos?.message}</FieldError>
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
