import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { identificadorDeSessao } from '../../lib/identificador'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Stamp } from '../../components/Stamp'
import { FullscreenLoader } from '../../components/FullscreenLoader'
import { FormularioCredenciais } from './FormularioCredenciais'
import type { UserRole } from '../../types/database'

const ROTULO_ROLE: Record<UserRole, string> = {
  admin: 'admin',
  professor: 'professor',
  aluno: 'aluno',
}

function homePathFor(role: UserRole) {
  if (role === 'admin') return '/admin'
  if (role === 'professor') return '/professor'
  return '/aluno'
}

export function ConviteEntrar() {
  const { codigo } = useParams<{ codigo: string }>()
  const { session, profile, loading: authLoading, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [convite, setConvite] = useState<{ academia_id: string; nome: string; role: UserRole } | null>(
    null,
  )
  const [carregandoConvite, setCarregandoConvite] = useState(true)
  const [erroConvite, setErroConvite] = useState<string | null>(null)
  const [erroEntrada, setErroEntrada] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    if (!codigo) return
    let ativo = true
    supabase
      .rpc('resolve_convite', { p_codigo: codigo.trim().toUpperCase() })
      .then(({ data, error }) => {
        if (!ativo) return
        if (error) setErroConvite(error.message)
        else if (!data?.[0]) setErroConvite('Convite não encontrado ou expirado.')
        else setConvite(data[0])
        setCarregandoConvite(false)
      })
    return () => {
      ativo = false
    }
  }, [codigo])

  useEffect(() => {
    if (!session || profile || !convite) return
    let ativo = true
    setEntrando(true)
    setErroEntrada(null)

    async function entrar() {
      try {
        const { tipo, valor } = identificadorDeSessao(session!.user.email!)
        const metadata = session!.user.user_metadata ?? {}
        const nome =
          (metadata.full_name as string | undefined) ?? (metadata.name as string | undefined) ?? ''
        const foto =
          (metadata.avatar_url as string | undefined) ?? (metadata.picture as string | undefined) ?? null

        const { error } = await supabase.from('profiles').insert({
          id: session!.user.id,
          academia_id: convite!.academia_id,
          role: convite!.role,
          nome,
          foto_url: foto,
          identificador_tipo: tipo,
          identificador_valor: valor,
          revisado_pelo_professor: convite!.role !== 'aluno',
        })
        if (error) throw error

        await refreshProfile()
        if (!ativo) return
        const destino = convite!.role === 'aluno' ? '/aluno/completar-perfil' : homePathFor(convite!.role)
        navigate(destino, { replace: true })
      } catch (err) {
        if (ativo) {
          setErroEntrada(err instanceof Error ? err.message : 'Não foi possível entrar na academia')
          setEntrando(false)
        }
      }
    }

    entrar()
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, profile, convite, tentativa])

  if (carregandoConvite || authLoading) return <FullscreenLoader />

  if (erroConvite) {
    return (
      <ConviteShell>
        <p className="text-sm text-hanko">{erroConvite}</p>
      </ConviteShell>
    )
  }

  if (!convite) return null

  if (profile) {
    return (
      <ConviteShell>
        <p className="text-sm text-rope">
          Você já faz parte de outra academia com essa conta — esse convite não se aplica.
        </p>
      </ConviteShell>
    )
  }

  return (
    <ConviteShell>
      <h1 className="font-display text-2xl font-semibold text-chalk">Convite pra {convite.nome}</h1>
      <p className="mt-1 text-sm text-rope">
        Você foi convidado(a) a entrar como{' '}
        <strong className="text-chalk">{ROTULO_ROLE[convite.role]}</strong>.
      </p>

      {erroEntrada && <p className="mt-3 font-mono text-xs text-hanko">{erroEntrada}</p>}

      {session ? (
        entrando ? (
          <p className="mt-6 text-sm text-rope">Entrando…</p>
        ) : (
          <Button onClick={() => setTentativa((t) => t + 1)} className="mt-6">
            Tentar novamente
          </Button>
        )
      ) : (
        <div className="mt-6">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-rope-dim">Conta</h2>
          <FormularioCredenciais mensagemConfirmarEmail="Conta criada! Verifique seu e-mail e volte a abrir este link pra entrar na academia." />
        </div>
      )}
    </ConviteShell>
  )
}

function ConviteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-ink px-6 py-12 text-center">
      <Stamp className="h-14 w-14 text-hanko" />
      <Card className="mt-6 w-full max-w-sm text-left">{children}</Card>
    </div>
  )
}
