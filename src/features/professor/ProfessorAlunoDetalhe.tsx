import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { useFormularios, formularioPadrao, decodeCaixas } from '../../lib/formularios'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Badge } from '../../components/Badge'
import { Label, Input, Textarea, FieldError } from '../../components/Field'
import type { Profile, Checkin, PerfilCampo, PerfilResposta, Graduacao } from '../../types/database'

const graduacaoSchema = z.object({
  faixa: z.string().min(1, 'Informe a faixa'),
  grau: z.coerce.number().min(0).optional(),
  observacao: z.string().optional(),
})
type GraduacaoFormInput = z.input<typeof graduacaoSchema>
type GraduacaoFormOutput = z.output<typeof graduacaoSchema>

export function ProfessorAlunoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  const alunoQuery = useQuery({
    queryKey: ['aluno', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id!).single()
      if (error) throw error
      return data as Profile
    },
    enabled: !!id,
  })

  const checkinsQuery = useQuery({
    queryKey: ['checkins-aluno', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .eq('aluno_id', id!)
        .order('data', { ascending: false })
        .limit(30)
      if (error) throw error
      return data as Checkin[]
    },
    enabled: !!id,
  })

  const formulariosQuery = useFormularios(profile?.academia_id)
  const formulario = formularioPadrao(formulariosQuery.data)

  const camposQuery = useQuery({
    queryKey: ['perfil_campos', formulario?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfil_campos')
        .select('*')
        .eq('formulario_id', formulario!.id)
        .order('ordem')
      if (error) throw error
      return data as PerfilCampo[]
    },
    enabled: !!formulario,
  })

  const respostasQuery = useQuery({
    queryKey: ['perfil_respostas-aluno', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('perfil_respostas').select('*').eq('aluno_id', id!)
      if (error) throw error
      return data as PerfilResposta[]
    },
    enabled: !!id,
  })

  const graduacoesQuery = useQuery({
    queryKey: ['graduacoes-aluno', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('graduacoes')
        .select('*')
        .eq('aluno_id', id!)
        .order('concedido_em', { ascending: false })
      if (error) throw error
      return data as Graduacao[]
    },
    enabled: !!id,
  })

  async function verDocumento(caminho: string) {
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(caminho, 60)
    if (error) {
      alert(error.message)
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GraduacaoFormInput, unknown, GraduacaoFormOutput>({
    resolver: zodResolver(graduacaoSchema),
    defaultValues: { faixa: '', observacao: '' },
  })

  async function concederGraduacao(values: GraduacaoFormOutput) {
    if (!profile || !id) return
    const { error } = await supabase.from('graduacoes').insert({
      aluno_id: id,
      faixa: values.faixa,
      grau: values.grau ?? null,
      observacao: values.observacao || null,
      concedido_por: profile.id,
    })
    if (error) {
      alert(error.message)
      return
    }
    reset({ faixa: '', observacao: '' })
    await queryClient.invalidateQueries({ queryKey: ['graduacoes-aluno', id] })
  }

  if (!alunoQuery.data) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        {alunoQuery.data.foto_url ? (
          <img src={alunoQuery.data.foto_url} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="h-14 w-14 rounded-full bg-ink-soft" />
        )}
        <div>
          <h1 className="font-display text-2xl font-semibold text-chalk">{alunoQuery.data.nome}</h1>
          {graduacoesQuery.data?.[0] && (
            <Badge tone="mat">
              {graduacoesQuery.data[0].faixa}
              {graduacoesQuery.data[0].grau ? ` · grau ${graduacoesQuery.data[0].grau}` : ''}
            </Badge>
          )}
        </div>
      </div>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-rope">Conceder graduação</h2>
        <Card className="mt-3">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit(concederGraduacao)}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="faixa">Faixa</Label>
                <Input id="faixa" placeholder="Ex: Azul" {...register('faixa')} />
                <FieldError>{errors.faixa?.message}</FieldError>
              </div>
              <div>
                <Label htmlFor="grau">Grau (opcional)</Label>
                <Input id="grau" type="number" min={0} {...register('grau')} />
              </div>
            </div>
            <div>
              <Label htmlFor="observacao">Observação</Label>
              <Textarea id="observacao" {...register('observacao')} />
            </div>
            <Button type="submit" disabled={isSubmitting} className="self-start">
              Conceder
            </Button>
          </form>
        </Card>
        {graduacoesQuery.data && graduacoesQuery.data.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {graduacoesQuery.data.map((g) => (
              <Card key={g.id} className="flex items-center justify-between text-sm">
                <span className="text-chalk">
                  {g.faixa}
                  {g.grau ? ` · grau ${g.grau}` : ''}
                </span>
                <span className="font-mono text-xs text-rope">{g.concedido_em}</span>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-rope">Perfil</h2>
        <div className="mt-3 flex flex-col gap-2">
          {camposQuery.data?.map((campo) => {
            const resposta = respostasQuery.data?.find((r) => r.campo_id === campo.id)
            return (
              <Card key={campo.id} className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-rope">
                    {campo.label}
                  </p>
                  <p className="mt-1 text-sm text-chalk">
                    {campo.tipo === 'documento'
                      ? resposta?.arquivo_url
                        ? 'Documento enviado'
                        : '—'
                      : campo.tipo === 'caixa_selecao'
                        ? decodeCaixas(resposta?.valor_texto).join(', ') || '—'
                        : resposta?.valor_texto || '—'}
                  </p>
                </div>
                {campo.tipo === 'documento' && resposta?.arquivo_url && (
                  <Button variant="secondary" onClick={() => verDocumento(resposta.arquivo_url!)}>
                    Ver
                  </Button>
                )}
              </Card>
            )
          })}
          {camposQuery.data?.length === 0 && (
            <Card className="text-sm text-rope">Nenhum campo de perfil configurado.</Card>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-rope">Presença</h2>
        <Card className="mt-3 divide-y divide-rope-dim/15 p-0">
          {checkinsQuery.data?.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3">
              <span className="font-mono text-xs text-rope">{c.data}</span>
              {c.avulso && <Badge>avulso</Badge>}
            </div>
          ))}
          {checkinsQuery.data?.length === 0 && (
            <p className="p-4 text-sm text-rope">Nenhum check-in ainda.</p>
          )}
        </Card>
      </section>
    </div>
  )
}
