import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Formulario } from '../types/database'

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
