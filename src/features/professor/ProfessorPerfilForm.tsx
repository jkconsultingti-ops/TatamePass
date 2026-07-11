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
import type { PerfilCampo } from '../../types/database'

const campoSchema = z.object({
  label: z.string().min(2, 'Informe um nome para o campo'),
  tipo: z.enum(['texto', 'documento']),
  obrigatorio: z.boolean(),
})
type CampoForm = z.infer<typeof campoSchema>

export function ProfessorPerfilForm() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [erro, setErro] = useState<string | null>(null)

  const camposQuery = useQuery({
    queryKey: ['perfil_campos', profile?.academia_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('perfil_campos').select('*').order('ordem')
      if (error) throw error
      return data as PerfilCampo[]
    },
    enabled: !!profile,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CampoForm>({
    resolver: zodResolver(campoSchema),
    defaultValues: { label: '', tipo: 'texto', obrigatorio: false },
  })

  async function adicionarCampo(values: CampoForm) {
    if (!profile) return
    setErro(null)
    const proximaOrdem = camposQuery.data?.length ?? 0
    const { error } = await supabase.from('perfil_campos').insert({
      academia_id: profile.academia_id,
      label: values.label,
      tipo: values.tipo,
      obrigatorio: values.obrigatorio,
      ordem: proximaOrdem,
    })
    if (error) {
      setErro(error.message)
      return
    }
    reset({ label: '', tipo: 'texto', obrigatorio: false })
    await queryClient.invalidateQueries({ queryKey: ['perfil_campos', profile.academia_id] })
  }

  async function remover(campo: PerfilCampo) {
    if (
      !confirm(
        `Remover o campo "${campo.label}"? As respostas dos alunos para esse campo também serão apagadas.`,
      )
    )
      return
    const { error } = await supabase.from('perfil_campos').delete().eq('id', campo.id)
    if (error) {
      setErro(error.message)
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['perfil_campos', profile?.academia_id] })
  }

  async function mover(campo: PerfilCampo, direcao: -1 | 1) {
    const lista = camposQuery.data ?? []
    const indice = lista.findIndex((c) => c.id === campo.id)
    const vizinho = lista[indice + direcao]
    if (!vizinho) return
    await Promise.all([
      supabase.from('perfil_campos').update({ ordem: vizinho.ordem }).eq('id', campo.id),
      supabase.from('perfil_campos').update({ ordem: campo.ordem }).eq('id', vizinho.id),
    ])
    await queryClient.invalidateQueries({ queryKey: ['perfil_campos', profile?.academia_id] })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-chalk">Formulário de perfil</h1>
        <p className="mt-1 text-sm text-rope">
          Defina os campos que os alunos vão preencher no perfil deles — texto livre ou upload de
          documento.
        </p>
      </div>

      <Card>
        <form
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
          onSubmit={handleSubmit(adicionarCampo)}
        >
          <div className="flex-1">
            <Label htmlFor="label-campo">Nome do campo</Label>
            <Input id="label-campo" placeholder="Ex: Atestado médico" {...register('label')} />
            <FieldError>{errors.label?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="tipo-campo">Tipo</Label>
            <select
              id="tipo-campo"
              {...register('tipo')}
              className="rounded-sm border border-rope-dim/50 bg-ink px-3.5 py-2.5 text-sm text-chalk focus:border-hanko focus:outline-none focus:ring-1 focus:ring-hanko"
            >
              <option value="texto">Texto</option>
              <option value="documento">Documento</option>
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2.5 font-mono text-xs text-rope">
            <input type="checkbox" {...register('obrigatorio')} />
            obrigatório
          </label>
          <Button type="submit" disabled={isSubmitting}>
            Adicionar
          </Button>
        </form>
      </Card>

      {erro && <p className="font-mono text-xs text-hanko">{erro}</p>}

      <div className="flex flex-col gap-2">
        {camposQuery.data?.map((campo, indice) => (
          <Card key={campo.id} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-chalk">{campo.label}</p>
              <p className="font-mono text-xs text-rope">
                {campo.tipo}
                {campo.obrigatorio ? ' · obrigatório' : ''}
              </p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" disabled={indice === 0} onClick={() => mover(campo, -1)}>
                ↑
              </Button>
              <Button
                variant="ghost"
                disabled={indice === (camposQuery.data?.length ?? 0) - 1}
                onClick={() => mover(campo, 1)}
              >
                ↓
              </Button>
              <Button variant="ghost" onClick={() => remover(campo)}>
                Remover
              </Button>
            </div>
          </Card>
        ))}
        {camposQuery.data?.length === 0 && (
          <Card className="text-sm text-rope">Nenhum campo definido ainda.</Card>
        )}
      </div>
    </div>
  )
}
