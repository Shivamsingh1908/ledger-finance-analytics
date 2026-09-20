import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { acceptSession, api, restoreSession, setSessionListener } from '../api/client'
import type { Session, User } from '../types'

const AuthContext = createContext<{ user: User | null; loading: boolean; login: (session: Session) => void; logout: () => Promise<void> }>({ user: null, loading: true, login: () => {}, logout: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()
  useEffect(() => {
    setSessionListener(session => { setUser(session?.user ?? null); if (!session) queryClient.clear() })
    void restoreSession().finally(() => setLoading(false))
    return () => setSessionListener(() => {})
  }, [queryClient])
  async function logout() {
    await api('/auth/logout', { method: 'POST' })
    acceptSession(null)
    queryClient.clear()
  }
  return <AuthContext.Provider value={{ user, loading, login: acceptSession, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() { return useContext(AuthContext) }