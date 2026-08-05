import { forwardRef, type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

const base =
  'inline-flex items-center justify-center gap-2 rounded-sm px-5 py-2.5 text-sm font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40'

const variants: Record<Variant, string> = {
  primary:
    'bg-hanko text-paper shadow-[0_3px_0_0_var(--color-hanko-dark)] hover:brightness-110 active:translate-y-[3px] active:shadow-none',
  secondary:
    'border border-rope-dim/70 bg-transparent text-chalk hover:border-rope active:translate-y-[1px]',
  ghost: 'text-rope hover:text-chalk',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', className = '', ...props }, ref) => (
    <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...props} />
  ),
)
Button.displayName = 'Button'
