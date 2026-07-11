import type { ReactNode } from 'react'

type Tone = 'neutral' | 'mat' | 'hanko'

const tones: Record<Tone, string> = {
  neutral: 'border-rope-dim/50 text-rope',
  mat: 'border-mat-light/50 text-mat-light bg-mat/10',
  hanko: 'border-hanko/50 text-hanko bg-hanko/10',
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
