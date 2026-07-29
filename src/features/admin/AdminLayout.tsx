import { Outlet } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'

const nav = [
  { to: '/admin', label: 'Painel' },
  { to: '/admin/agenda', label: 'Agenda' },
  { to: '/admin/turmas', label: 'Turmas' },
  { to: '/admin/alunos', label: 'Alunos' },
  { to: '/admin/professores', label: 'Professores' },
  { to: '/admin/graduacao', label: 'Graduação' },
  { to: '/admin/perfil-form', label: 'Formulário' },
  { to: '/admin/marca', label: 'Marca' },
]

export function AdminLayout() {
  return (
    <AppShell nav={nav}>
      <Outlet />
    </AppShell>
  )
}
