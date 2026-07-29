import { createBrowserRouter } from 'react-router-dom'
import {
  GuestRoute,
  OnboardingRoute,
  ProtectedRoute,
  PerfilCompletoRoute,
  CatchAllRedirect,
} from './auth/ProtectedRoute'
import { Login } from './features/onboarding/Login'
import { ConviteEntrar } from './features/onboarding/ConviteEntrar'
import { PoliticaPrivacidade } from './features/legal/PoliticaPrivacidade'
import { Onboarding } from './features/onboarding/Onboarding'
import { AlunoLayout } from './features/aluno/AlunoLayout'
import { AlunoDashboard } from './features/aluno/AlunoDashboard'
import { AlunoPerfil } from './features/aluno/AlunoPerfil'
import { AlunoCompletarPerfil } from './features/aluno/AlunoCompletarPerfil'
import { AlunoTurmas } from './features/aluno/AlunoTurmas'
import { AlunoGraduacao } from './features/aluno/AlunoGraduacao'
import { ProfessorLayout } from './features/professor/ProfessorLayout'
import { ProfessorDashboard } from './features/professor/ProfessorDashboard'
import { ProfessorAgenda } from './features/professor/ProfessorAgenda'
import { ProfessorAlunos } from './features/professor/ProfessorAlunos'
import { ProfessorAlunoDetalhe } from './features/professor/ProfessorAlunoDetalhe'
import { ProfessorGraduacao } from './features/professor/ProfessorGraduacao'
import { AdminLayout } from './features/admin/AdminLayout'
import { AdminDashboard } from './features/admin/AdminDashboard'
import { AdminTurmas } from './features/admin/AdminTurmas'
import { AdminProfessores } from './features/admin/AdminProfessores'
import { AdminPerfilForm } from './features/admin/AdminPerfilForm'
import { AdminMarca } from './features/admin/AdminMarca'

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [{ path: '/login', element: <Login /> }],
  },
  {
    element: <OnboardingRoute />,
    children: [{ path: '/onboarding', element: <Onboarding /> }],
  },
  { path: '/convite/:codigo', element: <ConviteEntrar /> },
  {
    element: <ProtectedRoute role="aluno" />,
    children: [
      { path: '/aluno/completar-perfil', element: <AlunoCompletarPerfil /> },
      {
        element: <PerfilCompletoRoute />,
        children: [
          {
            element: <AlunoLayout />,
            children: [
              { path: '/aluno', element: <AlunoDashboard /> },
              { path: '/aluno/perfil', element: <AlunoPerfil /> },
              { path: '/aluno/turmas', element: <AlunoTurmas /> },
              { path: '/aluno/graduacao', element: <AlunoGraduacao /> },
            ],
          },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute role="professor" />,
    children: [
      {
        element: <ProfessorLayout />,
        children: [
          { path: '/professor', element: <ProfessorDashboard /> },
          { path: '/professor/agenda', element: <ProfessorAgenda /> },
          { path: '/professor/alunos', element: <ProfessorAlunos /> },
          { path: '/professor/alunos/:id', element: <ProfessorAlunoDetalhe /> },
          { path: '/professor/graduacao', element: <ProfessorGraduacao /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute role="admin" />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: '/admin', element: <AdminDashboard /> },
          { path: '/admin/agenda', element: <ProfessorAgenda /> },
          { path: '/admin/turmas', element: <AdminTurmas /> },
          { path: '/admin/alunos', element: <ProfessorAlunos /> },
          { path: '/admin/alunos/:id', element: <ProfessorAlunoDetalhe /> },
          { path: '/admin/professores', element: <AdminProfessores /> },
          { path: '/admin/graduacao', element: <ProfessorGraduacao /> },
          { path: '/admin/perfil-form', element: <AdminPerfilForm /> },
          { path: '/admin/marca', element: <AdminMarca /> },
        ],
      },
    ],
  },
  { path: '/privacidade', element: <PoliticaPrivacidade /> },
  { path: '/', element: <CatchAllRedirect /> },
  { path: '*', element: <CatchAllRedirect /> },
])
