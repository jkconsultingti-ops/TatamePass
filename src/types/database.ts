export type UserRole = 'aluno' | 'professor'
export type CampoTipo =
  | 'texto_curto'
  | 'texto_longo'
  | 'numero'
  | 'multipla_escolha'
  | 'caixa_selecao'
  | 'lista_suspensa'
  | 'data'
  | 'documento'

export type Academia = {
  id: string
  nome: string
  codigo_convite: string
  criado_em: string
}

export type Profile = {
  id: string
  academia_id: string
  role: UserRole
  nome: string
  foto_url: string | null
  turma_principal_id: string | null
  criado_em: string
}

export type Turma = {
  id: string
  academia_id: string
  nome: string
  professor_id: string
  dias_semana: number[]
  horario_inicio: string
  horario_fim: string
  janela_checkin_antes_horas: number
  janela_checkin_depois_horas: number
  criado_em: string
}

export type Checkin = {
  id: string
  aluno_id: string
  turma_id: string
  academia_id: string
  data: string
  avulso: boolean
  criado_em: string
}

export type Formulario = {
  id: string
  academia_id: string
  nome: string
  padrao: boolean
  criado_em: string
}

export type PerfilCampo = {
  id: string
  academia_id: string
  formulario_id: string
  label: string
  tipo: CampoTipo
  obrigatorio: boolean
  opcoes: string[] | null
  ordem: number
  criado_em: string
}

export type PerfilResposta = {
  id: string
  aluno_id: string
  campo_id: string
  valor_texto: string | null
  arquivo_url: string | null
  atualizado_em: string
}

export type Graduacao = {
  id: string
  aluno_id: string
  faixa: string
  grau: number | null
  concedido_por: string
  concedido_em: string
  observacao: string | null
  criado_em: string
}

type TableOf<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] }

export type Database = {
  public: {
    Tables: {
      academias: TableOf<Academia>
      profiles: TableOf<Profile>
      turmas: TableOf<Turma>
      checkins: TableOf<Checkin>
      formularios: TableOf<Formulario>
      perfil_campos: TableOf<PerfilCampo>
      perfil_respostas: TableOf<PerfilResposta>
      graduacoes: TableOf<Graduacao>
    }
    Views: Record<string, never>
    Functions: {
      create_academia: {
        Args: { p_nome: string; p_codigo: string }
        Returns: Academia
      }
      resolve_convite: {
        Args: { p_codigo: string }
        Returns: { academia_id: string; nome: string }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export const DIAS_SEMANA = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const

export const TIPOS_CAMPO: { valor: CampoTipo; rotulo: string; temOpcoes: boolean }[] = [
  { valor: 'texto_curto', rotulo: 'Texto curto', temOpcoes: false },
  { valor: 'texto_longo', rotulo: 'Texto longo', temOpcoes: false },
  { valor: 'numero', rotulo: 'Número', temOpcoes: false },
  { valor: 'data', rotulo: 'Data', temOpcoes: false },
  { valor: 'multipla_escolha', rotulo: 'Múltipla escolha', temOpcoes: true },
  { valor: 'caixa_selecao', rotulo: 'Caixas de seleção', temOpcoes: true },
  { valor: 'lista_suspensa', rotulo: 'Lista suspensa', temOpcoes: true },
  { valor: 'documento', rotulo: 'Documento', temOpcoes: false },
]
