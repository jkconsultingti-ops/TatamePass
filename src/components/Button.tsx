import { forwardRef, type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

/** Mesma ideia do TamanhoCampo em Field.tsx: 'md' é o padrão do app,
 * 'lg' só nas telas de entrada. */
type Tamanho = 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40'

const sizes: Record<Tamanho, string> = {
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3.5 text-base',
}

const variants: Record<Variant, string> = {
  primary:
    'bg-hanko text-paper shadow-[0_3px_0_0_var(--color-hanko-dark)] hover:brightness-110 active:translate-y-[3px] active:shadow-none',
  secondary:
    'border border-rope-dim/70 bg-transparent text-chalk hover:border-rope active:translate-y-[1px]',
  ghost: 'text-rope hover:text-chalk',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  tamanho?: Tamanho
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', tamanho = 'md', className = '', ...props }, ref) => (
    <button
      ref={ref}
      className={`${base} ${sizes[tamanho]} ${variants[variant]} ${className}`}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
