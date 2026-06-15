import React, { useState } from 'react'

const SUPPORTED_STOCKS = ['GOOG', 'TSLA', 'AMZN', 'META', 'NVDA']

const STOCK_META = {
  GOOG: { name: 'Alphabet',  sector: 'Tech' },
  TSLA: { name: 'Tesla',     sector: 'Auto/EV' },
  AMZN: { name: 'Amazon',    sector: 'E-Commerce' },
  META: { name: 'Meta',      sector: 'Social' },
  NVDA: { name: 'NVIDIA',    sector: 'Semiconductors' },
}

export default function StockList({ currentSubscriptions, onSubscribe, loading }) {
  const [selected, setSelected] = useState(new Set(currentSubscriptions))
  const [dirty, setDirty] = useState(false)

  const toggle = (symbol) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(symbol) ? next.delete(symbol) : next.add(symbol)
      return next
    })
    setDirty(true)
  }

  const handleSave = () => {
    onSubscribe([...selected])
    setDirty(false)
  }

  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-widest">
          Watchlist
        </h2>
        <span className="text-[10px] text-slate-600 font-mono">{selected.size}/{SUPPORTED_STOCKS.length}</span>
      </div>

      <div className="space-y-1">
        {SUPPORTED_STOCKS.map(symbol => {
          const meta = STOCK_META[symbol]
          const isChecked = selected.has(symbol)
          return (
            <label
              key={symbol}
              className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all select-none
                ${isChecked
                  ? 'bg-accent-cyan/10 border border-accent-cyan/25'
                  : 'border border-transparent hover:bg-surface-3'}`}
            >
              <div
                onClick={() => toggle(symbol)}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all
                  ${isChecked ? 'bg-accent-cyan border-accent-cyan' : 'border-slate-600'}`}
              >
                {isChecked && (
                  <svg className="w-2.5 h-2.5 text-surface-0" fill="none" viewBox="0 0 10 8">
                    <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0" onClick={() => toggle(symbol)}>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-sm text-slate-200">{symbol}</span>
                  <span className="text-[10px] text-slate-600 font-mono">{meta.sector}</span>
                </div>
                <p className="text-xs text-slate-500 truncate">{meta.name}</p>
              </div>
            </label>
          )
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={loading || !dirty}
        className={`w-full py-2.5 rounded-lg text-xs font-semibold font-mono transition-all
          ${dirty && !loading
            ? 'bg-accent-cyan/20 border border-accent-cyan/50 text-accent-cyan hover:bg-accent-cyan/30'
            : 'bg-surface-3 border border-border text-slate-600 cursor-not-allowed'}`}
      >
        {loading ? 'Updating...' : dirty ? 'Apply Watchlist' : 'Up to Date'}
      </button>
    </div>
  )
}
