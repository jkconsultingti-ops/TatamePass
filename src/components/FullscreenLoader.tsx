export function FullscreenLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-ink">
      <div className="flex flex-col items-center gap-3">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-rope-dim border-t-hanko" />
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-rope">
          carregando
        </span>
      </div>
    </div>
  )
}
