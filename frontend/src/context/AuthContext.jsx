import React, { createContext, useContext, useEffect, useState } from 'react'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)

  // Restore session on page refresh
  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')

    if (savedToken) {
      setToken(savedToken)
    }

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch {
        localStorage.removeItem('user')
      }
    }
  }, [])

  const login = (accessToken, userData) => {
    console.log('LOGIN CALLED', accessToken)

    setToken(accessToken)
    setUser(userData)

    localStorage.setItem('token', accessToken)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  const logout = () => {
    setToken(null)
    setUser(null)

    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  const updateBalance = (balance) => {
    setUser(prev => {
      const updated = { ...prev, balance }
      localStorage.setItem('user', JSON.stringify(updated))
      return updated
    })
  }

  const updateSubscriptions = (subscriptions) => {
    setUser(prev => {
      const updated = { ...prev, subscriptions }
      localStorage.setItem('user', JSON.stringify(updated))
      return updated
    })
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        updateBalance,
        updateSubscriptions,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}