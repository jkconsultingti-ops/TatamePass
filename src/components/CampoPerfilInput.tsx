import { Paperclip } from 'lucide-react'
import { decodeCaixas, encodeCaixas } from '../lib/formularios'
import { Input, Textarea } from './Field'
import { FileButton } from './FileButton'
import type { PerfilCampo } from '../types/database'

/** Renderiza só o input de um campo de perfil, sem label nem botão de
 * salvar — quem envolve decide a semântica de salvar (por campo, tudo de
 * uma vez, com ou sem auto-save). Usado tanto em AlunoPerfil.tsx (edição,
 * um campo por vez) quanto em AlunoCompletarPerfil.tsx (preencher tudo e
 * enviar junto). */
export function CampoPerfilInput({
  campo,
  valor,
  onChange,
  onArquivo,
  documentoEnviado,
  enviandoArquivo,
}: {
  campo: PerfilCampo
  valor: string
  onChange: (valor: string) => void
  onArquivo: (arquivo: File) => void
  documentoEnviado: boolean
  enviandoArquivo: boolean
}) {
  switch (campo.tipo) {
    case 'texto_curto':
    case 'numero':
    case 'data':
      return (
        <Input
          id={campo.id}
          type={campo.tipo === 'numero' ? 'number' : campo.tipo === 'data' ? 'date' : 'text'}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="max-w-sm"
        />
      )

    case 'texto_longo':
      return <Textarea id={campo.id} value={valor} onChange={(e) => onChange(e.target.value)} />

    case 'multipla_escolha':
      return (
        <div className="flex flex-col gap-2">
          {(campo.opcoes ?? []).map((opcao) => (
            <label key={opcao} className="flex items-center gap-2 text-sm text-chalk">
              <input
                type="radio"
                name={campo.id}
                checked={valor === opcao}
                onChange={() => onChange(opcao)}
              />
              {opcao}
            </label>
          ))}
        </div>
      )

    case 'caixa_selecao': {
      const selecionadas = decodeCaixas(valor)
      return (
        <div className="flex flex-col gap-2">
          {(campo.opcoes ?? []).map((opcao) => (
            <label key={opcao} className="flex items-center gap-2 text-sm text-chalk">
              <input
                type="checkbox"
                checked={selecionadas.includes(opcao)}
                onChange={(e) => {
                  const novas = e.target.checked
                    ? [...selecionadas, opcao]
                    : selecionadas.filter((o) => o !== opcao)
                  onChange(encodeCaixas(novas))
                }}
              />
              {opcao}
            </label>
          ))}
        </div>
      )
    }

    case 'lista_suspensa':
      return (
        <select
          id={campo.id}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="w-full max-w-sm rounded-sm border border-rope-dim/50 bg-ink px-3.5 py-2.5 text-sm text-chalk focus:border-hanko focus:outline-none focus:ring-1 focus:ring-hanko"
        >
          <option value="">Selecione</option>
          {(campo.opcoes ?? []).map((opcao) => (
            <option key={opcao} value={opcao}>
              {opcao}
            </option>
          ))}
        </select>
      )

    case 'documento':
      return (
        <div className="flex flex-col gap-2">
          {documentoEnviado && <p className="font-mono text-xs text-mat-light">Documento enviado ✓</p>}
          <FileButton
            disabled={enviandoArquivo}
            onSelect={onArquivo}
            label={enviandoArquivo ? 'Enviando…' : 'Escolher arquivo'}
            icon={<Paperclip className="h-4 w-4" />}
          />
        </div>
      )

    default:
      return null
  }
}
