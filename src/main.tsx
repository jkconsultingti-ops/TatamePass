import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { bloquearZoomNoSafari } from './lib/bloquearZoom'

bloquearZoomNoSafari()

// O service worker (skipWaiting + clientsClaim) já assume sozinho em segundo
// plano assim que baixa uma versão nova, mas sem isso a aba aberta só
// percebia a atualização na próxima checagem espontânea do navegador — rara
// e imprevisível — daí o app "às vezes" aparecer com o bundle antigo (CSS
// desatualizado, etc) e "às vezes" com o novo. `immediate: true` registra na
// hora; recarrega sozinho assim que percebe versão nova (sem prompt, já que
// registerType já é 'autoUpdate'); e a checagem a cada 60s garante que uma
// aba deixada aberta não fique dias sem notar um deploy novo.
const atualizarSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    setInterval(() => registration.update(), 60_000)
  },
  onNeedRefresh() {
    atualizarSW(true)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
