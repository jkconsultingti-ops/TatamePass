import { createBrowserRouter } from 'react-router-dom'
import { GuestRoute, OnboardingRoute, ProtectedRoute, CatchAllRedirect } from './auth/ProtectedRoute'
import { Login } from './features/onboarding/Login'
import { Onboarding } from './features/onboarding/Onboarding'
import { AlunoLayout } from './features/aluno/AlunoLayout'
import { AlunoDashboard } from './features/aluno/AlunoDashboard'
import { AlunoPerfil } from './features/aluno/AlunoPerfil'
import { AlunoTurmas } from './features/aluno/AlunoTurmas'
import { ProfessorLayout } from './features/professor/ProfessorLayout'
import { ProfessorDashboard } from './features/professor/ProfessorDashboard'
import { ProfessorTurmas } from './features/professor/ProfessorTurmas'
import { ProfessorAgenda } from './features/professor/ProfessorAgenda'
import { ProfessorAlunos } from './features/professor/ProfessorAlunos'
import { ProfessorAlunoDetalhe } from './features/professor/ProfessorAlunoDetalhe'
import { ProfessorPerfilForm } from './features/professor/ProfessorPerfilForm'

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [{ path: '/login', element: <Login /> }],
  },
  {
    element: <OnboardingRoute />,
    children: [{ path: '/onboarding', element: <Onboarding /> }],
  },
  {
    element: <ProtectedRoute role="aluno" />,
    children: [
      {
        element: <AlunoLayout />,
        children: [
          { path: '/aluno', element: <AlunoDashboard /> },
          { path: '/aluno/perfil', element: <AlunoPerfil /> },
          { path: '/aluno/turmas', element: <AlunoTurmas /> },
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
          { path: '/professor/turmas', element: <ProfessorTurmas /> },
          { path: '/professor/alunos', element: <ProfessorAlunos /> },
          { path: '/professor/alunos/:id', element: <ProfessorAlunoDetalhe /> },
          { path: '/professor/perfil-form', element: <ProfessorPerfilForm /> },
        ],
      },
    ],
  },
  { path: '/', element: <CatchAllRedirect /> },
  { path: '*', element: <CatchAllRedirect /> },
])
