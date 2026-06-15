import React, { useEffect, useRef, useState, useCallback } from 'react'
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'

const STOCK_META = {
  GOOG: { name: 'Alphabet',  color: '#4285F4' },
  TSLA: { name: 'Tesla',     color: '#E31937' },
  AMZN: { name: 'Amazon',    color: '#FF9900' },
  META: { name: 'Meta',      color: '#0081FB' },
  NVDA: { name: 'NVIDIA',    color: '#76B900' },
}

/**
 * StockCard — shows live price, sparkline chart, and buy/sell controls.
 *
 * Props:
 *   symbol        — stock symbol string
 *   price         — current price (number)
 *   change        — price delta since last tick
 *   timestamp     — ISO string of last update
 *   history       — array of {price, timestamp} for sparkline
 *   onTrade(action, shares) — called when user submits a trade
 *   userShares    — how many shares this user owns
 */
export default function StockCard({ symbol, price, change, timestamp, history, onTrade, userShares }) {
  const [flashClass, setFlashClass] = useState('')
  const [showTrade, setShowTrade] = useState(false)
  const [shares, setShares] = useState('1')
  const [tradeLoading, setTradeLoading] = useState(false)
  const prevPrice = useRef(price)

  // Flash animation on price change
  useEffect(() => {
    if (price === undefined || price === prevPrice.current) return
    setFlashClass(price > prevPrice.current ? 'flash-up' : 'flash-down')
    prevPrice.current = price
    const t = setTimeout(() => setFlashClass(''), 500)
    return () => clearTimeout(t)
  }, [price])

  const handleTrade = useCallback(async (action) => {
    const qty = parseFloat(shares)
    if (!qty || qty <= 0) return
    setTradeLoading(true)
    try {
      await onTrade(action, qty)
      setShowTrade(false)
      setShares('1')
    } finally {
      setTradeLoading(false)
    }
  }, [shares, onTrade])

  const meta = STOCK_META[symbol] || { name: symbol, color: '#94a3b8' }
  const isUp = change > 0
  const isDown = change < 0
  const chartColor = isDown ? '#ff4466' : '#00ff88'

  const chartData = (history || []).map(h => ({ price: h.price }))

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString('en-US', { hour12: true })
    : '—'

  const tradeValue = price && shares ? (parseFloat(shares) * price).toFixed(2) : '—'

  return (
    <div className={`relative overflow-hidden rounded-xl border border-border bg-surface-2 transition-all duration-150 ${flashClass}`}>
      {/* Brand color bar */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ backgroundColor: meta.color }} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-lg text-slate-100">{symbol}</span>
              {isUp && (
                <span className="price-up text-xs font-mono font-semibold flex items-center gap-0.5">
                  ▲ +{change.toFixed(2)}
                </span>
              )}
              {isDown && (
                <span className="price-down text-xs font-mono font-semibold flex items-center gap-0.5">
                  ▼ {change.toFixed(2)}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{meta.name}</p>
          </div>

          <div className="text-right">
            <div className={`font-mono font-bold text-xl tabular-nums ${isUp ? 'price-up' : isDown ? 'price-down' : 'text-slate-200'}`}>
              ${price !== undefined ? price.toFixed(2) : '—'}
            </div>
            <div className="text-[10px] text-slate-600 font-mono mt-0.5">{formattedTime}</div>
          </div>
        </div>

        {/* Sparkline — real recharts AreaChart */}
        {chartData.length > 1 && (
          <div className="h-14 -mx-1 mb-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={chartColor}
                  strokeWidth={1.5}
                  fill={`url(#grad-${symbol})`}
                  dot={false}
                  isAnimationActive={false}
                />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="bg-surface-3 border border-border rounded px-2 py-1 text-[10px] font-mono text-slate-300">
                        ${payload[0].value?.toFixed(2)}
                      </div>
                    ) : null
                  }
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Holdings + trade toggle */}
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-mono text-slate-500">
            {userShares > 0
              ? <span>Holding <span className="text-slate-300">{userShares.toFixed(4)}</span> shares</span>
              : <span className="text-slate-600">No position</span>
            }
          </div>
          <button
            onClick={() => setShowTrade(v => !v)}
            className={`text-[11px] font-mono font-semibold px-2.5 py-1 rounded-md transition-all
              ${showTrade
                ? 'bg-surface-3 text-slate-400'
                : 'bg-accent-cyan/15 border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/25'}`}
          >
            {showTrade ? 'Cancel' : 'Trade'}
          </button>
        </div>

        {/* Trade panel */}
        {showTrade && (
          <div className="mt-3 pt-3 border-t border-border space-y-2.5 animate-fade-in">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-mono text-slate-500 shrink-0">Shares</label>
              <input
                type="number"
                min="0.0001"
                step="0.01"
                value={shares}
                onChange={e => setShares(e.target.value)}
                className="flex-1 bg-surface-3 border border-border rounded px-2 py-1.5 text-xs
                  font-mono text-slate-100 focus:outline-none focus:border-accent-cyan/50 text-right"
              />
              <span className="text-[10px] font-mono text-slate-500 shrink-0">
                ≈ ${tradeValue}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleTrade('buy')}
                disabled={tradeLoading}
                className="flex-1 py-1.5 rounded-md bg-accent-green/15 border border-accent-green/30
                  text-accent-green text-xs font-mono font-semibold hover:bg-accent-green/25 transition-all
                  disabled:opacity-50"
              >
                {tradeLoading ? '...' : 'Buy'}
              </button>
              <button
                onClick={() => handleTrade('sell')}
                disabled={tradeLoading || !userShares}
                className="flex-1 py-1.5 rounded-md bg-red-500/15 border border-red-500/30
                  text-red-400 text-xs font-mono font-semibold hover:bg-red-500/25 transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {tradeLoading ? '...' : 'Sell'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
