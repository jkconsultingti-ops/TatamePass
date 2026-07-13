import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
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
import type { CampoTipo, Formulario, PerfilCampo } from '../../types/database'

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

  async function adicionarCampo(tipo: CampoTipo) {
    if (!profile || !formularioSelecionado) return
    setErro(null)
    const { data, error } = await supabase
      .from('perfil_campos')
      .insert({
        academia_id: profile.academia_id,
        formulario_id: formularioSelecionado.id,
        label: tipo === 'texto' ? 'Novo campo de texto' : 'Novo documento',
        tipo,
        obrigatorio: false,
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

  async function atualizarCampo(
    campo: PerfilCampo,
    patch: Partial<Pick<PerfilCampo, 'label' | 'obrigatorio'>>,
  ) {
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
        `Remover o campo "${campo.label}"? As respostas dos alunos para esse campo também serão apagadas.`,
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
    if (!over) return

    if (String(active.id).startsWith('paleta-')) {
      adicionarCampo(String(active.id) === 'paleta-texto' ? 'texto' : 'documento')
      return
    }

    if (active.id !== over.id) {
      const oldIndex = campos.findIndex((c) => c.id === active.id)
      const newIndex = campos.findIndex((c) => c.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return
      reordenar(arrayMove(campos, oldIndex, newIndex))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-chalk">Formulário de perfil</h1>
        <p className="mt-1 text-sm text-rope">
          Arraste um tipo de campo pro formulário abaixo, ou reordene os campos existentes.
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <Canvas
            formulario={formularioSelecionado}
            campos={campos}
            campoRecemCriado={campoRecemCriado}
            onCampoFocado={() => setCampoRecemCriado(null)}
            onAdicionarCampo={adicionarCampo}
            onAtualizarCampo={atualizarCampo}
            onRemoverCampo={removerCampo}
            onTornarPadrao={() => tornarPadrao(formularioSelecionado)}
            onExcluirFormulario={() => excluirFormulario(formularioSelecionado)}
            podeExcluir={!formularioSelecionado.padrao && formularios.length > 1}
          />
        </DndContext>
      )}
    </div>
  )
}

function Canvas({
  formulario,
  campos,
  campoRecemCriado,
  onCampoFocado,
  onAdicionarCampo,
  onAtualizarCampo,
  onRemoverCampo,
  onTornarPadrao,
  onExcluirFormulario,
  podeExcluir,
}: {
  formulario: Formulario
  campos: PerfilCampo[]
  campoRecemCriado: string | null
  onCampoFocado: () => void
  onAdicionarCampo: (tipo: CampoTipo) => void
  onAtualizarCampo: (
    campo: PerfilCampo,
    patch: Partial<Pick<PerfilCampo, 'label' | 'obrigatorio'>>,
  ) => void
  onRemoverCampo: (campo: PerfilCampo) => void
  onTornarPadrao: () => void
  onExcluirFormulario: () => void
  podeExcluir: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' })

  return (
    <Card ref={setNodeRef} className={isOver ? 'border-hanko/60 bg-hanko/5' : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rope-dim/15 pb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg text-chalk">{formulario.nome}</h2>
          {formulario.padrao && <Badge tone="hanko">padrão</Badge>}
        </div>
        <div className="flex gap-2">
          {!formulario.padrao && (
            <Button variant="secondary" onClick={onTornarPadrao}>
              Tornar padrão
            </Button>
          )}
          {podeExcluir && (
            <Button variant="ghost" onClick={onExcluirFormulario}>
              Excluir formulário
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-rope-dim/15 py-4">
        <PaletaChip id="paleta-texto" label="Texto" onAdicionar={() => onAdicionarCampo('texto')} />
        <PaletaChip
          id="paleta-documento"
          label="Documento"
          onAdicionar={() => onAdicionarCampo('documento')}
        />
      </div>

      <SortableContext items={campos.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col divide-y divide-rope-dim/15">
          {campos.map((campo) => (
            <CampoRow
              key={campo.id}
              campo={campo}
              autoFocar={campoRecemCriado === campo.id}
              onFocado={onCampoFocado}
              onAtualizar={(patch) => onAtualizarCampo(campo, patch)}
              onRemover={() => onRemoverCampo(campo)}
            />
          ))}
        </div>
      </SortableContext>

      {campos.length === 0 && (
        <p className="py-6 text-center text-sm text-rope">
          Arraste "Texto" ou "Documento" aqui pra criar o primeiro campo.
        </p>
      )}
    </Card>
  )
}

function PaletaChip({
  id,
  label,
  onAdicionar,
}: {
  id: string
  label: string
  onAdicionar: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      onClick={onAdicionar}
      {...listeners}
      {...attributes}
      className={`touch-none select-none rounded-full border border-dashed border-rope-dim/60 px-3.5 py-1.5 font-mono text-xs uppercase tracking-wide text-rope transition-colors ${
        isDragging ? 'cursor-grabbing opacity-40' : 'cursor-grab hover:border-hanko hover:text-hanko'
      }`}
    >
      + {label}
    </button>
  )
}

function CampoRow({
  campo,
  autoFocar,
  onFocado,
  onAtualizar,
  onRemover,
}: {
  campo: PerfilCampo
  autoFocar: boolean
  onFocado: () => void
  onAtualizar: (patch: Partial<Pick<PerfilCampo, 'label' | 'obrigatorio'>>) => void
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
      inputRef.current.select()
      onFocado()
    }
  }, [autoFocar, onFocado])

  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-wrap items-center gap-3 py-3 ${isDragging ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab px-1 text-rope-dim hover:text-rope active:cursor-grabbing"
        aria-label="Arrastar para reordenar"
      >
        ⠿
      </button>
      <input
        ref={inputRef}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => label.trim() && label !== campo.label && onAtualizar({ label: label.trim() })}
        className="min-w-40 flex-1 rounded-sm border border-transparent bg-transparent px-1.5 py-1 text-sm text-chalk hover:border-rope-dim/40 focus:border-hanko focus:outline-none"
      />
      <Badge>{campo.tipo}</Badge>
      <label className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-rope">
        <input
          type="checkbox"
          checked={campo.obrigatorio}
          onChange={(e) => onAtualizar({ obrigatorio: e.target.checked })}
        />
        obrigatório
      </label>
      <Button variant="ghost" onClick={onRemover}>
        ✕
      </Button>
    </div>
  )
}
