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
