"""
stock_engine.py — Price simulation engine.

Generates realistic random-walk prices with mean reversion.
Maintains a rolling in-memory history buffer (last 120 ticks per symbol)
so clients can request missed updates after reconnection using sequence IDs.
"""

import random
from collections import deque
from datetime import datetime, timezone
from typing import Dict, Deque, List

# ── Constants ─────────────────────────────────────────────────────────────────
SUPPORTED_STOCKS = ["GOOG", "TSLA", "AMZN", "META", "NVDA"]

BASE_PRICES: Dict[str, float] = {
    "GOOG": 175.0,
    "TSLA": 250.0,
    "AMZN": 195.0,
    "META": 520.0,
    "NVDA": 870.0,
}

# Rolling buffer: last 120 ticks per symbol (2 minutes at 1s interval)
HISTORY_DEPTH = 120

# ── State ─────────────────────────────────────────────────────────────────────
current_prices: Dict[str, float] = {s: p for s, p in BASE_PRICES.items()}
sequence: Dict[str, int] = {s: 0 for s in SUPPORTED_STOCKS}

# price_buffer[symbol] = deque of price records, newest last
price_buffer: Dict[str, Deque[dict]] = {
    s: deque(maxlen=HISTORY_DEPTH) for s in SUPPORTED_STOCKS
}

# Current candle state per symbol: {open, high, low, close, count}
candle_accumulator: Dict[str, dict] = {
    s: {"open": None, "high": -float('inf'), "low": float('inf'), "close": 0.0, "count": 0}
    for s in SUPPORTED_STOCKS
}


def generate_price(symbol: str) -> dict:
    """
    Generate next price tick for a symbol.
    Uses ±0.5% random walk with mean reversion at ±15% from base.
    Increments a per-symbol sequence ID for missed-message recovery.
    """
    last = current_prices.get(symbol, BASE_PRICES[symbol])
    change_pct = random.uniform(-0.005, 0.005)
    new_price = round(last * (1 + change_pct), 2)

    # Mean reversion — don't let prices drift too far
    base = BASE_PRICES[symbol]
    if new_price > base * 1.15:
        new_price = round(base * random.uniform(0.995, 1.005), 2)
    elif new_price < base * 0.85:
        new_price = round(base * random.uniform(0.995, 1.005), 2)

    change = round(new_price - last, 2)
    current_prices[symbol] = new_price
    sequence[symbol] += 1

    record = {
        "symbol": symbol,
        "price": new_price,
        "change": change,
        "seq": sequence[symbol],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    price_buffer[symbol].append(record)
    return record


def get_snapshot() -> List[dict]:
    """Return the latest price for all symbols (for initial WS snapshot)."""
    result = []
    for symbol in SUPPORTED_STOCKS:
        result.append({
            "symbol": symbol,
            "price": current_prices[symbol],
            "change": 0.0,
            "seq": sequence[symbol],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    return result


def get_missed_updates(symbol: str, since_seq: int) -> List[dict]:
    """
    Return all buffered ticks for `symbol` after `since_seq`.
    Called when a client reconnects and sends its last known sequence ID.
    If `since_seq` is too old (outside the buffer), returns empty list
    and the client will fall back to the current snapshot.
    """
    buf = price_buffer.get(symbol, deque())
    return [r for r in buf if r["seq"] > since_seq]


def get_history(symbol: str, limit: int = 60) -> List[dict]:
    """Return up to `limit` recent ticks for sparkline rendering."""
    buf = price_buffer.get(symbol, deque())
    items = list(buf)
    return items[-limit:]


def aggregate_candle(symbol: str, tick: dict) -> dict | None:
    """
    Update the current 1-minute candle with a new tick.
    Returns a completed candle dict every 60 ticks, otherwise None.
    """
    price = tick["price"]
    acc = candle_accumulator[symbol]

    if acc["open"] is None:
        acc["open"] = price

    acc["high"] = max(acc["high"], price)
    acc["low"] = min(acc["low"], price)
    acc["close"] = price
    acc["count"] += 1

    # 1-minute candle = 60 ticks at 1s interval
    if acc["count"] >= 60:
        candle = {
            "symbol": symbol,
            "open": acc["open"],
            "high": acc["high"],
            "low": acc["low"],
            "close": acc["close"],
            "timestamp": datetime.now(timezone.utc)
        }
        # Reset accumulator
        candle_accumulator[symbol] = {
            "open": None, "high": -float('inf'), "low": float('inf'), "close": 0.0, "count": 0
        }
        return candle
    return None


async def seed_candles(db):
    """
    Generate 50 historical 1-minute candles for each stock if none exist.
    Provides immediate analysis data on first run.
    """
    from sqlalchemy import select, func
    from models import Candle
    import datetime as dt

    for symbol in SUPPORTED_STOCKS:
        # Check if candles already exist
        res = await db.execute(select(func.count(Candle.id)).where(Candle.symbol == symbol))
        if res.scalar() > 0:
            continue

        base = BASE_PRICES[symbol]
        last_close = base
        now = datetime.now(timezone.utc)

        for i in range(50, 0, -1):
            ts = now - dt.timedelta(minutes=i)
            # Random walk for the candle
            o = round(last_close * (1 + random.uniform(-0.01, 0.01)), 2)
            c = round(o * (1 + random.uniform(-0.01, 0.01)), 2)
            h = round(max(o, c) * (1 + random.uniform(0, 0.005)), 2)
            l = round(min(o, c) * (1 - random.uniform(0, 0.005)), 2)
            
            db.add(Candle(
                symbol=symbol,
                open=o,
                high=h,
                low=l,
                close=c,
                timestamp=ts
            ))
            last_close = c
    await db.commit()
