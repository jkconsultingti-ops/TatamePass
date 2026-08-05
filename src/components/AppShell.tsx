import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Stamp } from './Stamp'
import { NotificacoesProfessor } from '../features/professor/NotificacoesProfessor'
import { NotificacoesAluno } from '../features/aluno/NotificacoesAluno'

interface AppShellProps {
  children: ReactNode
  nav: { to: string; label: string }[]
}

export function AppShell({ children, nav }: AppShellProps) {
  const { profile, academia, signOut } = useAuth()

  return (
    <div className="min-h-svh bg-ink text-chalk">
      <header className="border-b border-rope-dim/20">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-hanko">
            {academia?.logo_url ? (
              <img src={academia.logo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <Stamp className="h-8 w-8" />
            )}
            <span className="font-display text-lg font-semibold text-chalk">
              {academia?.nome ?? 'TatamePass'}
            </span>
          </div>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-sm px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
                    isActive ? 'bg-hanko/15 text-hanko' : 'text-rope hover:text-chalk'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {profile?.role !== 'aluno' && <NotificacoesProfessor />}
            {profile?.role === 'aluno' && <NotificacoesAluno />}
            <span className="hidden font-mono text-xs text-rope sm:inline">{profile?.nome}</span>
            <button
              type="button"
              onClick={() => signOut()}
              className="font-mono text-xs text-rope hover:text-hanko"
            >
              sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  )
}
