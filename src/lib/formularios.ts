import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from '../auth/AuthProvider'
import type { Formulario, PerfilCampo, PerfilResposta } from '../types/database'

export function useFormularios(academiaId: string | undefined) {
  return useQuery({
    queryKey: ['formularios', academiaId],
    queryFn: async () => {
      const { data, error } = await supabase.from('formularios').select('*').order('criado_em')
      if (error) throw error
      return data as Formulario[]
    },
    enabled: !!academiaId,
  })
}

export function formularioPadrao(formularios: Formulario[] | undefined) {
  return formularios?.find((f) => f.padrao)
}

export function decodeCaixas(valor: string | null | undefined): string[] {
  if (!valor) return []
  try {
    const lista = JSON.parse(valor)
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

export function encodeCaixas(valores: string[]): string {
  return JSON.stringify(valores)
}

/** Um campo conta como preenchido conforme o tipo: documento precisa de
 * arquivo, caixa de seleção precisa de pelo menos uma opção marcada, o
 * resto precisa de texto não vazio. */
export function respostaPreenchida(campo: PerfilCampo, resposta: PerfilResposta | undefined): boolean {
  if (!resposta) return false
  if (campo.tipo === 'documento') return !!resposta.arquivo_url
  if (campo.tipo === 'caixa_selecao') return decodeCaixas(resposta.valor_texto).length > 0
  return !!resposta.valor_texto?.trim()
}

/** Perfil "completo" = nome preenchido e todo campo obrigatório do
 * formulário padrão respondido. Usa as mesmas query keys que AlunoPerfil.tsx
 * já usa, então o cache é compartilhado entre o gate e a tela de edição. */
export function usePerfilCompleto() {
  const { profile } = useAuth()
  const formulariosQuery = useFormularios(profile?.academia_id)
  const formulario = formularioPadrao(formulariosQuery.data)

  const camposQuery = useQuery({
    queryKey: ['perfil_campos', formulario?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfil_campos')
        .select('*')
        .eq('formulario_id', formulario!.id)
        .order('ordem')
      if (error) throw error
      return data as PerfilCampo[]
    },
    enabled: !!formulario,
  })

  const respostasQuery = useQuery({
    queryKey: ['perfil_respostas', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfil_respostas')
        .select('*')
        .eq('aluno_id', profile!.id)
      if (error) throw error
      return data as PerfilResposta[]
    },
    enabled: !!profile,
  })

  const campos = camposQuery.data ?? []
  const respostas = respostasQuery.data ?? []

  const carregando =
    !profile ||
    formulariosQuery.isPending ||
    respostasQuery.isPending ||
    (!!formulario && camposQuery.isPending)

  const nomeCompleto = !!profile?.nome?.trim()
  const obrigatoriosCompletos = campos
    .filter((c) => c.obrigatorio)
    .every((c) => respostaPreenchida(c, respostas.find((r) => r.campo_id === c.id)))

  return {
    carregando,
    completo: nomeCompleto && obrigatoriosCompletos,
    formulario,
    campos,
    respostas,
  }
}
