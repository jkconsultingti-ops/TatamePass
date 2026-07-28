import { Outlet } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'

const nav = [
  { to: '/professor', label: 'Painel' },
  { to: '/professor/agenda', label: 'Agenda' },
  { to: '/professor/alunos', label: 'Alunos' },
  { to: '/professor/graduacao', label: 'Graduação' },
]

export function ProfessorLayout() {
  return (
    <AppShell nav={nav}>
      <Outlet />
    </AppShell>
  )
}
