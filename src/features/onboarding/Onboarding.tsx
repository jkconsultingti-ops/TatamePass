import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Stamp } from '../../components/Stamp'
import { Input, Label, FieldError } from '../../components/Field'

type Modo = 'escolha' | 'professor' | 'aluno'

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

const alunoSchema = z.object({
  codigo: z.string().min(4, 'Código inválido'),
  seuNome: z.string().min(2, 'Informe seu nome'),
})
type AlunoForm = z.infer<typeof alunoSchema>

export function Onboarding() {
  const [modo, setModo] = useState<Modo>('escolha')
  const { session, refreshProfile } = useAuth()
  const navigate = useNavigate()

  if (modo === 'escolha') {
    return (
      <OnboardingShell titulo="Bem-vindo(a)" subtitulo="Você faz parte de uma academia ou está abrindo uma nova?">
        <div className="flex flex-col gap-3">
          <Button onClick={() => setModo('professor')}>Sou professor, criar minha academia</Button>
          <Button variant="secondary" onClick={() => setModo('aluno')}>
            Sou aluno, entrar com um código
          </Button>
        </div>
      </OnboardingShell>
    )
  }

  if (modo === 'professor') {
    return (
      <OnboardingShell titulo="Criar academia" subtitulo="Você vira o professor/admin dessa academia.">
        <FormularioAcademia
          defaultNome={nomeDeGoogle(session?.user)}
          onVoltar={() => setModo('escolha')}
          onCriar={async ({ nome, seuNome }) => {
            if (!session) return
            let academia = null
            let erro = null
            for (let tentativa = 0; tentativa < 3 && !academia; tentativa++) {
              const { data, error } = await supabase.rpc('create_academia', {
                p_nome: nome,
                p_codigo: gerarCodigoConvite(),
              })
              if (!error) {
                academia = data
                break
              }
              erro = error
            }
            if (!academia) throw erro ?? new Error('Não foi possível criar a academia')

            const { error: profileError } = await supabase.from('profiles').insert({
              id: session.user.id,
              academia_id: academia.id,
              role: 'professor',
              nome: seuNome,
              foto_url: fotoDeGoogle(session.user),
            })
            if (profileError) throw profileError

            await refreshProfile()
            navigate('/professor', { replace: true })
          }}
        />
      </OnboardingShell>
    )
  }

  return (
    <OnboardingShell titulo="Entrar em uma academia" subtitulo="Peça o código de convite ao seu professor.">
      <FormularioAluno
        defaultNome={nomeDeGoogle(session?.user)}
        onVoltar={() => setModo('escolha')}
        onEntrar={async ({ codigo, seuNome }) => {
          if (!session) return
          const { data, error } = await supabase.rpc('resolve_convite', {
            p_codigo: codigo.trim().toUpperCase(),
          })
          if (error) throw error
          const academia = data?.[0]
          if (!academia) throw new Error('Código não encontrado. Confira com seu professor.')

          const { error: profileError } = await supabase.from('profiles').insert({
            id: session.user.id,
            academia_id: academia.academia_id,
            role: 'aluno',
            nome: seuNome,
            foto_url: fotoDeGoogle(session.user),
          })
          if (profileError) throw profileError

          await refreshProfile()
          navigate('/aluno', { replace: true })
        }}
      />
    </OnboardingShell>
  )
}

function OnboardingShell({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string
  subtitulo: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-ink px-6 py-12">
      <Stamp className="h-14 w-14 text-hanko" />
      <Card className="mt-6 w-full max-w-sm">
        <h1 className="font-display text-2xl font-semibold text-chalk">{titulo}</h1>
        <p className="mt-1 text-sm text-rope">{subtitulo}</p>
        <div className="mt-6">{children}</div>
      </Card>
    </div>
  )
}

function FormularioAcademia({
  defaultNome,
  onVoltar,
  onCriar,
}: {
  defaultNome: string
  onVoltar: () => void
  onCriar: (values: AcademiaForm) => Promise<void>
}) {
  const [erro, setErro] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AcademiaForm>({
    resolver: zodResolver(academiaSchema),
    defaultValues: { nome: '', seuNome: defaultNome },
  })

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(async (values) => {
        setErro(null)
        try {
          await onCriar(values)
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
        <Label htmlFor="seu-nome-professor">Seu nome</Label>
        <Input id="seu-nome-professor" {...register('seuNome')} />
        <FieldError>{errors.seuNome?.message}</FieldError>
      </div>
      <FieldError>{erro ?? undefined}</FieldError>
      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onVoltar}>
          Voltar
        </Button>
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? 'Criando…' : 'Criar academia'}
        </Button>
      </div>
    </form>
  )
}

function FormularioAluno({
  defaultNome,
  onVoltar,
  onEntrar,
}: {
  defaultNome: string
  onVoltar: () => void
  onEntrar: (values: AlunoForm) => Promise<void>
}) {
  const [erro, setErro] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AlunoForm>({
    resolver: zodResolver(alunoSchema),
    defaultValues: { codigo: '', seuNome: defaultNome },
  })

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(async (values) => {
        setErro(null)
        try {
          await onEntrar(values)
        } catch (err) {
          setErro(err instanceof Error ? err.message : 'Não foi possível entrar na academia')
        }
      })}
    >
      <div>
        <Label htmlFor="codigo-convite">Código de convite</Label>
        <Input
          id="codigo-convite"
          placeholder="Ex: 7K2M9XQ"
          className="font-mono uppercase tracking-widest"
          {...register('codigo')}
        />
        <FieldError>{errors.codigo?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="seu-nome-aluno">Seu nome</Label>
        <Input id="seu-nome-aluno" {...register('seuNome')} />
        <FieldError>{errors.seuNome?.message}</FieldError>
      </div>
      <FieldError>{erro ?? undefined}</FieldError>
      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onVoltar}>
          Voltar
        </Button>
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </div>
    </form>
  )
}
