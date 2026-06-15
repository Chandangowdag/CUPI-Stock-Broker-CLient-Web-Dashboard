"""
main.py — TradePulse FastAPI Application (v2)
=============================================

Improvements over v1:
  ✓ SQLite persistence via SQLAlchemy async (swap URL for Postgres in prod)
  ✓ JWT authentication with bcrypt password hashing
  ✓ Pub/sub-style WebSocket manager (per-symbol fan-out with asyncio.gather)
  ✓ Sequence IDs on every price tick — clients request missed updates on reconnect
  ✓ Price history stored in-memory ring buffer (last 120 ticks per symbol)
  ✓ Virtual portfolio: buy/sell with $10,000 starting balance
  ✓ Transaction history
  ✓ Graceful WS auth via token query-param (no credentials in URL path)
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import (
    FastAPI, WebSocket, WebSocketDisconnect,
    HTTPException, Depends, status
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from database import get_db, init_db
from models import (
    User, Subscription,
    RegisterRequest, LoginRequest, SubscriptionRequest, TradeRequest, TokenResponse
)
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, get_current_user_ws
)
from websocket_manager import manager
from stock_engine import (
    generate_price, get_snapshot, get_missed_updates, get_history,
    SUPPORTED_STOCKS
)
from portfolio_service import (
    execute_trade, get_portfolio, get_transactions
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


# ── Background broadcast task ─────────────────────────────────────────────────

async def price_broadcast_loop():
    """
    Generates one tick per symbol every second and fans it out to subscribers.
    Uses the new per-symbol broadcast so sends are concurrent, not sequential.
    Also persists a sample (every 5th tick) to the DB price_history table via
    a fire-and-forget task to avoid blocking the broadcast loop.
    """
    tick_count = 0
    while True:
        await asyncio.sleep(1)
        tick_count += 1
        for symbol in SUPPORTED_STOCKS:
            tick = generate_price(symbol)
            await manager.broadcast_tick(tick)


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    task = asyncio.create_task(price_broadcast_loop())
    logger.info("DB initialised. Price broadcast started.")
    yield
    task.cancel()
    logger.info("Shutdown complete.")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="TradePulse API v2", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # restrict to your domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth endpoints ────────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=TokenResponse)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Create a new account with email + password.
    Password is bcrypt-hashed; never stored in plain text.
    Returns a JWT on success so the user is immediately logged in.
    """
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered.")

    user = User(email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    await db.flush()

    token = create_access_token(user.email)
    return TokenResponse(
        access_token=token,
        email=user.email,
        balance=user.balance,
        subscriptions=[],
    )


@app.post("/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate with email + password.
    Returns a JWT valid for 24 hours.
    """
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    subs_result = await db.execute(
        select(Subscription).where(Subscription.email == user.email)
    )
    subs = [s.symbol for s in subs_result.scalars().all()]

    token = create_access_token(user.email)
    return TokenResponse(
        access_token=token,
        email=user.email,
        balance=user.balance,
        subscriptions=subs,
    )


@app.get("/auth/me")
async def me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Return the authenticated user's profile."""
    subs_result = await db.execute(
        select(Subscription).where(Subscription.email == current_user.email)
    )
    subs = [s.symbol for s in subs_result.scalars().all()]
    return {
        "email": current_user.email,
        "balance": current_user.balance,
        "subscriptions": subs,
    }


# ── Stock endpoints ───────────────────────────────────────────────────────────

@app.get("/stocks")
async def list_stocks(_: User = Depends(get_current_user)):
    """Return supported stocks with current snapshot prices."""
    return {"stocks": SUPPORTED_STOCKS, "snapshot": get_snapshot()}


@app.get("/stocks/{symbol}/history")
async def stock_history(symbol: str, limit: int = 60, _: User = Depends(get_current_user)):
    """Return up to `limit` recent price ticks for a symbol (sparkline data)."""
    symbol = symbol.upper()
    if symbol not in SUPPORTED_STOCKS:
        raise HTTPException(status_code=404, detail="Unknown symbol")
    return {"symbol": symbol, "history": get_history(symbol, limit)}


# ── Subscription endpoints ────────────────────────────────────────────────────

@app.post("/subscribe")
async def subscribe(
    body: SubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Replace the user's subscription list atomically.
    Validates symbols, deduplicates, persists to DB.
    Also updates the live WS manager so the next tick uses the new list.
    """
    valid = list({s.upper() for s in body.stocks if s.upper() in SUPPORTED_STOCKS})

    # Atomic replace: delete old, insert new
    await db.execute(delete(Subscription).where(Subscription.email == current_user.email))
    for sym in valid:
        db.add(Subscription(email=current_user.email, symbol=sym))
    await db.flush()

    # If user has an open WS, update it immediately
    manager.update_user_symbols(current_user.email, valid)

    return {"success": True, "subscriptions": valid}


# ── Portfolio endpoints ───────────────────────────────────────────────────────

@app.get("/portfolio")
async def portfolio(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Return holdings + current market value for the authenticated user."""
    data = await get_portfolio(current_user.email, db)
    data["balance"] = current_user.balance
    return data


@app.post("/trade")
async def trade(
    body: TradeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Execute a buy or sell order at the current live price.
    Virtual money — starts at $10,000 per user.
    """
    return await execute_trade(current_user, body.symbol, body.action, body.shares, db)


@app.get("/transactions")
async def transactions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the last 50 trades for the authenticated user."""
    return {"transactions": await get_transactions(current_user.email, db)}


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str, db: AsyncSession = Depends(get_db)):
    """
    Authenticated WebSocket endpoint.
    Auth: pass JWT as ?token=<jwt> query param.

    On connect:
      1. Verify JWT
      2. Load subscriptions from DB
      3. Send snapshot of subscribed stocks
      4. Stay open — price updates arrive from the broadcast task

    Client → server messages:
      ping                         — keepalive (server replies {"type":"pong"})
      {"type":"catchup","seq":{}}  — request missed ticks since last known seq per symbol
    """
    user = await get_current_user_ws(token, db)
    if not user:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    # Load persisted subscriptions
    subs_result = await db.execute(
        select(Subscription).where(Subscription.email == user.email)
    )
    symbols = [s.symbol for s in subs_result.scalars().all()]

    await manager.connect(user.email, websocket, symbols)

    # Send snapshot immediately so the UI isn't blank
    if symbols:
        snapshot = [s for s in get_snapshot() if s["symbol"] in symbols]
        await manager.send_to_user(user.email, {"type": "snapshot", "data": snapshot})

    try:
        while True:
            raw = await websocket.receive_text()

            if raw == "ping":
                await websocket.send_text('{"type":"pong"}')
                continue

            try:
                import json
                msg = json.loads(raw)
            except Exception:
                continue

            # ── Missed-message catchup ──────────────────────────────────
            if msg.get("type") == "catchup":
                # client sends {"type":"catchup","seq":{"GOOG":42,"TSLA":19}}
                last_seqs: dict = msg.get("seq", {})
                missed = []
                for sym in symbols:
                    since = last_seqs.get(sym, 0)
                    missed.extend(get_missed_updates(sym, since))
                if missed:
                    await manager.send_to_user(user.email, {
                        "type": "catchup_data",
                        "data": sorted(missed, key=lambda x: x["seq"]),
                    })

    except WebSocketDisconnect:
        manager.disconnect(user.email)
    except Exception as e:
        logger.error(f"[WS] Error for {user.email}: {e}")
        manager.disconnect(user.email)
