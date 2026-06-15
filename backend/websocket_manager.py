"""
websocket_manager.py — WebSocket connection registry with pub/sub fanout.

Architecture improvement over v1:
  Instead of iterating all users in a single loop, price ticks are broadcast
  per-symbol to all subscribers of that symbol concurrently (asyncio.gather).
  This gives O(subscribers_per_symbol) fan-out per tick rather than
  O(users * stocks_per_user) sequential sends.

  For true horizontal scalability (multiple Uvicorn workers) you would
  replace this with Redis Pub/Sub. The interface is kept identical so that
  swap is a single-file change.
"""

import asyncio
import json
import logging
from typing import Dict, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    def __init__(self):
        # email → WebSocket
        self._connections: Dict[str, WebSocket] = {}
        # symbol → set of emails subscribed to it
        self._symbol_to_emails: Dict[str, Set[str]] = {}
        # email → set of symbols it cares about
        self._email_to_symbols: Dict[str, Set[str]] = {}

    # ── Connection lifecycle ───────────────────────────────────────────────

    async def connect(self, email: str, websocket: WebSocket, symbols: list[str]):
        """Accept WS connection and register the user's initial symbol set."""
        await websocket.accept()
        # Drop any stale connection for this user
        await self._drop(email, close=True)

        self._connections[email] = websocket
        self._update_subscriptions(email, symbols)
        logger.info(f"[WS] Connected: {email} | watching: {symbols} | total: {len(self._connections)}")

    def disconnect(self, email: str):
        """Remove connection and clean up index structures."""
        asyncio.create_task(self._drop(email, close=False))

    async def _drop(self, email: str, close: bool):
        ws = self._connections.pop(email, None)
        if ws and close:
            try:
                await ws.close()
            except Exception:
                pass
        # Remove from reverse index
        for syms in self._symbol_to_emails.values():
            syms.discard(email)
        self._email_to_symbols.pop(email, None)

    # ── Subscription management ────────────────────────────────────────────

    def update_user_symbols(self, email: str, symbols: list[str]):
        """Called when a user changes their watchlist mid-session."""
        self._update_subscriptions(email, symbols)

    def _update_subscriptions(self, email: str, symbols: list[str]):
        # Remove old reverse mappings
        old = self._email_to_symbols.get(email, set())
        for sym in old:
            self._symbol_to_emails.get(sym, set()).discard(email)

        # Add new
        sym_set = set(symbols)
        self._email_to_symbols[email] = sym_set
        for sym in sym_set:
            if sym not in self._symbol_to_emails:
                self._symbol_to_emails[sym] = set()
            self._symbol_to_emails[sym].add(email)

    # ── Broadcasting ──────────────────────────────────────────────────────

    async def broadcast_tick(self, tick: dict):
        """
        Fan-out a single price tick to all users subscribed to that symbol.
        Uses asyncio.gather for concurrent sends — no sequential blocking.
        """
        symbol = tick["symbol"]
        recipients = list(self._symbol_to_emails.get(symbol, set()))
        if not recipients:
            return

        message = json.dumps({"type": "price_update", "data": [tick]})
        tasks = [self._send_raw(email, message) for email in recipients]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def send_to_user(self, email: str, payload: dict):
        """Send a structured message to a single user."""
        ws = self._connections.get(email)
        if ws:
            try:
                await ws.send_text(json.dumps(payload))
            except Exception as e:
                logger.warning(f"[WS] Send failed for {email}: {e}")
                self.disconnect(email)

    async def _send_raw(self, email: str, raw: str):
        ws = self._connections.get(email)
        if ws:
            try:
                await ws.send_text(raw)
            except Exception as e:
                logger.warning(f"[WS] Raw send failed for {email}: {e}")
                self.disconnect(email)

    # ── Introspection ──────────────────────────────────────────────────────

    def is_connected(self, email: str) -> bool:
        return email in self._connections

    def connected_count(self) -> int:
        return len(self._connections)


manager = WebSocketManager()
