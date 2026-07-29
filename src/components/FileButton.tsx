import { useId, type ReactNode } from 'react'

export function FileButton({
  accept,
  disabled,
  onSelect,
  label,
  icon,
  className = '',
}: {
  accept?: string
  disabled?: boolean
  onSelect: (arquivo: File) => void
  label: string
  icon?: ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className={`inline-flex w-fit items-center gap-2 rounded-sm border border-rope-dim/70 bg-transparent px-4 py-2 text-sm font-medium text-chalk transition-all hover:border-rope active:translate-y-[1px] ${
        disabled ? 'pointer-events-none opacity-40' : 'cursor-pointer'
      } ${className}`}
    >
      {icon}
      {label}
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(e) => {
          const arquivo = e.target.files?.[0]
          if (arquivo) onSelect(arquivo)
          e.target.value = ''
        }}
        className="sr-only"
      />
    </label>
  )
}
