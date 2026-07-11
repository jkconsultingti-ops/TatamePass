export function Stamp({
  className = '',
  label = 'TP',
}: {
  className?: string
  label?: string
}) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <circle cx="60" cy="60" r="55" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle
        cx="60"
        cy="60"
        r="46"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="1.5 4.5"
      />
      <text
        x="60"
        y="72"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontWeight="700"
        fontSize="40"
        fill="currentColor"
        transform="rotate(-4 60 60)"
      >
        {label}
      </text>
    </svg>
  )
}
