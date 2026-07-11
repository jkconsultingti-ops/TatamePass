import { Outlet } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'

const nav = [
  { to: '/aluno', label: 'Check-in' },
  { to: '/aluno/turmas', label: 'Turmas' },
  { to: '/aluno/perfil', label: 'Perfil' },
]

export function AlunoLayout() {
  return (
    <AppShell nav={nav}>
      <Outlet />
    </AppShell>
  )
}
