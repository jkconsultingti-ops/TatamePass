import { useEffect, useState } from 'react'
import { Share, MoreVertical, X, Smartphone, Check } from 'lucide-react'
import { usePromptInstalacaoDisponivel, solicitarInstalacao } from '../lib/instalarPwa'

const CHAVE_DISPENSADO = 'instalar-app-dispensado'

const BENEFICIOS = [
  'Abre direto da tela inicial, sem precisar digitar o site',
  'Fica com um ícone só seu, fácil de encontrar',
  'Ocupa pouco espaço no celular',
]

function appJaInstalado() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true
  return standalone || iosStandalone
}

type Plataforma = 'ios' | 'android' | 'outro'

function detectarPlataforma(): Plataforma {
  const ua = window.navigator.userAgent
  // iPadOS 13+ se identifica como Mac no user agent, mas tem tela de toque —
  // por isso o teste extra de maxTouchPoints além do userAgent.
  const iOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  if (iOS) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'outro'
}

/** Card promocional + modal com o passo a passo de instalação do PWA. Some
 * sozinho se o app já estiver rodando instalado, ou se o usuário dispensar. */
export function InstalarAppCard() {
  const [visivel, setVisivel] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const podeInstalarAgora = usePromptInstalacaoDisponivel()
  const [plataforma] = useState(detectarPlataforma)

  useEffect(() => {
    const jaDispensado = localStorage.getItem(CHAVE_DISPENSADO) === '1'
    // O passo a passo é sempre de celular (Android/iPhone) — em desktop não
    // há instrução relevante pra mostrar, então o card nem aparece.
    setVisivel(plataforma !== 'outro' && !appJaInstalado() && !jaDispensado)
  }, [plataforma])

  if (!visivel) return null

  function dispensar() {
    localStorage.setItem(CHAVE_DISPENSADO, '1')
    setVisivel(false)
    setModalAberto(false)
  }

  async function instalarAgora() {
    const resultado = await solicitarInstalacao()
    setModalAberto(false)
    if (resultado === 'accepted') setVisivel(false)
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-lg border border-rope-dim/25 bg-ink-soft shadow-sm">
        <div className="h-1 bg-gradient-to-r from-hanko via-hanko-dark to-mat" />
        <div className="p-5">
          <button
            type="button"
            onClick={dispensar}
            aria-label="Fechar"
            className="absolute right-3 top-4 text-rope-dim hover:text-chalk"
          >
            <X size={18} />
          </button>

          <div className="flex items-start gap-4 pr-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-hanko/15">
              <Smartphone size={22} className="text-hanko" />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-wide text-mat-light">— Recomendado</p>
              <h2 className="mt-0.5 font-display text-base font-semibold text-chalk">
                Adicionar <span className="italic text-hanko">atalho</span> no celular
              </h2>
              <p className="mt-1 text-sm text-rope">Abra direto da tela inicial.</p>
              <button
                type="button"
                onClick={() => setModalAberto(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-hanko to-hanko-dark px-5 py-2.5 text-sm font-semibold text-paper shadow-sm transition-transform hover:scale-[1.02]"
              >
                <Smartphone size={16} />
                Ver como adicionar
              </button>
            </div>
          </div>
        </div>
      </div>

      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setModalAberto(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-ink-soft p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-hanko/15">
                <Smartphone size={28} className="text-hanko" />
              </div>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                aria-label="Fechar"
                className="text-rope-dim hover:text-chalk"
              >
                <X size={20} />
              </button>
            </div>

            <h2 className="mt-4 font-display text-xl font-semibold text-chalk">
              Adicionar <span className="italic text-hanko">atalho</span> na tela inicial?
            </h2>
            <p className="mt-2 text-sm text-rope">Adicione na tela inicial do seu celular.</p>

            <div className="mt-4 space-y-2 rounded-lg bg-ink p-4">
              {BENEFICIOS.map((item) => (
                <p key={item} className="flex items-start gap-2 text-sm text-rope">
                  <Check size={16} className="mt-0.5 shrink-0 text-mat-light" />
                  {item}
                </p>
              ))}
            </div>

            {podeInstalarAgora ? (
              <>
                <p className="mt-4 text-xs text-rope">
                  <strong className="text-chalk">Próximo passo:</strong> o celular vai perguntar se
                  quer adicionar. Toque em "Instalar" quando aparecer.
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={dispensar}
                    className="flex-1 rounded-full border border-rope-dim/50 py-2.5 text-sm font-semibold text-chalk hover:border-hanko hover:text-hanko"
                  >
                    Agora não
                  </button>
                  <button
                    type="button"
                    onClick={instalarAgora}
                    className="flex-1 rounded-full bg-gradient-to-r from-hanko to-hanko-dark py-2.5 text-sm font-semibold text-paper"
                  >
                    Adicionar agora
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={`mt-4 grid gap-4 ${plataforma === 'outro' ? 'sm:grid-cols-2' : ''}`}>
                  {plataforma !== 'ios' && (
                    <div>
                      <p className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-rope">
                        <MoreVertical size={14} /> Android (Chrome)
                      </p>
                      <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-chalk">
                        <li>Toque no menu ⋮ no canto superior direito</li>
                        <li>Toque em "Adicionar à tela inicial" (ou "Instalar aplicativo")</li>
                        <li>Confirme em "Instalar" ou "Adicionar"</li>
                      </ol>
                    </div>
                  )}
                  {plataforma !== 'android' && (
                    <div>
                      <p className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-rope">
                        <Share size={14} /> iPhone (Safari)
                      </p>
                      <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-chalk">
                        <li>Toque no ícone de compartilhar (quadrado com seta pra cima) na barra de baixo</li>
                        <li>Role e toque em "Adicionar à Tela de Início"</li>
                        <li>Toque em "Adicionar"</li>
                      </ol>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="mt-4 w-full rounded-full bg-gradient-to-r from-hanko to-hanko-dark py-2.5 text-sm font-semibold text-paper"
                >
                  Entendi
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
