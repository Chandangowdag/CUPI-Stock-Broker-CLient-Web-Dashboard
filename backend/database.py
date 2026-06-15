"""
database.py — SQLAlchemy async engine + session factory
Uses SQLite via aiosqlite for zero-configuration persistence.
Swap DATABASE_URL to postgresql+asyncpg://... for Postgres in production.
"""

import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

# SQLite file lives next to main.py; swap to PostgreSQL URL in prod
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./tradepulse.db")

engine = create_async_engine(
    DATABASE_URL,
    echo=False,          # Set True to log every SQL statement (debug)
    future=True,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    """FastAPI dependency that provides an async DB session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables on startup if they don't exist."""
    async with engine.begin() as conn:
        from models import Base as ModelBase  # noqa: avoid circular at module level
        await conn.run_sync(ModelBase.metadata.create_all)
