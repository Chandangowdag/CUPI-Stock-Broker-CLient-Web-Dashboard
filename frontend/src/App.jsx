import React from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

function AppInner() {
  const { user, logout } = useAuth()

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e2737',
            color: '#e2e8f0',
            border: '1px solid #1e2d45',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '12px',
          },
          success: { iconTheme: { primary: '#00ff88', secondary: '#0a0d12' } },
          error:   { iconTheme: { primary: '#ff4466', secondary: '#0a0d12' } },
        }}
      />
      {user ? <Dashboard onLogout={logout} /> : <Login />}
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
