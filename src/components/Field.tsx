import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type TextareaHTMLAttributes } from 'react'

/** 'md' é o padrão do app inteiro (telas densas: listas, filtros, tabelas) —
 * nada muda sem pedir. 'lg' é só pras telas de entrada (login, criar
 * academia), onde é um formulário sozinho na tela e campo apertado incomoda. */
export type TamanhoCampo = 'md' | 'lg'

const labelSizes: Record<TamanhoCampo, string> = {
  md: 'mb-1.5 text-[11px]',
  lg: 'mb-2 text-xs',
}

export function Label({
  className = '',
  tamanho = 'md',
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { tamanho?: TamanhoCampo }) {
  return (
    <label
      className={`block font-mono uppercase tracking-[0.14em] text-rope ${labelSizes[tamanho]} ${className}`}
      {...props}
    />
  )
}

const fieldBase =
  'w-full rounded-sm border border-rope-dim/50 bg-ink text-chalk placeholder:text-rope-dim/70 focus:border-hanko focus:outline-none focus:ring-1 focus:ring-hanko'

const fieldSizes: Record<TamanhoCampo, string> = {
  md: 'px-3.5 py-2.5 text-sm',
  lg: 'px-4 py-3.5 text-base',
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { tamanho?: TamanhoCampo }
>(({ className = '', tamanho = 'md', ...props }, ref) => (
  <input ref={ref} className={`${fieldBase} ${fieldSizes[tamanho]} ${className}`} {...props} />
))
Input.displayName = 'Input'

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { tamanho?: TamanhoCampo }
>(({ className = '', tamanho = 'md', ...props }, ref) => (
  <textarea
    ref={ref}
    className={`${fieldBase} ${fieldSizes[tamanho]} min-h-24 resize-y ${className}`}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

export function FieldError({ children }: { children?: string }) {
  if (!children) return null
  return <p className="mt-1 font-mono text-xs text-hanko">{children}</p>
}
