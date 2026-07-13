import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { useFormularios } from '../../lib/formularios'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Badge } from '../../components/Badge'
import { TIPOS_CAMPO } from '../../types/database'
import type { CampoTipo, Formulario, PerfilCampo } from '../../types/database'

type CampoPatch = Partial<Pick<PerfilCampo, 'label' | 'obrigatorio' | 'tipo' | 'opcoes'>>

export function ProfessorPerfilForm() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const formulariosQuery = useFormularios(profile?.academia_id)
  const formularios = formulariosQuery.data ?? []

  const [formularioSelecionadoId, setFormularioSelecionadoId] = useState<string | null>(null)
  const [criandoFormulario, setCriandoFormulario] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [campoRecemCriado, setCampoRecemCriado] = useState<string | null>(null)

  useEffect(() => {
    const lista = formulariosQuery.data
    if (!lista) return
    if (formularioSelecionadoId && lista.some((f) => f.id === formularioSelecionadoId)) return
    if (lista.length > 0) {
      setFormularioSelecionadoId(lista.find((f) => f.padrao)?.id ?? lista[0].id)
    }
  }, [formulariosQuery.data, formularioSelecionadoId])

  const formularioSelecionado = formularios.find((f) => f.id === formularioSelecionadoId) ?? null

  const camposQuery = useQuery({
    queryKey: ['perfil_campos', formularioSelecionadoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfil_campos')
        .select('*')
        .eq('formulario_id', formularioSelecionadoId!)
        .order('ordem')
      if (error) throw error
      return data as PerfilCampo[]
    },
    enabled: !!formularioSelecionadoId,
  })
  const campos = camposQuery.data ?? []

  async function invalidarCampos() {
    await queryClient.invalidateQueries({ queryKey: ['perfil_campos', formularioSelecionadoId] })
  }

  async function invalidarFormularios() {
    await queryClient.invalidateQueries({ queryKey: ['formularios', profile?.academia_id] })
  }

  async function criarFormulario(nome: string) {
    if (!profile || !nome.trim()) {
      setCriandoFormulario(false)
      return
    }
    setErro(null)
    const { data, error } = await supabase
      .from('formularios')
      .insert({ academia_id: profile.academia_id, nome: nome.trim(), padrao: false })
      .select()
      .single()
    setCriandoFormulario(false)
    if (error) {
      setErro(error.message)
      return
    }
    await invalidarFormularios()
    if (data) setFormularioSelecionadoId(data.id)
  }

  async function tornarPadrao(formulario: Formulario) {
    setErro(null)
    const atual = formularios.find((f) => f.padrao)
    if (atual && atual.id !== formulario.id) {
      const { error } = await supabase.from('formularios').update({ padrao: false }).eq('id', atual.id)
      if (error) {
        setErro(error.message)
        return
      }
    }
    const { error } = await supabase.from('formularios').update({ padrao: true }).eq('id', formulario.id)
    if (error) {
      setErro(error.message)
      return
    }
    await invalidarFormularios()
  }

  async function excluirFormulario(formulario: Formulario) {
    if (formulario.padrao || formularios.length <= 1) return
    if (
      !confirm(
        `Excluir o formulário "${formulario.nome}"? Os campos e respostas associados também serão apagados.`,
      )
    )
      return
    const { error } = await supabase.from('formularios').delete().eq('id', formulario.id)
    if (error) {
      setErro(error.message)
      return
    }
    setFormularioSelecionadoId(null)
    await invalidarFormularios()
  }

  async function adicionarCampo() {
    if (!profile || !formularioSelecionado) return
    setErro(null)
    const { data, error } = await supabase
      .from('perfil_campos')
      .insert({
        academia_id: profile.academia_id,
        formulario_id: formularioSelecionado.id,
        label: '',
        tipo: 'texto_curto',
        obrigatorio: false,
        opcoes: null,
        ordem: campos.length,
      })
      .select()
      .single()
    if (error) {
      setErro(error.message)
      return
    }
    if (data) setCampoRecemCriado(data.id)
    await invalidarCampos()
  }

  async function duplicarCampo(campo: PerfilCampo) {
    setErro(null)
    const { data, error } = await supabase
      .from('perfil_campos')
      .insert({
        academia_id: campo.academia_id,
        formulario_id: campo.formulario_id,
        label: campo.label,
        tipo: campo.tipo,
        obrigatorio: campo.obrigatorio,
        opcoes: campo.opcoes,
        ordem: campos.length,
      })
      .select()
      .single()
    if (error) {
      setErro(error.message)
      return
    }
    if (data) setCampoRecemCriado(data.id)
    await invalidarCampos()
  }

  async function atualizarCampo(campo: PerfilCampo, patch: CampoPatch) {
    const { error } = await supabase.from('perfil_campos').update(patch).eq('id', campo.id)
    if (error) {
      setErro(error.message)
      return
    }
    await invalidarCampos()
  }

  async function removerCampo(campo: PerfilCampo) {
    if (
      !confirm(
        `Remover o campo "${campo.label || 'sem título'}"? As respostas dos alunos para esse campo também serão apagadas.`,
      )
    )
      return
    const { error } = await supabase.from('perfil_campos').delete().eq('id', campo.id)
    if (error) {
      setErro(error.message)
      return
    }
    await invalidarCampos()
  }

  async function reordenar(novaOrdem: PerfilCampo[]) {
    const resultados = await Promise.all(
      novaOrdem.map((c, indice) => supabase.from('perfil_campos').update({ ordem: indice }).eq('id', c.id)),
    )
    const falhou = resultados.find((r) => r.error)
    if (falhou?.error) {
      setErro(falhou.error.message)
      return
    }
    await invalidarCampos()
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = campos.findIndex((c) => c.id === active.id)
    const newIndex = campos.findIndex((c) => c.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    reordenar(arrayMove(campos, oldIndex, newIndex))
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-chalk">Formulário de perfil</h1>
        <p className="mt-1 text-sm text-rope">
          Cada pergunta é um cartão — escolha o tipo, arraste pra reordenar.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-rope-dim/20">
        {formularios.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFormularioSelecionadoId(f.id)}
            className={`flex items-center gap-1.5 rounded-t-sm border-b-2 px-3 py-2 font-mono text-xs uppercase tracking-wide transition-colors ${
              formularioSelecionadoId === f.id
                ? 'border-hanko text-hanko'
                : 'border-transparent text-rope hover:text-chalk'
            }`}
          >
            {f.nome}
            {f.padrao && <Badge tone="hanko">padrão</Badge>}
          </button>
        ))}
        {criandoFormulario ? (
          <input
            autoFocus
            className="w-40 rounded-sm border border-rope-dim/50 bg-ink px-2 py-1.5 text-sm text-chalk focus:border-hanko focus:outline-none"
            placeholder="Nome do formulário"
            onBlur={(e) => criarFormulario(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setCriandoFormulario(false)
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCriandoFormulario(true)}
            className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-rope hover:text-chalk"
          >
            + Novo formulário
          </button>
        )}
      </div>

      {erro && <p className="font-mono text-xs text-hanko">{erro}</p>}

      {formularioSelecionado && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg text-chalk">{formularioSelecionado.nome}</h2>
              {formularioSelecionado.padrao && <Badge tone="hanko">padrão</Badge>}
            </div>
            <div className="flex gap-2">
              {!formularioSelecionado.padrao && (
                <Button variant="secondary" onClick={() => tornarPadrao(formularioSelecionado)}>
                  Tornar padrão
                </Button>
              )}
              {!formularioSelecionado.padrao && formularios.length > 1 && (
                <Button variant="ghost" onClick={() => excluirFormulario(formularioSelecionado)}>
                  Excluir formulário
                </Button>
              )}
            </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={campos.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-4">
                {campos.map((campo) => (
                  <CampoCard
                    key={campo.id}
                    campo={campo}
                    autoFocar={campoRecemCriado === campo.id}
                    onFocado={() => setCampoRecemCriado(null)}
                    onAtualizar={(patch) => atualizarCampo(campo, patch)}
                    onDuplicar={() => duplicarCampo(campo)}
                    onRemover={() => removerCampo(campo)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <button
            type="button"
            onClick={adicionarCampo}
            className="rounded-md border border-dashed border-rope-dim/40 py-4 text-center font-mono text-xs uppercase tracking-wide text-rope transition-colors hover:border-hanko hover:text-hanko"
          >
            + Adicionar pergunta
          </button>
        </>
      )}
    </div>
  )
}

function CampoCard({
  campo,
  autoFocar,
  onFocado,
  onAtualizar,
  onDuplicar,
  onRemover,
}: {
  campo: PerfilCampo
  autoFocar: boolean
  onFocado: () => void
  onAtualizar: (patch: CampoPatch) => void
  onDuplicar: () => void
  onRemover: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: campo.id,
  })
  const [label, setLabel] = useState(campo.label)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setLabel(campo.label), [campo.label])

  useEffect(() => {
    if (autoFocar && inputRef.current) {
      inputRef.current.focus()
      onFocado()
    }
  }, [autoFocar, onFocado])

  const style = { transform: CSS.Transform.toString(transform), transition }

  function mudarTipo(novoTipo: CampoTipo) {
    const novoMeta = TIPOS_CAMPO.find((t) => t.valor === novoTipo)
    if (novoMeta?.temOpcoes) {
      onAtualizar({
        tipo: novoTipo,
        opcoes: campo.opcoes && campo.opcoes.length > 0 ? campo.opcoes : ['Opção 1'],
      })
    } else {
      onAtualizar({ tipo: novoTipo, opcoes: null })
    }
  }

  function mudarOpcao(indice: number, valor: string) {
    const novas = [...(campo.opcoes ?? [])]
    novas[indice] = valor
    onAtualizar({ opcoes: novas })
  }

  function adicionarOpcao() {
    onAtualizar({ opcoes: [...(campo.opcoes ?? []), `Opção ${(campo.opcoes?.length ?? 0) + 1}`] })
  }

  function removerOpcao(indice: number) {
    onAtualizar({ opcoes: (campo.opcoes ?? []).filter((_, i) => i !== indice) })
  }

  return (
    <Card ref={setNodeRef} style={style} className={isDragging ? 'opacity-50' : undefined}>
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-2 touch-none cursor-grab px-1 text-rope-dim hover:text-rope active:cursor-grabbing"
          aria-label="Arrastar para reordenar"
        >
          ⠿
        </button>
        <input
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label.trim() !== campo.label && onAtualizar({ label: label.trim() })}
          placeholder="Pergunta"
          className="flex-1 border-b border-transparent bg-transparent px-1 py-1.5 font-display text-lg text-chalk hover:border-rope-dim/40 focus:border-hanko focus:outline-none"
        />
        <select
          value={campo.tipo}
          onChange={(e) => mudarTipo(e.target.value as CampoTipo)}
          className="rounded-sm border border-rope-dim/50 bg-ink px-2.5 py-1.5 text-xs text-chalk focus:border-hanko focus:outline-none"
        >
          {TIPOS_CAMPO.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.rotulo}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 pl-7">
        <CampoPreview
          campo={campo}
          onMudarOpcao={mudarOpcao}
          onAdicionarOpcao={adicionarOpcao}
          onRemoverOpcao={removerOpcao}
        />
      </div>

      <div className="mt-4 flex items-center justify-end gap-4 border-t border-rope-dim/15 pt-3">
        <label className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-rope">
          <input
            type="checkbox"
            checked={campo.obrigatorio}
            onChange={(e) => onAtualizar({ obrigatorio: e.target.checked })}
          />
          obrigatório
        </label>
        <button type="button" onClick={onDuplicar} className="text-rope hover:text-chalk" aria-label="Duplicar pergunta">
          ⧉
        </button>
        <button type="button" onClick={onRemover} className="text-rope hover:text-hanko" aria-label="Excluir pergunta">
          🗑
        </button>
      </div>
    </Card>
  )
}

function CampoPreview({
  campo,
  onMudarOpcao,
  onAdicionarOpcao,
  onRemoverOpcao,
}: {
  campo: PerfilCampo
  onMudarOpcao: (indice: number, valor: string) => void
  onAdicionarOpcao: () => void
  onRemoverOpcao: (indice: number) => void
}) {
  const meta = TIPOS_CAMPO.find((t) => t.valor === campo.tipo)

  if (meta?.temOpcoes) {
    return (
      <div className="flex flex-col gap-2">
        {(campo.opcoes ?? []).map((opcao, indice) => (
          <div key={indice} className="flex items-center gap-2">
            <span className="w-4 text-center text-rope-dim">
              {campo.tipo === 'lista_suspensa' ? `${indice + 1}.` : campo.tipo === 'caixa_selecao' ? '☐' : '○'}
            </span>
            <input
              value={opcao}
              onChange={(e) => onMudarOpcao(indice, e.target.value)}
              className="flex-1 rounded-sm border border-rope-dim/30 bg-ink px-2.5 py-1.5 text-sm text-chalk focus:border-hanko focus:outline-none"
            />
            <button
              type="button"
              onClick={() => onRemoverOpcao(indice)}
              className="text-rope-dim hover:text-hanko"
              aria-label="Remover opção"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onAdicionarOpcao}
          className="ml-6 self-start font-mono text-xs text-rope hover:text-hanko"
        >
          + Adicionar opção
        </button>
      </div>
    )
  }

  switch (campo.tipo) {
    case 'texto_curto':
      return (
        <input
          disabled
          placeholder="Texto de resposta curta"
          className="w-full max-w-sm rounded-sm border border-rope-dim/25 bg-transparent px-2.5 py-1.5 text-sm text-rope-dim"
        />
      )
    case 'texto_longo':
      return (
        <textarea
          disabled
          placeholder="Texto de resposta longa"
          rows={2}
          className="w-full rounded-sm border border-rope-dim/25 bg-transparent px-2.5 py-1.5 text-sm text-rope-dim"
        />
      )
    case 'numero':
      return (
        <input
          disabled
          type="number"
          placeholder="0"
          className="w-32 rounded-sm border border-rope-dim/25 bg-transparent px-2.5 py-1.5 text-sm text-rope-dim"
        />
      )
    case 'data':
      return (
        <input
          disabled
          type="date"
          className="w-44 rounded-sm border border-rope-dim/25 bg-transparent px-2.5 py-1.5 text-sm text-rope-dim"
        />
      )
    case 'documento':
      return <p className="font-mono text-xs text-rope-dim">📎 anexo enviado pelo aluno</p>
    default:
      return null
  }
}
