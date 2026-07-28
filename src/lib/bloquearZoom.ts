/**
 * O Safari no iOS ignora "user-scalable=no" do viewport por padrão de
 * acessibilidade — pinch-zoom e double-tap-zoom continuam funcionando mesmo
 * com o meta tag configurado (index.html). O único jeito que funciona de
 * verdade nesse navegador é bloquear os eventos de gesto proprietários do
 * WebKit (gesturestart/gesturechange/gestureend) e o touchmove com mais de
 * um dedo, além de interceptar o double-tap.
 */
export function bloquearZoomNoSafari() {
  const bloquear = (e: Event) => e.preventDefault()

  document.addEventListener('gesturestart', bloquear)
  document.addEventListener('gesturechange', bloquear)
  document.addEventListener('gestureend', bloquear)

  document.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault()
    },
    { passive: false },
  )

  let ultimoToque = 0
  document.addEventListener(
    'touchend',
    (e: TouchEvent) => {
      const agora = Date.now()
      if (agora - ultimoToque <= 300) e.preventDefault()
      ultimoToque = agora
    },
    { passive: false },
  )
}
