import React from 'react'
import { useAuth } from '../context/AuthContext'

export default function Navbar({ connected, onLogout }) {
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-50 glass border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-md bg-accent-cyan/20 border border-accent-cyan/40 flex items-center justify-center">
            <span className="text-accent-cyan text-xs font-mono font-bold">TP</span>
          </div>
          <span className="font-mono font-semibold text-slate-100 tracking-tight hidden sm:block">
            TradePulse
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Virtual balance */}
          {user?.balance !== undefined && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 border border-border">
              <span className="text-[10px] font-mono text-slate-500">CASH</span>
              <span className="text-xs font-mono font-semibold text-accent-gold">
                ${user.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Connection status */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border
            ${connected
              ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
              : 'bg-red-500/10 border-red-500/30 text-red-400'}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-accent-green animate-pulse' : 'bg-red-500'}`} />
            {connected ? 'LIVE' : 'OFFLINE'}
          </div>

          {/* Email */}
          <span className="text-slate-400 text-xs font-mono truncate max-w-[100px] sm:max-w-none hidden md:block">
            {user?.email}
          </span>

          <button
            onClick={onLogout}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors font-mono px-2 py-1 rounded hover:bg-surface-2"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}
