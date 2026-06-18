import React, { createContext, useContext, useEffect, useState } from 'react'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)

  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')

    if (savedToken) setToken(savedToken)
    if (savedUser) setUser(JSON.parse(savedUser))
  }, [])

  const login = (accessToken, userData) => {
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
    setUser(prev => ({ ...prev, balance }))
  }

  const updateSubscriptions = (subscriptions) => {
    setUser(prev => ({ ...prev, subscriptions }))
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

export const useAuth = () => useContext(AuthContext)