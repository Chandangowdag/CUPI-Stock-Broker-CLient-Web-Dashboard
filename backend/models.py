"""
models.py — ORM table definitions (SQLAlchemy) + request/response schemas (Pydantic).

Tables:
  users             — registered users with hashed passwords
  subscriptions     — which stocks each user watches
  price_history     — time-series of generated prices (rolling 200 entries per symbol)
  portfolio         — virtual holdings (shares owned)
  transactions      — buy/sell ledger
"""

from __future__ import annotations
import datetime
from typing import List, Optional

from sqlalchemy import (
    Column, String, Float, Integer, DateTime, ForeignKey, Boolean, func
)
from sqlalchemy.orm import relationship
from pydantic import BaseModel, EmailStr, field_validator

from database import Base


# ─── ORM Models ──────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    email        = Column(String, primary_key=True, index=True)
    password_hash = Column(String, nullable=False)
    balance      = Column(Float, default=10_000.0, nullable=False)  # virtual $ balance
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    subscriptions = relationship("Subscription", back_populates="user", cascade="all, delete-orphan")
    holdings      = relationship("Portfolio", back_populates="user", cascade="all, delete-orphan")
    transactions  = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id     = Column(Integer, primary_key=True, autoincrement=True)
    email  = Column(String, ForeignKey("users.email", ondelete="CASCADE"), nullable=False, index=True)
    symbol = Column(String, nullable=False)

    user = relationship("User", back_populates="subscriptions")


class PriceHistory(Base):
    """Rolling price log — max 200 rows per symbol, pruned in the broadcast task."""
    __tablename__ = "price_history"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    symbol     = Column(String, nullable=False, index=True)
    price      = Column(Float, nullable=False)
    change     = Column(Float, nullable=False, default=0.0)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())


class Candle(Base):
    """1-minute aggregated OHLC bars for analysis."""
    __tablename__ = "candles"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    symbol     = Column(String, nullable=False, index=True)
    open       = Column(Float, nullable=False)
    high       = Column(Float, nullable=False)
    low        = Column(Float, nullable=False)
    close      = Column(Float, nullable=False)
    timestamp  = Column(DateTime(timezone=True), nullable=False)


class Portfolio(Base):
    """Virtual portfolio: how many shares of each stock a user holds."""
    __tablename__ = "portfolio"

    id     = Column(Integer, primary_key=True, autoincrement=True)
    email  = Column(String, ForeignKey("users.email", ondelete="CASCADE"), nullable=False, index=True)
    symbol = Column(String, nullable=False)
    shares = Column(Float, nullable=False, default=0.0)

    user = relationship("User", back_populates="holdings")


class Transaction(Base):
    """Immutable buy/sell log."""
    __tablename__ = "transactions"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    email        = Column(String, ForeignKey("users.email", ondelete="CASCADE"), nullable=False, index=True)
    symbol       = Column(String, nullable=False)
    action       = Column(String, nullable=False)   # "buy" | "sell"
    shares       = Column(Float, nullable=False)
    price_at     = Column(Float, nullable=False)    # price when trade executed
    total        = Column(Float, nullable=False)    # shares * price_at
    executed_at  = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="transactions")


# ─── Pydantic Schemas ─────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def email_lower(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v:
            raise ValueError("Invalid email")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def email_lower(cls, v: str) -> str:
        return v.strip().lower()


class SubscriptionRequest(BaseModel):
    stocks: List[str]


class TradeRequest(BaseModel):
    symbol: str
    shares: float
    action: str   # "buy" | "sell"

    @field_validator("action")
    @classmethod
    def valid_action(cls, v: str) -> str:
        if v not in ("buy", "sell"):
            raise ValueError("action must be 'buy' or 'sell'")
        return v

    @field_validator("shares")
    @classmethod
    def positive_shares(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("shares must be positive")
        return round(v, 4)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str
    balance: float
    subscriptions: List[str]
