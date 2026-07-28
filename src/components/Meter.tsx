export function Meter({ fracao, className = '' }: { fracao: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, fracao)) * 100
  return (
    <div className={`h-2.5 overflow-hidden rounded-full border border-rope-dim/30 bg-ink ${className}`}>
      <div className="h-full rounded-full bg-rope" style={{ width: `${pct}%` }} />
    </div>
  )
}
