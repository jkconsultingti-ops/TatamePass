import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { useFormularios, formularioPadrao } from '../../lib/formularios'
import { statusExameMedico, ROTULO_STATUS_EXAME, TONE_STATUS_EXAME } from '../../lib/exameMedico'
import { formatarData } from '../../lib/datas'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Badge } from '../../components/Badge'
import { Label, Input } from '../../components/Field'
import { CampoPerfilInput } from '../../components/CampoPerfilInput'
import type { PerfilCampo, PerfilResposta, Turma, ExameMedico } from '../../types/database'

const CAMPOS_COM_BOTAO_SALVAR: PerfilCampo['tipo'][] = ['texto_curto', 'texto_longo', 'numero', 'data']

export function AlunoPerfil() {
  const { profile, refreshProfile } = useAuth()
  const queryClient = useQueryClient()
  const [salvandoCampo, setSalvandoCampo] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [uploadCampo, setUploadCampo] = useState<string | null>(null)
  const [fotoEnviando, setFotoEnviando] = useState(false)
  const [turmaSalvando, setTurmaSalvando] = useState(false)
  const [nome, setNome] = useState(profile?.nome ?? '')
  const [nomeSalvando, setNomeSalvando] = useState(false)
  const [arquivoExame, setArquivoExame] = useState<File | null>(null)
  const [exameSalvando, setExameSalvando] = useState(false)

  useEffect(() => setNome(profile?.nome ?? ''), [profile?.nome])

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

  const turmasQuery = useQuery({
    queryKey: ['turmas', profile?.academia_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('turmas').select('*').order('nome')
      if (error) throw error
      return data as Turma[]
    },
    enabled: !!profile,
  })

  const exameQuery = useQuery({
    queryKey: ['exame_medico', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exames_medicos')
        .select('*')
        .eq('aluno_id', profile!.id)
        .maybeSingle()
      if (error) throw error
      return data as ExameMedico | null
    },
    enabled: !!profile,
  })

  useEffect(() => {
    if (!respostasQuery.data) return
    const mapa: Record<string, string> = {}
    for (const resposta of respostasQuery.data) {
      if (resposta.valor_texto) mapa[resposta.campo_id] = resposta.valor_texto
    }
    setValores(mapa)
  }, [respostasQuery.data])

  async function salvarNome() {
    if (!profile || !nome.trim() || nome.trim() === profile.nome) return
    setNomeSalvando(true)
    try {
      const { error } = await supabase.from('profiles').update({ nome: nome.trim() }).eq('id', profile.id)
      if (error) throw error
      await refreshProfile()
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Não foi possível salvar o nome')
    } finally {
      setNomeSalvando(false)
    }
  }

  async function salvarTurmaPrincipal(turmaId: string) {
    if (!profile) return
    setTurmaSalvando(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ turma_principal_id: turmaId || null })
        .eq('id', profile.id)
      if (error) throw error
      await refreshProfile()
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Não foi possível salvar a turma principal')
    } finally {
      setTurmaSalvando(false)
    }
  }

  async function salvarTexto(campo: PerfilCampo) {
    if (!profile) return
    setSalvandoCampo(campo.id)
    setMensagem(null)
    try {
      const { error } = await supabase
        .from('perfil_respostas')
        .upsert(
          { aluno_id: profile.id, campo_id: campo.id, valor_texto: valores[campo.id] ?? '' },
          { onConflict: 'aluno_id,campo_id' },
        )
      if (error) throw error
      setMensagem('Salvo.')
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Não foi possível salvar')
    } finally {
      setSalvandoCampo(null)
    }
  }

  async function salvarValorDireto(campo: PerfilCampo, valor: string) {
    if (!profile) return
    setMensagem(null)
    try {
      const { error } = await supabase
        .from('perfil_respostas')
        .upsert(
          { aluno_id: profile.id, campo_id: campo.id, valor_texto: valor },
          { onConflict: 'aluno_id,campo_id' },
        )
      if (error) throw error
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Não foi possível salvar')
    }
  }

  async function enviarDocumento(campo: PerfilCampo, arquivo: File) {
    if (!profile) return
    setUploadCampo(campo.id)
    setMensagem(null)
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
      setMensagem(err instanceof Error ? err.message : 'Não foi possível enviar o arquivo')
    } finally {
      setUploadCampo(null)
    }
  }

  async function trocarFoto(arquivo: File) {
    if (!profile) return
    setFotoEnviando(true)
    setMensagem(null)
    try {
      const caminho = `${profile.academia_id}/${profile.id}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(caminho, arquivo, { upsert: true })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(caminho)
      const { error } = await supabase
        .from('profiles')
        .update({ foto_url: `${data.publicUrl}?v=${Date.now()}` })
        .eq('id', profile.id)
      if (error) throw error
      await refreshProfile()
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Não foi possível trocar a foto')
    } finally {
      setFotoEnviando(false)
    }
  }

  async function enviarExameArquivo(arquivo: File) {
    if (!profile) return
    const caminho = `${profile.academia_id}/${profile.id}/exame-medico-${arquivo.name}`
    const { error } = await supabase.storage.from('documentos').upload(caminho, arquivo, { upsert: true })
    if (error) throw error
    return caminho
  }

  async function salvarExame() {
    if (!profile || !arquivoExame) return
    setExameSalvando(true)
    setMensagem(null)
    try {
      const arquivo_url = await enviarExameArquivo(arquivoExame)
      const { error } = await supabase.from('exames_medicos').upsert(
        {
          aluno_id: profile.id,
          academia_id: profile.academia_id,
          status: 'pendente',
          solicitado_em: new Date().toISOString(),
          arquivo_url,
          atualizado_por: profile.id,
        },
        { onConflict: 'aluno_id' },
      )
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['exame_medico', profile.id] })
      setArquivoExame(null)
      setMensagem('Enviado para análise do professor.')
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Não foi possível enviar o exame médico')
    } finally {
      setExameSalvando(false)
    }
  }

  const documentoExistente = (campoId: string) =>
    respostasQuery.data?.find((r) => r.campo_id === campoId)?.arquivo_url

  const statusExame = statusExameMedico(exameQuery.data)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-chalk">Meu perfil</h1>

      <Card className="flex items-center gap-4">
        {profile?.foto_url ? (
          <img src={profile.foto_url} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="h-16 w-16 rounded-full bg-ink" />
        )}
        <div>
          <Label htmlFor="foto">Foto de perfil</Label>
          <input
            id="foto"
            type="file"
            accept="image/*"
            disabled={fotoEnviando}
            onChange={(e) => e.target.files?.[0] && trocarFoto(e.target.files[0])}
            className="text-xs text-rope"
          />
        </div>
      </Card>

      <Card>
        <Label htmlFor="nome-completo">Nome completo</Label>
        <Input
          id="nome-completo"
          value={nome}
          disabled={nomeSalvando}
          onChange={(e) => setNome(e.target.value)}
          onBlur={salvarNome}
        />
      </Card>

      <Card>
        <Label htmlFor="turma-principal">Turma principal</Label>
        <select
          id="turma-principal"
          value={profile?.turma_principal_id ?? ''}
          disabled={turmaSalvando}
          onChange={(e) => salvarTurmaPrincipal(e.target.value)}
          className="w-full rounded-sm border border-rope-dim/50 bg-ink px-3.5 py-2.5 text-sm text-chalk focus:border-hanko focus:outline-none focus:ring-1 focus:ring-hanko"
        >
          <option value="">Nenhuma</option>
          {turmasQuery.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <Label className="mb-0">Exame médico</Label>
          <Badge tone={TONE_STATUS_EXAME[statusExame]}>{ROTULO_STATUS_EXAME[statusExame]}</Badge>
        </div>

        {exameQuery.data?.status === 'aprovado' && exameQuery.data.validade && (
          <p className="mb-3 text-sm text-rope">
            Válido até{' '}
            <span className="font-medium text-chalk">{formatarData(exameQuery.data.validade)}</span>. Só
            precisa enviar de novo quando estiver perto de vencer.
          </p>
        )}
        {statusExame === 'pendente' && (
          <p className="mb-3 text-sm text-rope">
            Sua submissão está com o professor, aguardando aprovação e definição da validade.
          </p>
        )}

        {statusExame !== 'pendente' && statusExame !== 'em-dia' && (
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="exame-arquivo">Atestado médico (PDF, foto ou imagem) *</Label>
              <input
                id="exame-arquivo"
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setArquivoExame(e.target.files?.[0] ?? null)}
                className="text-xs text-rope"
              />
              {exameQuery.data?.arquivo_url && !arquivoExame && (
                <p className="mt-1 font-mono text-xs text-mat-light">Atestado enviado ✓</p>
              )}
            </div>
            <Button disabled={exameSalvando || !arquivoExame} onClick={salvarExame} className="self-start">
              {exameSalvando ? 'Enviando…' : 'Enviar para análise'}
            </Button>
          </div>
        )}
      </Card>

      {camposQuery.data?.map((campo) => {
        const precisaBotaoSalvar = CAMPOS_COM_BOTAO_SALVAR.includes(campo.tipo)
        return (
          <Card key={campo.id}>
            <Label htmlFor={campo.id}>
              {campo.label}
              {campo.obrigatorio ? ' *' : ''}
            </Label>
            <div className="flex flex-col gap-2">
              <CampoPerfilInput
                campo={campo}
                valor={valores[campo.id] ?? ''}
                onChange={(valor) => {
                  setValores((v) => ({ ...v, [campo.id]: valor }))
                  if (!precisaBotaoSalvar) salvarValorDireto(campo, valor)
                }}
                onArquivo={(arquivo) => enviarDocumento(campo, arquivo)}
                documentoEnviado={!!documentoExistente(campo.id)}
                enviandoArquivo={uploadCampo === campo.id}
              />
              {precisaBotaoSalvar && (
                <Button
                  variant="secondary"
                  onClick={() => salvarTexto(campo)}
                  disabled={salvandoCampo === campo.id}
                  className="self-start"
                >
                  {salvandoCampo === campo.id ? 'Salvando…' : 'Salvar'}
                </Button>
              )}
            </div>
          </Card>
        )
      })}

      {mensagem && <p className="font-mono text-xs text-rope">{mensagem}</p>}

      <Link to="/privacidade" className="self-start font-mono text-xs text-rope hover:text-hanko">
        Política de Privacidade
      </Link>
    </div>
  )
}
