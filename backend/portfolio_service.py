"""
portfolio_service.py — Buy/sell execution and portfolio queries.

Virtual trading rules:
  - Each new user starts with $10,000 USD balance
  - Buy: deduct (shares × price) from balance, add shares to portfolio
  - Sell: remove shares from portfolio, credit balance
  - Fractional shares are allowed (like Robinhood)
  - Cannot buy more than balance allows
  - Cannot sell more shares than owned
"""

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from models import User, Portfolio, Transaction
from stock_engine import current_prices, SUPPORTED_STOCKS


async def get_portfolio(email: str, db: AsyncSession) -> dict:
    """
    Return the user's holdings with current market value and P&L.
    """
    result = await db.execute(
        select(Portfolio).where(Portfolio.email == email)
    )
    holdings = result.scalars().all()

    rows = []
    total_value = 0.0
    for h in holdings:
        if h.shares <= 0:
            continue
        price = current_prices.get(h.symbol, 0.0)
        market_value = round(h.shares * price, 2)
        total_value += market_value
        rows.append({
            "symbol": h.symbol,
            "shares": h.shares,
            "current_price": price,
            "market_value": market_value,
        })

    return {"holdings": rows, "total_market_value": round(total_value, 2)}


async def execute_trade(
    user: User,
    symbol: str,
    action: str,
    shares: float,
    db: AsyncSession,
) -> dict:
    """
    Execute a buy or sell order.
    Returns updated balance and trade confirmation.
    Raises HTTPException on insufficient funds or shares.
    """
    symbol = symbol.upper()
    if symbol not in SUPPORTED_STOCKS:
        raise HTTPException(status_code=400, detail=f"Unsupported stock: {symbol}")

    price = current_prices.get(symbol)
    if not price:
        raise HTTPException(status_code=503, detail="Price feed unavailable")

    total_cost = round(shares * price, 2)

    # ── Reload user for fresh balance ──────────────────────────────────────
    result = await db.execute(select(User).where(User.email == user.email))
    db_user = result.scalar_one()

    if action == "buy":
        if db_user.balance < total_cost:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient balance. Need ${total_cost:.2f}, have ${db_user.balance:.2f}"
            )
        db_user.balance = round(db_user.balance - total_cost, 2)
        await _adjust_holding(email=user.email, symbol=symbol, delta=+shares, db=db)

    elif action == "sell":
        holding = await _get_holding(user.email, symbol, db)
        owned = holding.shares if holding else 0.0
        if owned < shares:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient shares. Own {owned:.4f}, trying to sell {shares:.4f}"
            )
        db_user.balance = round(db_user.balance + total_cost, 2)
        await _adjust_holding(email=user.email, symbol=symbol, delta=-shares, db=db)

    # Record transaction
    tx = Transaction(
        email=user.email,
        symbol=symbol,
        action=action,
        shares=shares,
        price_at=price,
        total=total_cost,
    )
    db.add(tx)
    await db.flush()

    return {
        "success": True,
        "action": action,
        "symbol": symbol,
        "shares": shares,
        "price_at": price,
        "total": total_cost,
        "new_balance": db_user.balance,
    }


async def get_transactions(email: str, db: AsyncSession, limit: int = 50) -> list:
    result = await db.execute(
        select(Transaction)
        .where(Transaction.email == email)
        .order_by(Transaction.executed_at.desc())
        .limit(limit)
    )
    txs = result.scalars().all()
    return [
        {
            "id": t.id,
            "symbol": t.symbol,
            "action": t.action,
            "shares": t.shares,
            "price_at": t.price_at,
            "total": t.total,
            "executed_at": t.executed_at.isoformat() if t.executed_at else None,
        }
        for t in txs
    ]


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _get_holding(email: str, symbol: str, db: AsyncSession):
    result = await db.execute(
        select(Portfolio).where(Portfolio.email == email, Portfolio.symbol == symbol)
    )
    return result.scalar_one_or_none()


async def _adjust_holding(email: str, symbol: str, delta: float, db: AsyncSession):
    holding = await _get_holding(email, symbol, db)
    if holding:
        holding.shares = round(holding.shares + delta, 4)
        if holding.shares < 0:
            holding.shares = 0.0
    else:
        db.add(Portfolio(email=email, symbol=symbol, shares=round(delta, 4)))
    await db.flush()
