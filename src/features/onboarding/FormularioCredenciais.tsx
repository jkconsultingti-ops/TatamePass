import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../../auth/AuthProvider'
import { identificadorParaEmailAuth, emailValido, telefoneValido } from '../../lib/identificador'
import { Button } from '../../components/Button'
import { Label, Input, FieldError } from '../../components/Field'

const credenciaisSchema = z.object({
  identificador: z
    .string()
    .min(1, 'Informe seu e-mail ou telefone')
    .refine((v) => emailValido(v) || telefoneValido(v), 'Informe um e-mail ou telefone válido'),
  senha: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres'),
})
type CredenciaisForm = z.infer<typeof credenciaisSchema>

type Modo = 'entrar' | 'criar-conta'

export function FormularioCredenciais({
  mensagemConfirmarEmail = 'Conta criada! Verifique seu e-mail para confirmar antes de entrar.',
}: {
  mensagemConfirmarEmail?: string
}) {
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
      const tipo = emailValido(values.identificador) ? 'email' : 'telefone'
      const email = identificadorParaEmailAuth(tipo, values.identificador)
      if (modo === 'entrar') {
        await signInWithPassword(email, values.senha)
      } else {
        const { precisaConfirmarEmail } = await signUpWithPassword(email, values.senha)
        if (precisaConfirmarEmail) {
          setMensagem(mensagemConfirmarEmail)
        }
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível continuar')
    }
  }

  return (
    <div className="w-full max-w-sm text-left">
      <div className="mb-5 flex gap-1 rounded-sm border border-rope-dim/40 p-1">
        <button
          type="button"
          onClick={() => trocarModo('entrar')}
          className={`flex-1 rounded-sm py-2.5 font-mono text-sm uppercase tracking-wide transition-colors ${
            modo === 'entrar' ? 'bg-hanko/15 text-hanko' : 'text-rope hover:text-chalk'
          }`}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => trocarModo('criar-conta')}
          className={`flex-1 rounded-sm py-2.5 font-mono text-sm uppercase tracking-wide transition-colors ${
            modo === 'criar-conta' ? 'bg-hanko/15 text-hanko' : 'text-rope hover:text-chalk'
          }`}
        >
          Criar conta
        </button>
      </div>

      <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <Label htmlFor="identificador" tamanho="lg">
            E-mail ou telefone
          </Label>
          <Input
            id="identificador"
            tamanho="lg"
            placeholder="voce@exemplo.com ou (19) 99999-9999"
            autoComplete="username"
            {...register('identificador')}
          />
          <FieldError>{errors.identificador?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="senha" tamanho="lg">
            Senha
          </Label>
          <Input
            id="senha"
            tamanho="lg"
            type="password"
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            {...register('senha')}
          />
          <FieldError>{errors.senha?.message}</FieldError>
        </div>
        <FieldError>{erro ?? undefined}</FieldError>
        {mensagem && <p className="font-mono text-xs text-mat-light">{mensagem}</p>}
        <Button type="submit" tamanho="lg" disabled={isSubmitting}>
          {isSubmitting ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-rope-dim/30" />
        <span className="font-mono text-[11px] uppercase tracking-wide text-rope-dim">ou</span>
        <span className="h-px flex-1 bg-rope-dim/30" />
      </div>

      <Button variant="secondary" tamanho="lg" onClick={() => signInWithGoogle()} className="w-full">
        Entrar com Google
      </Button>
    </div>
  )
}
