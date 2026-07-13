import { forwardRef, type HTMLAttributes } from 'react'

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`rounded-md border border-rope-dim/25 bg-ink-soft p-5 ${className}`}
      {...props}
    />
  ),
)
Card.displayName = 'Card'
