# TradePulse v2 — Stock Broker Dashboard

A production-ready real-time stock trading dashboard.

## What's New in v2

| Feature | v1 | v2 |
|---|---|---|
| Data persistence | ❌ In-memory only | ✅ SQLite (swap to PostgreSQL) |
| Authentication | ❌ Email string only | ✅ JWT + bcrypt passwords |
| WebSocket broadcast | ❌ Sequential per-user loop | ✅ Per-symbol fan-out with asyncio.gather |
| Missed messages | ❌ None | ✅ Sequence IDs + catchup on reconnect |
| Price history | ❌ None | ✅ 60-tick sparkline charts (recharts) |
| Portfolio | ❌ Watch only | ✅ Buy/Sell with $10,000 virtual balance |
| Session persistence | ❌ Lost on refresh | ✅ JWT in localStorage |

---

## Project Structure

```
tradepulse-v2/
│
├── backend/
│   ├── main.py                # FastAPI app, all endpoints, WS handler, broadcast loop
│   ├── auth.py                # bcrypt hashing + JWT create/verify/dependency
│   ├── database.py            # SQLAlchemy async engine + session factory
│   ├── models.py              # ORM tables + Pydantic request/response schemas
│   ├── stock_engine.py        # Price simulation, ring buffer, sequence IDs
│   ├── websocket_manager.py   # Per-symbol pub/sub WS manager
│   ├── portfolio_service.py   # Buy/sell execution, holdings, transaction log
│   └── requirements.txt
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── package.json
    └── src/
        ├── App.jsx
        ├── index.css
        ├── main.jsx
        ├── context/
        │   └── AuthContext.jsx    # JWT storage, global auth state
        ├── pages/
        │   ├── Login.jsx          # Login + Register tabs
        │   └── Dashboard.jsx      # Main real-time dashboard
        ├── components/
        │   ├── Navbar.jsx         # Header with live balance + connection status
        │   ├── StockCard.jsx      # Price card + recharts sparkline + trade panel
        │   ├── StockList.jsx      # Watchlist subscription selector
        │   └── PortfolioPanel.jsx # Holdings, balance, transaction history
        └── services/
            ├── api.js             # All REST calls with Bearer auth
            └── websocket.js       # WS client with sequence-based catchup
```

---

## Quick Start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# API running at http://localhost:8000
# SQLite DB auto-created at ./tradepulse.db
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# App running at http://localhost:5173
```

Open multiple browser tabs, register different users, pick different stocks — each dashboard streams independently with no cross-talk.

---

## API Reference

### Auth

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/auth/register` | `{email, password}` | Create account, returns JWT |
| POST | `/auth/login` | `{email, password}` | Login, returns JWT |
| GET | `/auth/me` | — | Get current user profile |

### Stocks

| Method | Endpoint | Description |
|---|---|---|
| GET | `/stocks` | List all stocks + current prices |
| GET | `/stocks/{symbol}/history?limit=60` | Sparkline history |

### Subscriptions

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/subscribe` | `{stocks: [...]}` | Replace watchlist |

### Portfolio

| Method | Endpoint | Body | Description |
|---|---|---|---|
| GET | `/portfolio` | — | Holdings + cash balance |
| POST | `/trade` | `{symbol, action, shares}` | Execute buy/sell |
| GET | `/transactions` | — | Last 50 trades |

### WebSocket

```
WS /ws?token=<jwt>
```

**Server → Client messages:**

```jsonc
// Initial snapshot on connect
{ "type": "snapshot",   "data": [{symbol, price, change, seq, timestamp}] }

// Every-second price updates
{ "type": "price_update", "data": [{symbol, price, change, seq, timestamp}] }

// Missed ticks after reconnect
{ "type": "catchup_data","data": [{symbol, price, change, seq, timestamp}] }
```

**Client → Server messages:**

```
ping                                        → server replies {"type":"pong"}
{"type":"catchup","seq":{"GOOG":42,...}}   → server sends missed ticks
```

---

## Production Checklist

- [ ] Set `JWT_SECRET` env var to a long random string
- [ ] Set `DATABASE_URL` to `postgresql+asyncpg://user:pass@host/db`
- [ ] Change `allow_origins=["*"]` in CORS to your frontend domain
- [ ] Run behind HTTPS (WSS for WebSocket)
- [ ] Use `uvicorn main:app --workers 4` (or gunicorn) for multi-worker
- [ ] Add Redis pub/sub to replace in-memory WS manager for multi-worker setups
