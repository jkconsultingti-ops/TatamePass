import { useEffect, useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { aplicarCorMarca, aplicarTema, extrairCorDominante, type Tema } from '../../lib/branding'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Label } from '../../components/Field'
import { FileButton } from '../../components/FileButton'

const COR_PADRAO = '#c1391f'

export function AdminMarca() {
  const { profile, academia, refreshAcademia } = useAuth()
  const [cor, setCor] = useState(academia?.cor_marca ?? COR_PADRAO)
  const [corSugerida, setCorSugerida] = useState(false)
  const [logoUrl, setLogoUrl] = useState(academia?.logo_url ?? null)
  const [tema, setTema] = useState<Tema>(academia?.tema ?? 'escuro')
  const [enviandoLogo, setEnviandoLogo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    setCor(academia?.cor_marca ?? COR_PADRAO)
    setLogoUrl(academia?.logo_url ?? null)
    setTema(academia?.tema ?? 'escuro')
  }, [academia?.cor_marca, academia?.logo_url, academia?.tema])

  // Prévia ao vivo: mexe nas mesmas variáveis que o AuthProvider aplica a
  // partir do que está salvo — ao sair da tela sem salvar, o próximo reload
  // volta pro valor salvo, então não há risco de "vazar" a prévia.
  useEffect(() => {
    aplicarCorMarca(cor)
    return () => aplicarCorMarca(academia?.cor_marca)
  }, [cor, academia?.cor_marca])

  useEffect(() => {
    aplicarTema(tema)
    return () => aplicarTema(academia?.tema)
  }, [tema, academia?.tema])

  async function enviarLogo(arquivo: File) {
    if (!profile) return
    setEnviandoLogo(true)
    setErro(null)
    try {
      const [corDaLogo] = await Promise.all([
        extrairCorDominante(arquivo),
        (async () => {
          const extensao = arquivo.name.split('.').pop() ?? 'png'
          const caminho = `${profile.academia_id}/logo.${extensao}`
          const { error: uploadError } = await supabase.storage
            .from('academia-branding')
            .upload(caminho, arquivo, { upsert: true })
          if (uploadError) throw uploadError
          const { data } = supabase.storage.from('academia-branding').getPublicUrl(caminho)
          setLogoUrl(`${data.publicUrl}?v=${Date.now()}`)
        })(),
      ])
      if (corDaLogo) {
        setCor(corDaLogo)
        setCorSugerida(true)
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar o logo')
    } finally {
      setEnviandoLogo(false)
    }
  }

  async function salvar() {
    if (!profile) return
    setSalvando(true)
    setErro(null)
    setMensagem(null)
    try {
      const { error } = await supabase
        .from('academias')
        .update({ cor_marca: cor, logo_url: logoUrl, tema })
        .eq('id', profile.academia_id)
      if (error) throw error
      await refreshAcademia()
      setMensagem('Salvo.')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-chalk">Marca</h1>
        <p className="mt-1 text-sm text-rope">
          A cor, o logo e o tema aqui aparecem pra todo mundo da academia dentro do app.
        </p>
      </div>

      <Card className="flex flex-col divide-y divide-rope-dim/20">
        <div className="flex items-center gap-4 pb-4">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-ink" />
          )}
          <div className="flex flex-col gap-1.5">
            <FileButton
              accept="image/*"
              disabled={enviandoLogo}
              onSelect={enviarLogo}
              label={enviandoLogo ? 'Enviando…' : 'Trocar logo'}
              icon={<ImageIcon className="h-4 w-4" />}
            />
            <p className="font-mono text-[11px] text-rope-dim">JPG, PNG ou WebP</p>
          </div>
        </div>

        <div className="py-4">
          <Label htmlFor="cor-marca">Cor de destaque</Label>
          <div className="flex items-center gap-3">
            <input
              id="cor-marca"
              type="color"
              value={cor}
              onChange={(e) => {
                setCor(e.target.value)
                setCorSugerida(false)
              }}
              className="h-10 w-14 cursor-pointer rounded-sm border border-rope-dim/80 bg-ink p-1"
            />
            <span className="font-mono text-sm text-rope">{cor}</span>
          </div>
          {corSugerida && (
            <p className="mt-1.5 font-mono text-[11px] text-rope-dim">
              Sugestão a partir da logo — ajuste se quiser.
            </p>
          )}
        </div>

        <div className="pt-4">
          <Label>Tema</Label>
          <div className="flex w-fit gap-1 rounded-sm border border-rope-dim/40 p-1">
            {(['escuro', 'claro'] as const).map((opcao) => (
              <button
                key={opcao}
                type="button"
                onClick={() => setTema(opcao)}
                className={`rounded-sm px-4 py-2 font-mono text-xs uppercase tracking-wide transition-colors ${
                  tema === opcao ? 'bg-hanko/15 text-hanko' : 'text-rope hover:text-chalk'
                }`}
              >
                {opcao}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {erro && <p className="font-mono text-xs text-hanko">{erro}</p>}
      {mensagem && <p className="font-mono text-xs text-rope">{mensagem}</p>}

      <Button onClick={salvar} disabled={salvando} className="self-start">
        {salvando ? 'Salvando…' : 'Salvar'}
      </Button>
    </div>
  )
}
