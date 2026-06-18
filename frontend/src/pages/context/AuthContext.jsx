/**
 * AuthContext — global auth state management.
 *
 * Stores JWT in localStorage so the session persists across page refreshes.
 * Exposes: { user, token, login, logout, updateBalance }
 * user = { email, balance, subscriptions }
 */

import React, { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

const TOKEN_KEY = 'tp_token'
const USER_KEY  = 'tp_user'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser]   = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  const login = useCallback((tokenValue, userData) => {
    localStorage.setItem(TOKEN_KEY, tokenValue)
    localStorage.setItem(USER_KEY, JSON.stringify(userData))
    setToken(tokenValue)
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  /** Called after a trade to reflect the new balance without a full re-fetch */
  const updateBalance = useCallback((newBalance) => {
    setUser(prev => {
      if (!prev) return prev
      const next = { ...prev, balance: newBalance }
      localStorage.setItem(USER_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  /** Called after subscription change */
  const updateSubscriptions = useCallback((subs) => {
    setUser(prev => {
      if (!prev) return prev
      const next = { ...prev, subscriptions: subs }
      localStorage.setItem(USER_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateBalance, updateSubscriptions }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
