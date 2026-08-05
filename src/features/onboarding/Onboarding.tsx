import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { identificadorDeSessao } from '../../lib/identificador'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Stamp } from '../../components/Stamp'
import { Input, Label, FieldError } from '../../components/Field'

const CODIGO_ALFABETO = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function gerarCodigoConvite() {
  return Array.from({ length: 7 }, () => CODIGO_ALFABETO[Math.floor(Math.random() * CODIGO_ALFABETO.length)]).join('')
}

function fotoDeGoogle(user: { user_metadata?: Record<string, unknown> } | undefined) {
  const metadata = user?.user_metadata ?? {}
  return (metadata.avatar_url as string | undefined) ?? (metadata.picture as string | undefined) ?? null
}

function nomeDeGoogle(user: { user_metadata?: Record<string, unknown> } | undefined) {
  const metadata = user?.user_metadata ?? {}
  return (metadata.full_name as string | undefined) ?? (metadata.name as string | undefined) ?? ''
}

const academiaSchema = z.object({
  nome: z.string().min(2, 'Informe o nome da academia'),
  seuNome: z.string().min(2, 'Informe seu nome'),
})
type AcademiaForm = z.infer<typeof academiaSchema>

export function Onboarding() {
  const { session, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [erro, setErro] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AcademiaForm>({
    resolver: zodResolver(academiaSchema),
    defaultValues: { nome: '', seuNome: nomeDeGoogle(session?.user) },
  })

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-ink px-6 py-12">
      <Stamp className="h-14 w-14 text-hanko" />
      <Card className="mt-6 w-full max-w-lg">
        <h1 className="font-display text-2xl font-semibold text-chalk">Criar academia</h1>
        <p className="mt-1 text-sm text-rope">
          Você vira o admin dessa academia — depois é só mandar o link de convite pros professores e
          alunos.
        </p>
        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={handleSubmit(async ({ nome, seuNome }) => {
            setErro(null)
            try {
              if (!session) return
              let academia = null
              let ultimoErro = null
              for (let tentativa = 0; tentativa < 3 && !academia; tentativa++) {
                const { data, error } = await supabase.rpc('create_academia', {
                  p_nome: nome,
                  p_codigo: gerarCodigoConvite(),
                  p_codigo_professor: gerarCodigoConvite(),
                })
                if (!error) {
                  academia = data
                  break
                }
                ultimoErro = error
              }
              if (!academia) throw ultimoErro ?? new Error('Não foi possível criar a academia')

              const { tipo, valor } = identificadorDeSessao(session.user.email!)
              const { error: profileError } = await supabase.from('profiles').insert({
                id: session.user.id,
                academia_id: academia.id,
                role: 'admin',
                nome: seuNome,
                foto_url: fotoDeGoogle(session.user),
                identificador_tipo: tipo,
                identificador_valor: valor,
              })
              if (profileError) throw profileError

              await refreshProfile()
              navigate('/admin', { replace: true })
            } catch (err) {
              setErro(err instanceof Error ? err.message : 'Não foi possível criar a academia')
            }
          })}
        >
          <div>
            <Label htmlFor="nome-academia">Nome da academia</Label>
            <Input id="nome-academia" placeholder="Ex: Gracie Barra Centro" {...register('nome')} />
            <FieldError>{errors.nome?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="seu-nome">Seu nome</Label>
            <Input id="seu-nome" {...register('seuNome')} />
            <FieldError>{errors.seuNome?.message}</FieldError>
          </div>
          <FieldError>{erro ?? undefined}</FieldError>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Criando…' : 'Criar academia'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
