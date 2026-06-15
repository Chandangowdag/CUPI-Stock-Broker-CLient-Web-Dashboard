import React, { useEffect, useRef, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import Navbar from '../components/Navbar'
import StockCard from '../components/StockCard'
import StockList from '../components/StockList'
import PortfolioPanel from '../components/PortfolioPanel'
import { updateSubscriptions, executeTrade, fetchPortfolio } from '../services/api'
import { StockWebSocket } from '../services/websocket'
import { useAuth } from '../context/AuthContext'

const HISTORY_DEPTH = 60   // keep last 60 ticks per symbol for sparklines

export default function Dashboard({ onLogout }) {
  const { user, token, updateBalance, updateSubscriptions: ctxUpdateSubs } = useAuth()

  const [connected, setConnected] = useState(false)
  const [subscriptions, setSubscriptions] = useState(user?.subscriptions || [])
  const [prices, setPrices] = useState({})        // symbol -> { price, change, timestamp, seq }
  const [history, setHistory] = useState({})      // symbol -> [{price, timestamp}]  rolling buffer
  const [portfolio, setPortfolio] = useState({})  // symbol -> shares owned
  const [subLoading, setSubLoading] = useState(false)
  const [portfolioRefresh, setPortfolioRefresh] = useState(0)
  const wsRef = useRef(null)

  // ── Load initial portfolio holdings ──────────────────────────────────────
  useEffect(() => {
    if (!token) return
    fetchPortfolio(token)
      .then(data => {
        const map = {}
        for (const h of data.holdings || []) map[h.symbol] = h.shares
        setPortfolio(map)
      })
      .catch(() => {})
  }, [token, portfolioRefresh])

  // ── WebSocket setup ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return
    const ws = new StockWebSocket(token, {
      onConnect: () => {
        setConnected(true)
        toast.success('Live feed connected', { id: 'ws', duration: 2000 })
      },
      onDisconnect: () => {
        setConnected(false)
        toast.error('Feed offline — reconnecting…', { id: 'ws', duration: 3000 })
      },
      onMessage: (msg) => {
        const ticks = msg.data
        if (!ticks?.length) return

        if (msg.type === 'price_update' || msg.type === 'snapshot' || msg.type === 'catchup_data') {
          setPrices(prev => {
            const next = { ...prev }
            for (const t of ticks) next[t.symbol] = t
            return next
          })
          // Append to history ring buffer
          setHistory(prev => {
            const next = { ...prev }
            for (const t of ticks) {
              const buf = [...(next[t.symbol] || []), { price: t.price, timestamp: t.timestamp }]
              next[t.symbol] = buf.slice(-HISTORY_DEPTH)
            }
            return next
          })
        }
      },
    })
    wsRef.current = ws
    ws.connect()
    return () => ws.disconnect()
  }, [token])

  // ── Subscription change ───────────────────────────────────────────────────
  const handleSubscribe = useCallback(async (selected) => {
    setSubLoading(true)
    try {
      const data = await updateSubscriptions(selected, token)
      setSubscriptions(data.subscriptions)
      ctxUpdateSubs(data.subscriptions)
      // Clear prices/history for unsubscribed stocks
      setPrices(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => data.subscriptions.includes(k))))
      setHistory(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => data.subscriptions.includes(k))))
      toast.success(
        data.subscriptions.length > 0
          ? `Watching: ${data.subscriptions.join(', ')}`
          : 'Watchlist cleared',
        { id: 'sub' }
      )
    } catch (err) {
      toast.error(err.message || 'Subscription update failed')
    } finally {
      setSubLoading(false)
    }
  }, [token, ctxUpdateSubs])

  // ── Trade execution ───────────────────────────────────────────────────────
  const handleTrade = useCallback(async (symbol, action, shares) => {
    try {
      const result = await executeTrade(symbol, action, shares, token)
      updateBalance(result.new_balance)
      setPortfolioRefresh(n => n + 1)  // re-fetch holdings
      toast.success(
        `${action === 'buy' ? 'Bought' : 'Sold'} ${shares} ${symbol} @ $${result.price_at.toFixed(2)}`,
        { duration: 3000 }
      )
    } catch (err) {
      toast.error(err.message)
      throw err   // re-throw so StockCard resets loading state
    }
  }, [token, updateBalance])

  const lastUpdated = Object.values(prices)
    .map(p => p.timestamp)
    .filter(Boolean)
    .sort()
    .at(-1)

  return (
    <div className="min-h-dvh bg-surface-0 flex flex-col">
      <Navbar connected={connected} onLogout={onLogout} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        <div className="flex flex-col xl:flex-row gap-6">

          {/* ── Left sidebar ─────────────────────────────────────────────── */}
          <aside className="xl:w-64 shrink-0 space-y-4">
            <StockList
              currentSubscriptions={subscriptions}
              onSubscribe={handleSubscribe}
              loading={subLoading}
            />

            {/* Session stats */}
            <div className="glass rounded-xl p-4 space-y-2.5 text-xs font-mono">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Session</p>
              <div className="space-y-2">
                <Row label="Watching" value={`${subscriptions.length} stocks`} />
                <Row
                  label="Feed"
                  value={connected ? '● 1s interval' : '○ offline'}
                  valueClass={connected ? 'text-accent-green' : 'text-red-400'}
                />
                {lastUpdated && (
                  <Row label="Updated" value={new Date(lastUpdated).toLocaleTimeString()} />
                )}
              </div>
            </div>
          </aside>

          {/* ── Centre: live stock cards ──────────────────────────────────── */}
          <section className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-base font-semibold text-slate-200">Live Dashboard</h1>
              {connected && subscriptions.length > 0 && (
                <span className="text-[11px] font-mono text-slate-500 animate-pulse">● streaming</span>
              )}
            </div>

            {subscriptions.length === 0 && (
              <div className="glass rounded-xl p-12 text-center">
                <div className="text-3xl mb-3">📊</div>
                <p className="text-slate-400 text-sm font-medium">No stocks selected</p>
                <p className="text-slate-600 text-xs mt-1">Pick stocks from the watchlist to start your live feed.</p>
              </div>
            )}

            {subscriptions.length > 0 && Object.keys(prices).length === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {subscriptions.map(s => (
                  <div key={s} className="glass rounded-xl p-4 animate-pulse h-40">
                    <div className="h-4 bg-surface-3 rounded w-16 mb-2" />
                    <div className="h-7 bg-surface-3 rounded w-24" />
                  </div>
                ))}
              </div>
            )}

            {Object.keys(prices).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                {subscriptions.map(symbol => {
                  const data = prices[symbol]
                  return (
                    <StockCard
                      key={symbol}
                      symbol={symbol}
                      price={data?.price}
                      change={data?.change ?? 0}
                      timestamp={data?.timestamp}
                      history={history[symbol] || []}
                      onTrade={(action, shares) => handleTrade(symbol, action, shares)}
                      userShares={portfolio[symbol] ?? 0}
                    />
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Right sidebar: portfolio ──────────────────────────────────── */}
          <aside className="xl:w-72 shrink-0">
            <PortfolioPanel prices={prices} />
          </aside>
        </div>
      </main>
    </div>
  )
}

function Row({ label, value, valueClass = 'text-slate-300' }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  )
}
