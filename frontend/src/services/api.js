/**
 * api.js — All REST API calls to the FastAPI backend.
 * Automatically attaches the Authorization: Bearer <token> header.
 */

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try { detail = (await res.json()).detail || detail } catch {}
    throw new Error(detail)
  }
  return res.json()
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const registerUser  = (email, password) =>
  request('/auth/register', { method: 'POST', body: { email, password } })

export const loginUser = (email, password) =>
  request('/auth/login', { method: 'POST', body: { email, password } })

export const fetchMe = (token) =>
  request('/auth/me', { token })

// ── Stocks ────────────────────────────────────────────────────────────────────

export const fetchStocks = (token) =>
  request('/stocks', { token })

export const fetchStockHistory = (symbol, token, limit = 60) =>
  request(`/stocks/${symbol}/history?limit=${limit}`, { token })

export const fetchStockCandles = (symbol, token, limit = 50) =>
  request(`/stocks/${symbol}/candles?limit=${limit}`, { token })

// ── Subscriptions ─────────────────────────────────────────────────────────────

export const updateSubscriptions = (stocks, token) =>
  request('/subscribe', { method: 'POST', body: { stocks }, token })

// ── Portfolio ─────────────────────────────────────────────────────────────────

export const fetchPortfolio = (token) =>
  request('/portfolio', { token })

export const executeTrade = (symbol, action, shares, token) =>
  request('/trade', { method: 'POST', body: { symbol, action, shares }, token })

export const fetchTransactions = (token) =>
  request('/transactions', { token })
