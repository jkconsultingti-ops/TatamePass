import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { AulaCancelada } from '../types/database'

export function useAulasCanceladas(academiaId: string | undefined) {
  return useQuery({
    queryKey: ['aulas_canceladas', academiaId],
    queryFn: async () => {
      const { data, error } = await supabase.from('aulas_canceladas').select('*').order('data')
      if (error) throw error
      return data as AulaCancelada[]
    },
    enabled: !!academiaId,
  })
}

export function aulaCanceladaEm(
  canceladas: AulaCancelada[] | undefined,
  turmaId: string,
  data: string,
) {
  return canceladas?.find((c) => c.turma_id === turmaId && c.data === data)
}
