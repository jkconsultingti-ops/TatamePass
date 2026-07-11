import type { HTMLAttributes } from 'react'

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-md border border-rope-dim/25 bg-ink-soft p-5 ${className}`}
      {...props}
    />
  )
}
