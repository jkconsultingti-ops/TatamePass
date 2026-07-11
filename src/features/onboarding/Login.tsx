import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../../auth/AuthProvider'
import { Button } from '../../components/Button'
import { Stamp } from '../../components/Stamp'
import { Label, Input, FieldError } from '../../components/Field'

const credenciaisSchema = z.object({
  email: z.string().min(1, 'Informe seu e-mail').email('E-mail inválido'),
  senha: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres'),
})
type CredenciaisForm = z.infer<typeof credenciaisSchema>

type Modo = 'entrar' | 'criar-conta'

export function Login() {
  const { signInWithGoogle, signInWithPassword, signUpWithPassword } = useAuth()
  const [modo, setModo] = useState<Modo>('entrar')
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CredenciaisForm>({ resolver: zodResolver(credenciaisSchema) })

  function trocarModo(novoModo: Modo) {
    setModo(novoModo)
    setErro(null)
    setMensagem(null)
    reset()
  }

  async function onSubmit(values: CredenciaisForm) {
    setErro(null)
    setMensagem(null)
    try {
      if (modo === 'entrar') {
        await signInWithPassword(values.email, values.senha)
      } else {
        const { precisaConfirmarEmail } = await signUpWithPassword(values.email, values.senha)
        if (precisaConfirmarEmail) {
          setMensagem('Conta criada! Verifique seu e-mail para confirmar antes de entrar.')
        }
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível continuar')
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-ink px-6 py-12 text-center">
      <Stamp className="stamp-in h-24 w-24 text-hanko" />
      <h1 className="mt-6 font-display text-4xl font-semibold text-chalk sm:text-5xl">
        TatamePass
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-rope">
        A caderneta digital da sua academia. Cada aula frequentada, um carimbo.
      </p>

      <div className="mt-10 w-full max-w-sm text-left">
        <div className="mb-5 flex gap-1 rounded-sm border border-rope-dim/40 p-1">
          <button
            type="button"
            onClick={() => trocarModo('entrar')}
            className={`flex-1 rounded-sm py-2 font-mono text-xs uppercase tracking-wide transition-colors ${
              modo === 'entrar' ? 'bg-hanko/15 text-hanko' : 'text-rope hover:text-chalk'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => trocarModo('criar-conta')}
            className={`flex-1 rounded-sm py-2 font-mono text-xs uppercase tracking-wide transition-colors ${
              modo === 'criar-conta' ? 'bg-hanko/15 text-hanko' : 'text-rope hover:text-chalk'
            }`}
          >
            Criar conta
          </button>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            <FieldError>{errors.email?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
              {...register('senha')}
            />
            <FieldError>{errors.senha?.message}</FieldError>
          </div>
          <FieldError>{erro ?? undefined}</FieldError>
          {mensagem && <p className="font-mono text-xs text-mat-light">{mensagem}</p>}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-rope-dim/30" />
          <span className="font-mono text-[11px] uppercase tracking-wide text-rope-dim">ou</span>
          <span className="h-px flex-1 bg-rope-dim/30" />
        </div>

        <Button variant="secondary" onClick={() => signInWithGoogle()} className="w-full">
          Entrar com Google
        </Button>
      </div>
    </div>
  )
}
