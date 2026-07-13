import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { useFormularios, formularioPadrao, decodeCaixas, encodeCaixas } from '../../lib/formularios'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Label, Input, Textarea } from '../../components/Field'
import type { PerfilCampo, PerfilResposta, Turma } from '../../types/database'

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

  function salvarEscolha(campo: PerfilCampo, valor: string) {
    setValores((v) => ({ ...v, [campo.id]: valor }))
    salvarValorDireto(campo, valor)
  }

  function alternarCaixa(campo: PerfilCampo, opcao: string, marcado: boolean) {
    const atuais = decodeCaixas(valores[campo.id])
    const novas = marcado ? [...atuais, opcao] : atuais.filter((o) => o !== opcao)
    const codificado = encodeCaixas(novas)
    setValores((v) => ({ ...v, [campo.id]: codificado }))
    salvarValorDireto(campo, codificado)
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

  const documentoExistente = (campoId: string) =>
    respostasQuery.data?.find((r) => r.campo_id === campoId)?.arquivo_url

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

      {camposQuery.data?.map((campo) => (
        <Card key={campo.id}>
          <Label htmlFor={campo.id}>
            {campo.label}
            {campo.obrigatorio ? ' *' : ''}
          </Label>

          {(campo.tipo === 'texto_curto' || campo.tipo === 'numero' || campo.tipo === 'data') && (
            <div className="flex flex-col gap-2">
              <Input
                id={campo.id}
                type={campo.tipo === 'numero' ? 'number' : campo.tipo === 'data' ? 'date' : 'text'}
                value={valores[campo.id] ?? ''}
                onChange={(e) => setValores((v) => ({ ...v, [campo.id]: e.target.value }))}
                className="max-w-sm"
              />
              <Button
                variant="secondary"
                onClick={() => salvarTexto(campo)}
                disabled={salvandoCampo === campo.id}
                className="self-start"
              >
                {salvandoCampo === campo.id ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          )}

          {campo.tipo === 'texto_longo' && (
            <div className="flex flex-col gap-2">
              <Textarea
                id={campo.id}
                value={valores[campo.id] ?? ''}
                onChange={(e) => setValores((v) => ({ ...v, [campo.id]: e.target.value }))}
              />
              <Button
                variant="secondary"
                onClick={() => salvarTexto(campo)}
                disabled={salvandoCampo === campo.id}
                className="self-start"
              >
                {salvandoCampo === campo.id ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          )}

          {campo.tipo === 'multipla_escolha' && (
            <div className="flex flex-col gap-2">
              {(campo.opcoes ?? []).map((opcao) => (
                <label key={opcao} className="flex items-center gap-2 text-sm text-chalk">
                  <input
                    type="radio"
                    name={campo.id}
                    checked={valores[campo.id] === opcao}
                    onChange={() => salvarEscolha(campo, opcao)}
                  />
                  {opcao}
                </label>
              ))}
            </div>
          )}

          {campo.tipo === 'caixa_selecao' && (
            <div className="flex flex-col gap-2">
              {(campo.opcoes ?? []).map((opcao) => (
                <label key={opcao} className="flex items-center gap-2 text-sm text-chalk">
                  <input
                    type="checkbox"
                    checked={decodeCaixas(valores[campo.id]).includes(opcao)}
                    onChange={(e) => alternarCaixa(campo, opcao, e.target.checked)}
                  />
                  {opcao}
                </label>
              ))}
            </div>
          )}

          {campo.tipo === 'lista_suspensa' && (
            <select
              id={campo.id}
              value={valores[campo.id] ?? ''}
              onChange={(e) => salvarEscolha(campo, e.target.value)}
              className="w-full max-w-sm rounded-sm border border-rope-dim/50 bg-ink px-3.5 py-2.5 text-sm text-chalk focus:border-hanko focus:outline-none focus:ring-1 focus:ring-hanko"
            >
              <option value="">Selecione</option>
              {(campo.opcoes ?? []).map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </select>
          )}

          {campo.tipo === 'documento' && (
            <div className="flex flex-col gap-2">
              {documentoExistente(campo.id) && (
                <p className="font-mono text-xs text-mat-light">Documento enviado ✓</p>
              )}
              <input
                id={campo.id}
                type="file"
                disabled={uploadCampo === campo.id}
                onChange={(e) => e.target.files?.[0] && enviarDocumento(campo, e.target.files[0])}
                className="text-xs text-rope"
              />
            </div>
          )}
        </Card>
      ))}

      {mensagem && <p className="font-mono text-xs text-rope">{mensagem}</p>}
    </div>
  )
}
