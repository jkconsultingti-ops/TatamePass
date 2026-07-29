/** Escurece uma cor hex — mesma proporção usada entre --color-hanko e
 * --color-hanko-dark no tema padrão, pra gerar o tom do :active/sombra dos
 * botões a partir de uma cor só. */
function escurecer(hex: string, fator = 0.78): string {
  const n = hex.replace('#', '')
  const canal = (i: number) => {
    const v = Math.round(parseInt(n.slice(i, i + 2), 16) * fator)
    return Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')
  }
  return `#${canal(0)}${canal(2)}${canal(4)}`
}

const HEX_VALIDO = /^#[0-9a-fA-F]{6}$/

/** Sobrescreve as CSS custom properties de cor de destaque no :root — todo
 * utilitário Tailwind (bg-hanko, text-hanko, etc) lê a variável em tempo de
 * execução, então isso re-tinge o app inteiro sem precisar de rebuild. */
export function aplicarCorMarca(cor: string | null | undefined) {
  const root = document.documentElement.style
  if (cor && HEX_VALIDO.test(cor)) {
    root.setProperty('--color-hanko', cor)
    root.setProperty('--color-hanko-dark', escurecer(cor))
  } else {
    root.removeProperty('--color-hanko')
    root.removeProperty('--color-hanko-dark')
  }
}

export type Tema = 'escuro' | 'claro'

/** Troca o conjunto de variáveis de fundo/texto pro tema escolhido (ver
 * :root[data-theme='claro'] em index.css) — 'escuro' é o padrão, então só
 * precisa setar o atributo quando for 'claro'. */
export function aplicarTema(tema: Tema | null | undefined) {
  if (tema === 'claro') {
    document.documentElement.dataset.theme = 'claro'
  } else {
    delete document.documentElement.dataset.theme
  }
}

function rgbParaHex(r: number, g: number, b: number): string {
  const canal = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${canal(r)}${canal(g)}${canal(b)}`
}

/** Lê os pixels da imagem (canvas, só no cliente) e devolve a cor mais
 * vibrante e frequente — ignora quase-branco/quase-preto/cinza (fundo ou
 * traço do logo, não "a cor" da marca). Serve só de sugestão pro admin
 * ajustar, não é uma extração de paleta precisa. */
export function extrairCorDominante(arquivo: File): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(arquivo)

    const limpar = () => URL.revokeObjectURL(url)

    img.onload = () => {
      try {
        const tamanho = 48
        const canvas = document.createElement('canvas')
        canvas.width = tamanho
        canvas.height = tamanho
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)

        ctx.drawImage(img, 0, 0, tamanho, tamanho)
        const { data } = ctx.getImageData(0, 0, tamanho, tamanho)

        const baldes = new Map<string, { count: number; r: number; g: number; b: number }>()
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]
          if (a < 200) continue

          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          const valor = max / 255
          const saturacao = max === 0 ? 0 : (max - min) / max
          if (valor > 0.95 || valor < 0.12 || saturacao < 0.2) continue

          const chave = `${Math.round(r / 16)}-${Math.round(g / 16)}-${Math.round(b / 16)}`
          const atual = baldes.get(chave)
          if (atual) atual.count++
          else baldes.set(chave, { count: 1, r, g, b })
        }

        let melhor: { count: number; r: number; g: number; b: number } | null = null
        for (const balde of baldes.values()) {
          if (!melhor || balde.count > melhor.count) melhor = balde
        }

        resolve(melhor ? rgbParaHex(melhor.r, melhor.g, melhor.b) : null)
      } finally {
        limpar()
      }
    }
    img.onerror = () => {
      limpar()
      resolve(null)
    }
    img.src = url
  })
}
