import { Outlet } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'

const nav = [
  { to: '/professor', label: 'Painel' },
  { to: '/professor/turmas', label: 'Turmas' },
  { to: '/professor/alunos', label: 'Alunos' },
  { to: '/professor/perfil-form', label: 'Formulário' },
]

export function ProfessorLayout() {
  return (
    <AppShell nav={nav}>
      <Outlet />
    </AppShell>
  )
}
