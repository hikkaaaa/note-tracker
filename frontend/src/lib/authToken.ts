// Stores the JWT returned by the backend so the app can authenticate requests
// once the session/middleware step lands. Kept in localStorage so it survives
// reloads. The user blob is the safe public fields (no password) for greeting UI.
const tokenKey = 'note-tracker.auth-token'
const userKey = 'note-tracker.auth-user'

export interface AuthUser {
  id: number
  nickname: string
  email: string
}

export function saveAuth(token: string, user: AuthUser) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(tokenKey, token)
  window.localStorage.setItem(userKey, JSON.stringify(user))
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(tokenKey)
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(userKey)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function clearAuth() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(tokenKey)
  window.localStorage.removeItem(userKey)
}

// Stable per-user prefix for browser-local caches (e.g. the note editor's offline
// section buffer), so two accounts on the same browser can't read each other's cached
// content. Falls back to 'anon' when logged out.
export function currentUserScope(): string {
  return `u${getAuthUser()?.id ?? 'anon'}`
}
