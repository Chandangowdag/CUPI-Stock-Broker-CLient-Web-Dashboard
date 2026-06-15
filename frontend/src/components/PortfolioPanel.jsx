import React, { useState, useEffect } from 'react'
import { fetchPortfolio, fetchTransactions } from '../services/api'
import { useAuth } from '../context/AuthContext'

/**
 * PortfolioPanel — shows:
 *  - Cash balance
 *  - Holdings with current market value
 *  - Recent transaction history
 */
export default function PortfolioPanel({ prices }) {
  const { user, token } = useAuth()
  const [portfolio, setPortfolio] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [tab, setTab] = useState('holdings')  // 'holdings' | 'history'
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    Promise.all([fetchPortfolio(token), fetchTransactions(token)])
      .then(([port, tx]) => {
        setPortfolio(port)
        setTransactions(tx.transactions || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  // Refresh portfolio data when a new price comes in
  useEffect(() => {
    if (!token || !portfolio) return
    const interval = setInterval(async () => {
      try {
        const port = await fetchPortfolio(token)
        setPortfolio(port)
      } catch {}
    }, 5000)  // refresh holdings every 5s
    return () => clearInterval(interval)
  }, [token, portfolio])

  const balance = user?.balance ?? portfolio?.balance ?? 0
  const totalMV = portfolio?.total_market_value ?? 0
  const netWorth = balance + totalMV

  if (loading) {
    return (
      <div className="glass rounded-xl p-4 animate-pulse space-y-2">
        <div className="h-3 bg-surface-3 rounded w-24" />
        <div className="h-8 bg-surface-3 rounded w-32" />
      </div>
    )
  }

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Balance summary */}
      <div className="p-4 border-b border-border">
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Portfolio Value</p>
        <div className="font-mono font-bold text-2xl text-slate-100">
          ${netWorth.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div className="flex gap-4 mt-2 text-xs font-mono">
          <div>
            <span className="text-slate-500">Cash</span>
            <span className="text-accent-gold ml-1.5">${balance.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-500">Stocks</span>
            <span className="text-slate-300 ml-1.5">${totalMV.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border text-[10px] font-mono uppercase tracking-widest">
        {['holdings', 'history'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 transition-colors
              ${tab === t ? 'text-accent-cyan border-b border-accent-cyan' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Holdings */}
      {tab === 'holdings' && (
        <div className="divide-y divide-border">
          {(!portfolio?.holdings || portfolio.holdings.length === 0) ? (
            <p className="text-xs text-slate-600 font-mono p-4 text-center">No positions yet. Start trading!</p>
          ) : (
            portfolio.holdings.map(h => {
              const livePrice = prices[h.symbol]?.price ?? h.current_price
              const liveValue = (h.shares * livePrice).toFixed(2)
              return (
                <div key={h.symbol} className="flex items-center justify-between px-4 py-2.5 text-xs font-mono">
                  <div>
                    <span className="text-slate-200 font-semibold">{h.symbol}</span>
                    <span className="text-slate-500 ml-2">{h.shares.toFixed(4)} sh</span>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-200">${liveValue}</div>
                    <div className="text-slate-500">${livePrice.toFixed(2)}/sh</div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Transaction history */}
      {tab === 'history' && (
        <div className="divide-y divide-border max-h-64 overflow-y-auto">
          {transactions.length === 0 ? (
            <p className="text-xs text-slate-600 font-mono p-4 text-center">No trades yet.</p>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-2.5 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase
                    ${tx.action === 'buy' ? 'bg-accent-green/15 text-accent-green' : 'bg-red-500/15 text-red-400'}`}>
                    {tx.action}
                  </span>
                  <span className="text-slate-200">{tx.symbol}</span>
                  <span className="text-slate-500">{tx.shares}sh</span>
                </div>
                <div className="text-right">
                  <div className="text-slate-300">${tx.total.toFixed(2)}</div>
                  <div className="text-slate-600 text-[10px]">@${tx.price_at.toFixed(2)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
