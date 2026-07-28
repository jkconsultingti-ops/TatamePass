type Tamanho = 'sm' | 'md' | 'lg'

const CORES_FAIXA: Record<string, { corpo: string; borda?: string; listra?: string }> = {
  branca: { corpo: '#F2EEE3', borda: '#D8D2C2' },
  cinza: { corpo: '#9AA5B1', borda: '#7C8896' },
  amarela: { corpo: '#F5C518', borda: '#D9AE00' },
  laranja: { corpo: '#E8792E', borda: '#C9601B' },
  verde: { corpo: '#2E7D32' },
  azul: { corpo: '#1E4C91' },
  roxa: { corpo: '#5B3B7A' },
  marrom: { corpo: '#5A3A22' },
  preta: { corpo: '#17140F', listra: '#C0392B' },
}
const COR_PADRAO = { corpo: '#9CA3AF' }

const TAMANHOS: Record<Tamanho, { h: number; corpo: number; ponta: number; listra: number }> = {
  sm: { h: 24, corpo: 96, ponta: 44, listra: 4 },
  md: { h: 40, corpo: 160, ponta: 72, listra: 5 },
  lg: { h: 60, corpo: 240, ponta: 100, listra: 7 },
}

interface BeltProps {
  nome: string
  grau?: number
  maxGraus?: number | null
  tamanho?: Tamanho
  className?: string
}

export function Belt({ nome, grau = 0, maxGraus, tamanho = 'md', className = '' }: BeltProps) {
  const cores = CORES_FAIXA[nome.trim().toLowerCase()] ?? COR_PADRAO
  const { h, corpo, ponta, listra } = TAMANHOS[tamanho]
  const totalListras = maxGraus ?? Math.max(grau, 4)
  const corListra = cores.listra ?? '#F2EEE3'

  return (
    <div
      className={`inline-flex overflow-hidden rounded-md border border-rope-dim/40 ${className}`}
      style={{ height: h }}
      role="img"
      aria-label={`Faixa ${nome}${grau ? `, ${grau}º grau` : ''}`}
    >
      <div
        className="relative"
        style={{
          width: corpo,
          background: cores.corpo,
          borderRight: cores.borda ? `1px solid ${cores.borda}` : undefined,
        }}
      />
      <div
        className="flex flex-shrink-0 items-center justify-center gap-1"
        style={{ width: ponta, background: '#17140F' }}
      >
        {Array.from({ length: totalListras }, (_, i) => (
          <span
            key={i}
            className="rounded-sm"
            style={{
              width: listra,
              height: '60%',
              background: i < grau ? corListra : 'rgba(255,255,255,0.14)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
