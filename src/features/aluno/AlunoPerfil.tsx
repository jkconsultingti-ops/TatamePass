import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Paperclip } from 'lucide-react'
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
import { FileButton } from '../../components/FileButton'
import type { PerfilCampo, PerfilResposta, Turma, ExameMedico } from '../../types/database'

/** Tipos cujo valor só grava quando o aluno aperta "Salvar alterações" — os
 * demais (escolha/lista/checkbox) salvam sozinhos ao mudar, e documento sobe
 * na hora, então não entram nesse buffer. */
const CAMPOS_COM_SALVAR_EM_LOTE: PerfilCampo['tipo'][] = ['texto_curto', 'texto_longo', 'numero', 'data']

export function AlunoPerfil() {
  const { profile, refreshProfile } = useAuth()
  const queryClient = useQueryClient()
  const [salvandoTudo, setSalvandoTudo] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [uploadCampo, setUploadCampo] = useState<string | null>(null)
  const [fotoEnviando, setFotoEnviando] = useState(false)
  const [nome, setNome] = useState(profile?.nome ?? '')
  const [inicioJiuJitsu, setInicioJiuJitsu] = useState(profile?.inicio_jiu_jitsu ?? '')
  const [arquivoExame, setArquivoExame] = useState<File | null>(null)
  const [exameSalvando, setExameSalvando] = useState(false)

  useEffect(() => setNome(profile?.nome ?? ''), [profile?.nome])
  useEffect(() => setInicioJiuJitsu(profile?.inicio_jiu_jitsu ?? ''), [profile?.inicio_jiu_jitsu])

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

  async function salvarTudo() {
    if (!profile) return
    setSalvandoTudo(true)
    setMensagem(null)
    try {
      const patchPerfil: { nome?: string; inicio_jiu_jitsu?: string | null } = {}
      if (nome.trim() && nome.trim() !== profile.nome) patchPerfil.nome = nome.trim()
      if (inicioJiuJitsu !== (profile.inicio_jiu_jitsu ?? '')) {
        patchPerfil.inicio_jiu_jitsu = inicioJiuJitsu || null
      }
      if (Object.keys(patchPerfil).length > 0) {
        const { error } = await supabase.from('profiles').update(patchPerfil).eq('id', profile.id)
        if (error) throw error
        await refreshProfile()
      }

      const camposEmLote = (camposQuery.data ?? []).filter((c) => CAMPOS_COM_SALVAR_EM_LOTE.includes(c.tipo))
      if (camposEmLote.length > 0) {
        const { error } = await supabase.from('perfil_respostas').upsert(
          camposEmLote.map((campo) => ({
            aluno_id: profile.id,
            campo_id: campo.id,
            valor_texto: valores[campo.id] ?? '',
          })),
          { onConflict: 'aluno_id,campo_id' },
        )
        if (error) throw error
      }

      await queryClient.invalidateQueries({ queryKey: ['perfil_respostas', profile.id] })
      setMensagem('Salvo.')
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Não foi possível salvar')
    } finally {
      setSalvandoTudo(false)
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
      const extensao = arquivo.name.split('.').pop() ?? 'jpg'
      const caminho = `${profile.academia_id}/${profile.id}/avatar.${extensao}`
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

      <Card className="flex flex-col divide-y divide-rope-dim/20">
        <div className="flex items-center gap-4 pb-4">
          {profile?.foto_url ? (
            <img src={profile.foto_url} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-ink" />
          )}
          <div className="flex flex-col gap-1.5">
            <FileButton
              accept="image/*"
              disabled={fotoEnviando}
              onSelect={trocarFoto}
              label={fotoEnviando ? 'Enviando…' : 'Trocar foto'}
              icon={<Camera className="h-4 w-4" />}
            />
            <p className="font-mono text-[11px] text-rope-dim">JPG, PNG ou WebP</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 py-4">
          <div>
            <Label className="mb-0.5">Turma principal</Label>
            <p className="text-sm text-chalk">
              {turmasQuery.data?.find((t) => t.id === profile?.turma_principal_id)?.nome ?? 'Nenhuma'}
            </p>
            <p className="font-mono text-[11px] text-rope-dim">Definido pelo professor</p>
          </div>
          <div>
            <Label className="mb-0.5">Associado desde</Label>
            <p className="text-sm text-chalk">{formatarData(profile?.associado_desde)}</p>
            <p className="font-mono text-[11px] text-rope-dim">Definido pelo professor</p>
          </div>
        </div>

        <div className="pt-4">
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
                <Label>Atestado médico (PDF, foto ou imagem) *</Label>
                <div className="flex flex-col gap-2">
                  <FileButton
                    accept="application/pdf,image/*"
                    onSelect={setArquivoExame}
                    label="Escolher arquivo"
                    icon={<Paperclip className="h-4 w-4" />}
                  />
                  {arquivoExame && <p className="font-mono text-xs text-rope">{arquivoExame.name}</p>}
                  {exameQuery.data?.arquivo_url && !arquivoExame && (
                    <p className="font-mono text-xs text-mat-light">Atestado enviado ✓</p>
                  )}
                </div>
              </div>
              <Button disabled={exameSalvando || !arquivoExame} onClick={salvarExame} className="self-start">
                {exameSalvando ? 'Enviando…' : 'Enviar para análise'}
              </Button>
            </div>
          )}
        </div>
      </Card>

      <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-rope-dim">Seus dados</h2>

      <Card className="flex flex-col divide-y divide-rope-dim/20">
        <div className="pb-4">
          <Label htmlFor="nome-completo">Nome completo</Label>
          <Input id="nome-completo" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>

        <div className="py-4">
          <Label htmlFor="inicio-jiu-jitsu">Início no Jiu-Jitsu</Label>
          <Input
            id="inicio-jiu-jitsu"
            type="date"
            value={inicioJiuJitsu}
            onChange={(e) => setInicioJiuJitsu(e.target.value)}
          />
          <p className="mt-1 font-mono text-[11px] text-rope-dim">
            Desde quando você pratica, mesmo que tenha sido em outra academia.
          </p>
        </div>

        {camposQuery.data?.map((campo) => {
          const salvaEmLote = CAMPOS_COM_SALVAR_EM_LOTE.includes(campo.tipo)
          return (
            <div key={campo.id} className="py-4 first:pt-0 last:pb-0">
              <Label htmlFor={campo.id}>
                {campo.label}
                {campo.obrigatorio ? ' *' : ''}
              </Label>
              <CampoPerfilInput
                campo={campo}
                valor={valores[campo.id] ?? ''}
                onChange={(valor) => {
                  setValores((v) => ({ ...v, [campo.id]: valor }))
                  if (!salvaEmLote) salvarValorDireto(campo, valor)
                }}
                onArquivo={(arquivo) => enviarDocumento(campo, arquivo)}
                documentoEnviado={!!documentoExistente(campo.id)}
                enviandoArquivo={uploadCampo === campo.id}
              />
            </div>
          )
        })}
      </Card>

      <Button onClick={salvarTudo} disabled={salvandoTudo} className="self-start">
        {salvandoTudo ? 'Salvando…' : 'Salvar alterações'}
      </Button>

      {mensagem && <p className="font-mono text-xs text-rope">{mensagem}</p>}

      <Link to="/privacidade" className="self-start font-mono text-xs text-rope hover:text-hanko">
        Política de Privacidade
      </Link>
    </div>
  )
}
