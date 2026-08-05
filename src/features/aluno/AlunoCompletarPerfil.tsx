import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { usePerfilCompleto, respostaPreenchida } from '../../lib/formularios'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Stamp } from '../../components/Stamp'
import { Label, Input } from '../../components/Field'
import { CampoPerfilInput } from '../../components/CampoPerfilInput'
import { FullscreenLoader } from '../../components/FullscreenLoader'
import type { Academia, PerfilCampo, PerfilResposta } from '../../types/database'

/** Tela de gate: aparece logo depois do convite, antes do aluno ver o
 * dashboard, enquanto faltar nome ou algum campo obrigatório do formulário
 * da academia. Fora do AlunoLayout de propósito — com menu o aluno
 * conseguiria escapar sem preencher. */
export function AlunoCompletarPerfil() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { carregando, completo, campos, respostas } = usePerfilCompleto()

  const [nome, setNome] = useState(profile?.nome ?? '')
  const [valores, setValores] = useState<Record<string, string>>({})
  const [uploadCampo, setUploadCampo] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [faltando, setFaltando] = useState<string[]>([])

  useEffect(() => setNome(profile?.nome ?? ''), [profile?.nome])

  useEffect(() => {
    const mapa: Record<string, string> = {}
    for (const resposta of respostas) {
      if (resposta.valor_texto) mapa[resposta.campo_id] = resposta.valor_texto
    }
    setValores(mapa)
  }, [respostas])

  const academiaQuery = useQuery({
    queryKey: ['academia', profile?.academia_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academias')
        .select('*')
        .eq('id', profile!.academia_id)
        .single()
      if (error) throw error
      return data as Academia
    },
    enabled: !!profile,
  })

  const documentoExistente = (campoId: string) => respostas.find((r) => r.campo_id === campoId)?.arquivo_url

  async function enviarDocumento(campo: PerfilCampo, arquivo: File) {
    if (!profile) return
    setUploadCampo(campo.id)
    setErro(null)
    try {
      const caminho = `${profile.academia_id}/${profile.id}/${campo.id}-${arquivo.name}`
      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(caminho, arquivo, { upsert: true })
      if (uploadError) throw uploadError

      const { error } = await supabase
        .from('perfil_respostas')
        .upsert(
          { aluno_id: profile.id, campo_id: campo.id, arquivo_url: caminho },
          { onConflict: 'aluno_id,campo_id' },
        )
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['perfil_respostas', profile.id] })
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar o arquivo')
    } finally {
      setUploadCampo(null)
    }
  }

  async function concluir() {
    if (!profile) return
    setErro(null)

    const semNome = !nome.trim()
    const camposFaltando = campos.filter((campo) => {
      if (!campo.obrigatorio) return false
      if (campo.tipo === 'documento') return !documentoExistente(campo.id)
      const respostaLocal = { valor_texto: valores[campo.id] ?? '' } as PerfilResposta
      return !respostaPreenchida(campo, respostaLocal)
    })

    if (semNome || camposFaltando.length > 0) {
      setFaltando([...(semNome ? ['Nome completo'] : []), ...camposFaltando.map((c) => c.label)])
      return
    }
    setFaltando([])

    setEnviando(true)
    try {
      const { error: erroNome } = await supabase
        .from('profiles')
        .update({ nome: nome.trim() })
        .eq('id', profile.id)
      if (erroNome) throw erroNome

      const camposTexto = campos.filter((c) => c.tipo !== 'documento')
      if (camposTexto.length > 0) {
        const { error: erroRespostas } = await supabase.from('perfil_respostas').upsert(
          camposTexto.map((campo) => ({
            aluno_id: profile.id,
            campo_id: campo.id,
            valor_texto: valores[campo.id] ?? '',
          })),
          { onConflict: 'aluno_id,campo_id' },
        )
        if (erroRespostas) throw erroRespostas
      }

      await Promise.all([
        refreshProfile(),
        queryClient.invalidateQueries({ queryKey: ['perfil_respostas', profile.id] }),
      ])
      navigate('/aluno', { replace: true })
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível concluir o cadastro')
    } finally {
      setEnviando(false)
    }
  }

  if (carregando) return <FullscreenLoader />
  if (completo) return <Navigate to="/aluno" replace />

  return (
    <div className="flex min-h-svh flex-col items-center bg-ink px-6 py-12">
      <Stamp className="h-14 w-14 text-hanko" />
      <div className="mt-6 w-full max-w-lg">
        <h1 className="font-display text-2xl font-semibold text-chalk">
          Complete seu cadastro{academiaQuery.data ? ` na ${academiaQuery.data.nome}` : ''}
        </h1>
        <p className="mt-1 text-sm text-rope">
          Só falta preencher os dados abaixo pra liberar seu acesso.
        </p>

        <h2 className="mt-6 font-mono text-xs uppercase tracking-[0.14em] text-rope-dim">Seus dados</h2>
        <Card className="mt-3 flex flex-col divide-y divide-rope-dim/20">
          <div className="pb-4">
            <Label htmlFor="nome-completo">Nome completo *</Label>
            <Input id="nome-completo" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          {campos.map((campo) => (
            <div key={campo.id} className="py-4 first:pt-0 last:pb-0">
              <Label htmlFor={campo.id}>
                {campo.label}
                {campo.obrigatorio ? ' *' : ''}
              </Label>
              <CampoPerfilInput
                campo={campo}
                valor={valores[campo.id] ?? ''}
                onChange={(valor) => setValores((v) => ({ ...v, [campo.id]: valor }))}
                onArquivo={(arquivo) => enviarDocumento(campo, arquivo)}
                documentoEnviado={!!documentoExistente(campo.id)}
                enviandoArquivo={uploadCampo === campo.id}
              />
            </div>
          ))}
        </Card>

        <div className="mt-4 flex flex-col gap-4">
          {faltando.length > 0 && (
            <p className="font-mono text-xs text-hanko">
              Faltam: {faltando.join(', ')}
            </p>
          )}
          {erro && <p className="font-mono text-xs text-hanko">{erro}</p>}

          <Button onClick={concluir} disabled={enviando}>
            {enviando ? 'Enviando…' : 'Concluir cadastro'}
          </Button>
        </div>
      </div>
    </div>
  )
}
