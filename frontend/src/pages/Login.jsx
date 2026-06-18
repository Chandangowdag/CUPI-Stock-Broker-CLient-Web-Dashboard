import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { registerUser, loginUser } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()

  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    const em = email.trim().toLowerCase()

    if (!em.includes('@')) {
      return toast.error('Enter a valid email.')
    }

    if (password.length < 6) {
      return toast.error('Password must be at least 6 characters.')
    }

    setLoading(true)

    try {
      const data =
        tab === 'register'
          ? await registerUser(em, password)
          : await loginUser(em, password)

      console.log('LOGIN RESPONSE:', data)

      toast.success(
        tab === 'register'
          ? 'Account created! Welcome 🎉'
          : 'Welcome back!'
      )

      login(data.access_token, {
        email: data.email,
        balance: data.balance,
        subscriptions: data.subscriptions,
      })

      console.log(
        'TOKEN AFTER LOGIN:',
        localStorage.getItem('token')
      )

      console.log(
        'USER AFTER LOGIN:',
        localStorage.getItem('user')
      )
    } catch (err) {
      console.error('LOGIN ERROR:', err)
      toast.error(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4 bg-surface-0">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-accent-cyan/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-[300px] h-[300px] bg-accent-green/3 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm space-y-5 relative">
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl border border-accent-cyan/30 bg-accent-cyan/10 mb-2">
            <span className="text-accent-cyan font-mono font-bold text-xl">
              TP
            </span>
          </div>

          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            TradePulse
          </h1>

          <p className="text-sm text-slate-500">
            Real-time stock dashboard with virtual trading.
          </p>
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <div className="flex border-b border-border">
            {['login', 'register'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-xs font-mono font-semibold uppercase tracking-widest transition-colors
                  ${
                    tab === t
                      ? 'text-accent-cyan border-b-2 border-accent-cyan bg-accent-cyan/5'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
              >
                {t === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-[10px] font-mono font-medium text-slate-400 mb-1.5 uppercase tracking-widest">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                required
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2.5 text-sm
                  text-slate-100 placeholder-slate-600 font-mono
                  focus:outline-none focus:border-accent-cyan/60 focus:ring-1 focus:ring-accent-cyan/20
                  transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-medium text-slate-400 mb-1.5 uppercase tracking-widest">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="min 6 characters"
                required
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2.5 text-sm
                  text-slate-100 placeholder-slate-600 font-mono
                  focus:outline-none focus:border-accent-cyan/60 focus:ring-1 focus:ring-accent-cyan/20
                  transition-all"
              />
            </div>

            {tab === 'register' && (
              <div className="glass rounded-lg p-3 text-xs text-slate-400 font-mono space-y-0.5">
                <p>
                  🎁 New accounts start with{' '}
                  <span className="text-accent-gold font-semibold">
                    $10,000
                  </span>{' '}
                  virtual balance
                </p>
                <p>📈 Trade GOOG, TSLA, AMZN, META, NVDA</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-accent-cyan/20 border border-accent-cyan/50
                text-accent-cyan font-mono font-semibold text-sm
                hover:bg-accent-cyan/30 active:scale-[0.98]
                disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading
                ? '...'
                : tab === 'login'
                ? 'Sign In →'
                : 'Create Account →'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-600 font-mono">
          Demo: use any email + password ≥ 6 chars
        </p>
      </div>
    </div>
  )
}