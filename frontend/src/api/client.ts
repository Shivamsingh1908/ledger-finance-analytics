import type { Session } from '../types'

const base = import.meta.env.VITE_API_BASE_URL ?? ''
let token: string | null = null
let refreshPromise: Promise<Session | null> | null = null
let onSession: (session: Session | null) => void = () => {}

export function setSessionListener(listener: typeof onSession) { onSession = listener }
export function acceptSession(session: Session | null) { token = session?.accessToken ?? null; onSession(session) }

export async function restoreSession(): Promise<Session | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${base}/api/auth/refresh`, {
      method: 'POST', credentials: 'include', headers: { 'X-Finance-Client': 'web' },
    }).then(async response => {
      const session: Session | null = response.ok ? await response.json() : null
      acceptSession(session)
      return session
    }).catch(() => { acceptSession(null); return null }).finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('X-Finance-Client', 'web')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  let response: Response
  try { response = await fetch(`${base}/api${path}`, { ...options, headers, credentials: 'include' }) }
  catch { throw new Error('Cannot reach the API. Check your connection and try again.') }
  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await restoreSession()) return api<T>(path, options, false)
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    const details = error.errors ? Object.values(error.errors).flat().join(' ') : null
    throw new Error(details || error.title || (response.status === 429 ? 'Too many requests. Please wait a minute.' : 'The request could not be completed.'))
  }
  return response.status === 204 ? undefined as T : response.json()
}

export function save<T>(path: string, body: unknown, method = 'POST') {
  return api<T>(path, { method, body: JSON.stringify(body) })
}

export async function downloadFile(path: string, filename: string) {
  const request = () => {
    const headers = new Headers({ 'X-Finance-Client': 'web' })
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(`${base}/api${path}`, { headers, credentials: 'include' })
  }
  let response = await request()
  if (response.status === 401 && await restoreSession()) response = await request()
  if (!response.ok) throw new Error('Export failed. Please try again.')
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}