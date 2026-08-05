import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type TextareaHTMLAttributes } from 'react'

export function Label({ className = '', ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`mb-1.5 block font-mono text-[11px] uppercase tracking-[0.14em] text-rope ${className}`}
      {...props}
    />
  )
}

const fieldStyles =
  'w-full rounded-sm border border-rope-dim/50 bg-ink px-3.5 py-2.5 text-sm text-chalk placeholder:text-rope-dim/70 focus:border-hanko focus:outline-none focus:ring-1 focus:ring-hanko'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => (
    <input ref={ref} className={`${fieldStyles} ${className}`} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => (
    <textarea ref={ref} className={`${fieldStyles} min-h-24 resize-y ${className}`} {...props} />
  ),
)
Textarea.displayName = 'Textarea'

export function FieldError({ children }: { children?: string }) {
  if (!children) return null
  return <p className="mt-1 font-mono text-xs text-hanko">{children}</p>
}
