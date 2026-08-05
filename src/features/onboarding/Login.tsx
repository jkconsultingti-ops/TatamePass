import { Link } from 'react-router-dom'
import { Stamp } from '../../components/Stamp'
import { FormularioCredenciais } from './FormularioCredenciais'

export function Login() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-ink px-6 py-12 text-center">
      <Stamp className="stamp-in h-24 w-24 text-hanko" />
      <h1 className="mt-6 font-display text-4xl font-semibold text-chalk sm:text-5xl">
        TatamePass
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-rope">
        A caderneta digital da sua academia. Cada aula frequentada, um carimbo.
      </p>

      {/* w-full aqui é obrigatório: o pai é flex + items-center, então este
          filho encolheria até o conteúdo e o max-w do formulário nunca
          valeria (largura percentual sobre um pai sem largura). */}
      <div className="mt-10 w-full max-w-sm">
        <FormularioCredenciais />
      </div>

      <Link to="/privacidade" className="mt-8 font-mono text-xs text-rope hover:text-hanko">
        Política de Privacidade
      </Link>
    </div>
  )
}
