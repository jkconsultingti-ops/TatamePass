import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { aplicarCorMarca } from '../lib/branding'
import type { Academia, Profile } from '../types/database'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  academia: Academia | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithPassword: (email: string, senha: string) => Promise<void>
  signUpWithPassword: (email: string, senha: string) => Promise<{ precisaConfirmarEmail: boolean }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshAcademia: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [academia, setAcademia] = useState<Academia | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data)
  }, [])

  const loadAcademia = useCallback(async (academiaId: string) => {
    const { data } = await supabase.from('academias').select('*').eq('id', academiaId).maybeSingle()
    setAcademia(data)
  }, [])

  useEffect(() => {
    if (profile?.academia_id) {
      loadAcademia(profile.academia_id)
    } else {
      setAcademia(null)
    }
  }, [profile?.academia_id, loadAcademia])

  useEffect(() => {
    aplicarCorMarca(academia?.cor_marca)
  }, [academia?.cor_marca])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      if (active) setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!active) return
      setSession(newSession)
      if (newSession) {
        await loadProfile(newSession.user.id)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    })
  }, [])

  const signInWithPassword = useCallback(async (email: string, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) throw error
  }, [])

  const signUpWithPassword = useCallback(async (email: string, senha: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) throw error
    return { precisaConfirmarEmail: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id)
  }, [session, loadProfile])

  const refreshAcademia = useCallback(async () => {
    if (profile?.academia_id) await loadAcademia(profile.academia_id)
  }, [profile?.academia_id, loadAcademia])

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        academia,
        loading,
        signInWithGoogle,
        signInWithPassword,
        signUpWithPassword,
        signOut,
        refreshProfile,
        refreshAcademia,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
