import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { useFormularios, formularioPadrao, decodeCaixas } from '../../lib/formularios'
import { useFaixasConfig } from '../../lib/graduacao'
import { statusExameMedico, ROTULO_STATUS_EXAME, TONE_STATUS_EXAME, somarUmAno } from '../../lib/exameMedico'
import { formatarData } from '../../lib/datas'
import { formatarTelefone } from '../../lib/identificador'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Badge } from '../../components/Badge'
import { Belt } from '../../components/Belt'
import { Label, Input, FieldError } from '../../components/Field'
import type { Profile, Checkin, PerfilCampo, PerfilResposta, Graduacao, ExameMedico } from '../../types/database'

export function ProfessorAlunoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [exameForm, setExameForm] = useState({ emitido_em: '', validade: '' })
  const [exameSalvando, setExameSalvando] = useState(false)
  const [exameErro, setExameErro] = useState<string | null>(null)

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

  useEffect(() => {
    if (exameQuery.data) {
      const emitido = exameQuery.data.emitido_em ?? exameQuery.data.solicitado_em.slice(0, 10)
      setExameForm({ emitido_em: emitido, validade: exameQuery.data.validade ?? somarUmAno(emitido) })
    }
  }, [exameQuery.data])

  function mudarEmitidoEm(novaData: string) {
    setExameForm({ emitido_em: novaData, validade: novaData ? somarUmAno(novaData) : '' })
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

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-rope">Histórico de graduação</h2>
          <Link to="/professor/graduacao" className="font-mono text-xs text-rope hover:text-hanko">
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
    </div>
  )
}
