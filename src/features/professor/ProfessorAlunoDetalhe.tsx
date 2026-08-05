import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { useFormularios, formularioPadrao, decodeCaixas } from '../../lib/formularios'
import { useFaixasConfig, faixasDoTipo, estadoAtual } from '../../lib/graduacao'
import { statusExameMedico, ROTULO_STATUS_EXAME, TONE_STATUS_EXAME, somarUmAno } from '../../lib/exameMedico'
import { formatarData } from '../../lib/datas'
import { formatarTelefone } from '../../lib/identificador'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Badge } from '../../components/Badge'
import { Belt } from '../../components/Belt'
import { Label, Input, FieldError } from '../../components/Field'
import type {
  Profile,
  Checkin,
  PerfilCampo,
  PerfilResposta,
  Graduacao,
  ExameMedico,
  Turma,
} from '../../types/database'

export function ProfessorAlunoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [exameForm, setExameForm] = useState({ emitido_em: '', validade: '' })
  const [exameSalvando, setExameSalvando] = useState(false)
  const [exameErro, setExameErro] = useState<string | null>(null)
  const [assocForm, setAssocForm] = useState({
    associado_desde: '',
    inicio_jiu_jitsu: '',
    turma_principal_id: '',
  })
  const [assocSalvando, setAssocSalvando] = useState(false)
  const [assocErro, setAssocErro] = useState<string | null>(null)
  const [manual, setManual] = useState<{ faixaId: string; grau: string } | null>(null)
  const [manualSalvando, setManualSalvando] = useState(false)
  const [manualErro, setManualErro] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  const alunoQuery = useQuery({
    queryKey: ['aluno', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id!).single()
      if (error) throw error
      return data as Profile
    },
    enabled: !!id,
  })

  const checkinsQuery = useQuery({
    queryKey: ['checkins-aluno', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .eq('aluno_id', id!)
        .order('data', { ascending: false })
        .limit(30)
      if (error) throw error
      return data as Checkin[]
    },
    enabled: !!id,
  })

  const faixasQuery = useFaixasConfig()
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
    queryKey: ['perfil_respostas-aluno', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('perfil_respostas').select('*').eq('aluno_id', id!)
      if (error) throw error
      return data as PerfilResposta[]
    },
    enabled: !!id,
  })

  const graduacoesQuery = useQuery({
    queryKey: ['graduacoes-aluno', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('graduacoes')
        .select('*')
        .eq('aluno_id', id!)
        .order('concedido_em', { ascending: false })
      if (error) throw error
      return data as Graduacao[]
    },
    enabled: !!id,
  })

  const exameQuery = useQuery({
    queryKey: ['exame_medico', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exames_medicos')
        .select('*')
        .eq('aluno_id', id!)
        .maybeSingle()
      if (error) throw error
      return data as ExameMedico | null
    },
    enabled: !!id,
  })

  const turmasQuery = useQuery({
    queryKey: ['turmas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('turmas').select('*').order('nome')
      if (error) throw error
      return data as Turma[]
    },
    enabled: !!id,
  })

  useEffect(() => {
    if (exameQuery.data) {
      const emitido = exameQuery.data.emitido_em ?? exameQuery.data.solicitado_em.slice(0, 10)
      setExameForm({ emitido_em: emitido, validade: exameQuery.data.validade ?? somarUmAno(emitido) })
    }
  }, [exameQuery.data])

  function mudarEmitidoEm(novaData: string) {
    setExameForm({ emitido_em: novaData, validade: novaData ? somarUmAno(novaData) : '' })
  }

  useEffect(() => {
    if (!alunoQuery.data) return
    setAssocForm({
      associado_desde: alunoQuery.data.associado_desde ?? '',
      inicio_jiu_jitsu: alunoQuery.data.inicio_jiu_jitsu ?? '',
      turma_principal_id: alunoQuery.data.turma_principal_id ?? '',
    })
  }, [alunoQuery.data])

  async function salvarAssociacao() {
    if (!id) return
    setAssocSalvando(true)
    setAssocErro(null)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          associado_desde: assocForm.associado_desde || null,
          inicio_jiu_jitsu: assocForm.inicio_jiu_jitsu || null,
          turma_principal_id: assocForm.turma_principal_id || null,
        })
        .eq('id', id)
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['aluno', id] })
    } catch (err) {
      setAssocErro(err instanceof Error ? err.message : 'Não foi possível salvar')
    } finally {
      setAssocSalvando(false)
    }
  }

  async function marcarComoRevisado() {
    if (!id) return
    const { error } = await supabase.from('profiles').update({ revisado_pelo_professor: true }).eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['aluno', id] })
  }

  const tipoTurmaAluno = useMemo(() => {
    const turmaId = alunoQuery.data?.turma_principal_id
    const turma = turmaId ? turmasQuery.data?.find((t) => t.id === turmaId) : undefined
    return turma?.tipo_turma ?? 'adulto'
  }, [alunoQuery.data, turmasQuery.data])

  const faixasDoAluno = useMemo(
    () => faixasDoTipo(faixasQuery.data ?? [], tipoTurmaAluno),
    [faixasQuery.data, tipoTurmaAluno],
  )

  const estado =
    alunoQuery.data && faixasDoAluno.length > 0
      ? estadoAtual(graduacoesQuery.data ?? [], faixasDoAluno, alunoQuery.data.criado_em)
      : null

  // Só inicializa a partir do estado atual depois que o histórico já
  // carregou (graduacoesQuery.data !== undefined) — inicializar antes disso
  // travaria o form no fallback errado (1ª faixa, grau 0) pro resto da sessão.
  useEffect(() => {
    if (manual !== null) return
    if (graduacoesQuery.data === undefined || !estado) return
    setManual({ faixaId: estado.faixa.id, grau: String(estado.grau) })
  }, [manual, graduacoesQuery.data, estado])

  async function definirManual() {
    if (!profile || !id || !manual) return
    const faixaSelecionada = faixasDoAluno.find((f) => f.id === manual.faixaId)
    const grauNum = Number(manual.grau) || 0
    setManualErro(null)
    if (grauNum < 0) {
      setManualErro('O grau não pode ser negativo.')
      return
    }
    if (faixaSelecionada?.graus_por_faixa != null && grauNum > faixaSelecionada.graus_por_faixa) {
      setManualErro(
        `A faixa ${faixaSelecionada.nome} vai até o ${faixaSelecionada.graus_por_faixa}º grau — pra promover, escolha a próxima faixa.`,
      )
      return
    }
    setManualSalvando(true)
    try {
      const { error } = await supabase.from('graduacoes').insert({
        aluno_id: id,
        faixa_id: manual.faixaId,
        grau: grauNum,
        concedido_por: profile.id,
      })
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['graduacoes-aluno', id] })
    } catch (err) {
      setManualErro(err instanceof Error ? err.message : 'Não foi possível salvar a graduação')
    } finally {
      setManualSalvando(false)
    }
  }

  async function excluirConta() {
    if (!id || !alunoQuery.data || !profile) return
    const aluno = alunoQuery.data
    if (!confirm(`Excluir a conta de "${aluno.nome}"? Essa ação não pode ser desfeita.`)) return
    const digitado = prompt(`Pra confirmar, digite o nome exato: ${aluno.nome}`)
    if (digitado !== aluno.nome) {
      if (digitado !== null) alert('Nome não confere — nada foi excluído.')
      return
    }
    setExcluindo(true)
    try {
      for (const bucket of ['avatars', 'documentos'] as const) {
        const { data: arquivos } = await supabase.storage.from(bucket).list(`${profile.academia_id}/${id}`)
        if (arquivos && arquivos.length > 0) {
          await supabase.storage
            .from(bucket)
            .remove(arquivos.map((a) => `${profile.academia_id}/${id}/${a.name}`))
        }
      }
      const { error } = await supabase.rpc('excluir_aluno', { p_aluno_id: id })
      if (error) throw error
      navigate(profile.role === 'admin' ? '/admin/alunos' : '/professor/alunos')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível excluir a conta')
      setExcluindo(false)
    }
  }

  async function aprovarExame() {
    if (!profile || !id || !exameForm.validade) return
    setExameSalvando(true)
    setExameErro(null)
    try {
      const { error } = await supabase.from('exames_medicos').upsert(
        {
          aluno_id: id,
          academia_id: profile.academia_id,
          status: 'aprovado',
          validade: exameForm.validade,
          emitido_em: exameForm.emitido_em || null,
          arquivo_url: exameQuery.data?.arquivo_url ?? null,
          aprovado_por: profile.id,
          aprovado_em: new Date().toISOString(),
          atualizado_por: profile.id,
        },
        { onConflict: 'aluno_id' },
      )
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['exame_medico', id] })
    } catch (err) {
      setExameErro(err instanceof Error ? err.message : 'Não foi possível aprovar o exame médico')
    } finally {
      setExameSalvando(false)
    }
  }

  async function verDocumento(caminho: string) {
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(caminho, 60)
    if (error) {
      alert(error.message)
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  if (!alunoQuery.data) return null

  const faixaAtual = graduacoesQuery.data?.[0]
  const nomeFaixaAtual = faixasQuery.data?.find((f) => f.id === faixaAtual?.faixa_id)
  const statusExame = statusExameMedico(exameQuery.data)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        {alunoQuery.data.foto_url ? (
          <img src={alunoQuery.data.foto_url} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="h-14 w-14 rounded-full bg-ink-soft" />
        )}
        <div>
          <h1 className="font-display text-2xl font-semibold text-chalk">{alunoQuery.data.nome}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {nomeFaixaAtual && (
              <Belt
                nome={nomeFaixaAtual.nome}
                grau={faixaAtual?.grau ?? 0}
                maxGraus={nomeFaixaAtual.graus_por_faixa}
                tamanho="sm"
              />
            )}
            <Badge tone={TONE_STATUS_EXAME[statusExame]}>{ROTULO_STATUS_EXAME[statusExame]}</Badge>
          </div>
          {alunoQuery.data.identificador_tipo && alunoQuery.data.identificador_valor && (
            <p className="mt-1 font-mono text-xs text-rope">
              {alunoQuery.data.identificador_tipo === 'email' ? 'E-mail (login)' : 'Telefone (login)'}:{' '}
              {alunoQuery.data.identificador_tipo === 'telefone'
                ? formatarTelefone(alunoQuery.data.identificador_valor)
                : alunoQuery.data.identificador_valor}
            </p>
          )}
        </div>
      </div>

      {!alunoQuery.data.revisado_pelo_professor && (
        <Card className="flex flex-col items-start gap-2">
          <Badge tone="rope">Cadastro novo</Badge>
          <p className="text-sm font-semibold text-chalk">Revisar faixa e data de associação</p>
          <p className="text-sm text-rope">
            Confira a faixa atual, a data de associação e a turma principal antes de marcar como revisado.
          </p>
          <Button variant="secondary" onClick={marcarComoRevisado}>
            Marcar como revisado
          </Button>
        </Card>
      )}

      <section>
        <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-rope">Associação e histórico</h2>
        <Card className="mt-3 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="associado-desde">Associado desde</Label>
              <Input
                id="associado-desde"
                type="date"
                value={assocForm.associado_desde}
                onChange={(e) => setAssocForm((v) => ({ ...v, associado_desde: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="inicio-jiu-jitsu-professor" title="Preenchido pelo aluno (auto-declarado)">
                Início no Jiu-Jitsu
              </Label>
              <Input
                id="inicio-jiu-jitsu-professor"
                type="date"
                value={assocForm.inicio_jiu_jitsu}
                onChange={(e) => setAssocForm((v) => ({ ...v, inicio_jiu_jitsu: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="turma-principal-professor">Turma principal</Label>
              <select
                id="turma-principal-professor"
                value={assocForm.turma_principal_id}
                onChange={(e) => setAssocForm((v) => ({ ...v, turma_principal_id: e.target.value }))}
                className="w-full rounded-sm border border-rope-dim/80 bg-ink px-3.5 py-2.5 text-sm text-chalk focus:border-hanko focus:outline-none focus:ring-1 focus:ring-hanko"
              >
                <option value="">Nenhuma</option>
                {turmasQuery.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button disabled={assocSalvando} onClick={salvarAssociacao} className="self-start">
            {assocSalvando ? 'Salvando…' : 'Salvar'}
          </Button>
          <FieldError>{assocErro ?? undefined}</FieldError>
        </Card>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-rope">Histórico de graduação</h2>
          <Link
            to={profile?.role === 'admin' ? '/admin/graduacao' : '/professor/graduacao'}
            className="font-mono text-xs text-rope hover:text-hanko"
          >
            conceder grau →
          </Link>
        </div>
        {graduacoesQuery.data && graduacoesQuery.data.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2">
            {graduacoesQuery.data.map((g) => (
              <Card key={g.id} className="flex items-center justify-between text-sm">
                <span className="text-chalk">
                  {faixasQuery.data?.find((f) => f.id === g.faixa_id)?.nome ?? '—'}
                  {g.grau ? ` · grau ${g.grau}` : ''}
                </span>
                <span className="font-mono text-xs text-rope">{formatarData(g.concedido_em)}</span>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mt-3 text-sm text-rope">Ainda sem graduação registrada.</Card>
        )}

        {manual && (
          <details className="mt-3">
            <summary className="cursor-pointer font-mono text-xs text-rope hover:text-hanko">
              Definir faixa/grau manualmente
            </summary>
            <Card className="mt-3 flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="manual-faixa">Faixa</Label>
                  <select
                    id="manual-faixa"
                    value={manual.faixaId}
                    onChange={(e) => setManual((m) => ({ ...m!, faixaId: e.target.value }))}
                    className="w-full rounded-sm border border-rope-dim/80 bg-ink px-3.5 py-2.5 text-sm text-chalk focus:border-hanko focus:outline-none focus:ring-1 focus:ring-hanko"
                  >
                    {faixasDoAluno.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="manual-grau">Grau</Label>
                  <Input
                    id="manual-grau"
                    type="number"
                    min={0}
                    max={faixasDoAluno.find((f) => f.id === manual.faixaId)?.graus_por_faixa ?? undefined}
                    title={
                      faixasDoAluno.find((f) => f.id === manual.faixaId)?.graus_por_faixa != null
                        ? `Até o ${faixasDoAluno.find((f) => f.id === manual.faixaId)!.graus_por_faixa}º grau nessa faixa`
                        : undefined
                    }
                    value={manual.grau}
                    onChange={(e) => setManual((m) => ({ ...m!, grau: e.target.value }))}
                  />
                </div>
              </div>
              <Button disabled={manualSalvando} onClick={definirManual} className="self-start">
                {manualSalvando ? 'Salvando…' : 'Salvar'}
              </Button>
              <FieldError>{manualErro ?? undefined}</FieldError>
            </Card>
          </details>
        )}
      </section>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-rope">Exame médico</h2>
        <Card className="mt-3">
          {!exameQuery.data && <p className="text-sm text-rope">O aluno ainda não enviou nenhum exame.</p>}

          {exameQuery.data && (
            <>
              {exameQuery.data.arquivo_url ? (
                <Button
                  variant="secondary"
                  className="mb-3"
                  onClick={() => verDocumento(exameQuery.data!.arquivo_url!)}
                >
                  Ver atestado enviado
                </Button>
              ) : (
                <p className="mb-3 text-xs text-rope">
                  Aluno não anexou atestado — confirme de outra forma antes de aprovar.
                </p>
              )}

              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label htmlFor="exame-emitido">Data de emissão</Label>
                  <Input
                    id="exame-emitido"
                    type="date"
                    value={exameForm.emitido_em}
                    onChange={(e) => mudarEmitidoEm(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="exame-validade">Válido até</Label>
                  <Input
                    id="exame-validade"
                    type="date"
                    value={exameForm.validade}
                    onChange={(e) => setExameForm((v) => ({ ...v, validade: e.target.value }))}
                  />
                </div>
                <Button disabled={exameSalvando || !exameForm.validade} onClick={aprovarExame}>
                  {exameSalvando ? 'Salvando…' : exameQuery.data.status === 'aprovado' ? 'Atualizar' : 'Aprovar'}
                </Button>
              </div>
              <p className="mt-2 text-xs text-rope">
                Data de emissão já vem preenchida com o dia do envio — ajuste se souber a data real. A
                validade se atualiza sozinha pra 1 ano depois da emissão, mas também pode ajustar.
              </p>
              <FieldError>{exameErro ?? undefined}</FieldError>
            </>
          )}
        </Card>
      </section>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-rope">Perfil</h2>
        <div className="mt-3 flex flex-col gap-2">
          {camposQuery.data?.map((campo) => {
            const resposta = respostasQuery.data?.find((r) => r.campo_id === campo.id)
            return (
              <Card key={campo.id} className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-rope">
                    {campo.label}
                  </p>
                  <p className="mt-1 text-sm text-chalk">
                    {campo.tipo === 'documento'
                      ? resposta?.arquivo_url
                        ? 'Documento enviado'
                        : '—'
                      : campo.tipo === 'caixa_selecao'
                        ? decodeCaixas(resposta?.valor_texto).join(', ') || '—'
                        : resposta?.valor_texto || '—'}
                  </p>
                </div>
                {campo.tipo === 'documento' && resposta?.arquivo_url && (
                  <Button variant="secondary" onClick={() => verDocumento(resposta.arquivo_url!)}>
                    Ver
                  </Button>
                )}
              </Card>
            )
          })}
          {camposQuery.data?.length === 0 && (
            <Card className="text-sm text-rope">Nenhum campo de perfil configurado.</Card>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-rope">Presença</h2>
        <Card className="mt-3 divide-y divide-rope-dim/15 p-0">
          {checkinsQuery.data?.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3">
              <span className="font-mono text-xs text-rope">{c.data}</span>
              {c.avulso && <Badge>avulso</Badge>}
            </div>
          ))}
          {checkinsQuery.data?.length === 0 && (
            <p className="p-4 text-sm text-rope">Nenhum check-in ainda.</p>
          )}
        </Card>
      </section>

      {profile?.role === 'admin' && (
        <section>
          <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-rope">Zona de risco</h2>
          <Card className="mt-3 flex flex-col items-start gap-2">
            <p className="text-sm text-chalk">Excluir a conta deste aluno (LGPD)</p>
            <p className="text-sm text-rope">
              Remove a conta, os check-ins, graduações, exames e arquivos enviados. Não pode ser desfeito.
            </p>
            <Button variant="secondary" disabled={excluindo} onClick={excluirConta} className="text-hanko">
              {excluindo ? 'Excluindo…' : 'Excluir conta do aluno'}
            </Button>
          </Card>
        </section>
      )}
    </div>
  )
}
