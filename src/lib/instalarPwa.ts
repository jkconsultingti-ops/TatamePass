import { useSyncExternalStore } from 'react'

/** Evento não-padrão do Chrome/Android — só existe nesse tipo de navegador. */
interface EventoInstalacao extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let eventoCapturado: EventoInstalacao | null = null
const ouvintes = new Set<() => void>()

function notificar() {
  ouvintes.forEach((fn) => fn())
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  eventoCapturado = e as EventoInstalacao
  notificar()
})

window.addEventListener('appinstalled', () => {
  eventoCapturado = null
  notificar()
})

/** true só no Chrome/Android (e afins) quando o navegador já decidiu que o
 * app é instalável — nesse caso dá pra disparar o prompt nativo de verdade.
 * No Safari/iOS isso nunca acontece (a Apple não expõe essa API). */
export function usePromptInstalacaoDisponivel() {
  return useSyncExternalStore(
    (fn) => {
      ouvintes.add(fn)
      return () => ouvintes.delete(fn)
    },
    () => eventoCapturado !== null,
  )
}

export async function solicitarInstalacao() {
  if (!eventoCapturado) return null
  await eventoCapturado.prompt()
  const escolha = await eventoCapturado.userChoice
  eventoCapturado = null
  notificar()
  return escolha.outcome
}
