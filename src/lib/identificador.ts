import type { IdentificadorTipo } from '../types/database'

// Domínio técnico interno: nunca recebe e-mail de verdade. Login por telefone
// não usa SMS (custo com provedor terceiro) — a "garantia de identidade" nesse
// caso vem do próprio fluxo de onboarding, não de um OTP. Ver decisoes.md.
const DOMINIO_TELEFONE = 'telefone.tatamepass.app'

export function normalizarTelefone(valor: string): string {
  return valor.replace(/\D/g, '')
}

/** Formata progressivamente enquanto digita: (19) 99999-0000. Sempre no
 * padrão de celular (DDD + 9 dígitos) — é o único caso real aqui, já que o
 * telefone é sempre usado pra WhatsApp. */
export function formatarTelefone(valor: string): string {
  const digitos = normalizarTelefone(valor).slice(0, 11)
  if (digitos.length === 0) return ''
  if (digitos.length <= 2) return `(${digitos}`
  const ddd = digitos.slice(0, 2)
  const resto = digitos.slice(2)
  if (resto.length <= 5) return `(${ddd}) ${resto}`
  return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`
}

/** E-mail técnico usado só para autenticação no Supabase; nunca é exibido nem recebe envios. */
export function identificadorParaEmailAuth(tipo: IdentificadorTipo, valor: string): string {
  if (tipo === 'email') return valor.trim().toLowerCase()
  return `${normalizarTelefone(valor)}@${DOMINIO_TELEFONE}`
}

/** Inverso de `identificadorParaEmailAuth` — a partir do e-mail técnico da sessão,
 * recupera o tipo/valor que o usuário realmente escolheu no login/cadastro. */
export function identificadorDeSessao(email: string): { tipo: IdentificadorTipo; valor: string } {
  if (email.endsWith(`@${DOMINIO_TELEFONE}`)) {
    return { tipo: 'telefone', valor: email.slice(0, -(`@${DOMINIO_TELEFONE}`.length)) }
  }
  return { tipo: 'email', valor: email }
}

export function telefoneValido(valor: string): boolean {
  const digitos = normalizarTelefone(valor)
  return digitos.length === 10 || digitos.length === 11
}

export function emailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim())
}
