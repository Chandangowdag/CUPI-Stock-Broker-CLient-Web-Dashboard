/**
 * websocket.js v2 — Authenticated WebSocket with sequence-based catchup.
 *
 * Changes from v1:
 *  - Auth: passes JWT as ?token= query param (not email in the path)
 *  - Tracks last known sequence ID per symbol
 *  - On reconnect, sends {"type":"catchup","seq":{...}} to recover missed ticks
 *  - Exponential backoff unchanged
 */

const WS_BASE = 'ws://localhost:8000'

export class StockWebSocket {
  constructor(token, { onMessage, onConnect, onDisconnect }) {
    this.token = token
    this.onMessage = onMessage
    this.onConnect = onConnect
    this.onDisconnect = onDisconnect

    this.ws = null
    this.reconnectDelay = 1000
    this.maxReconnectDelay = 30000
    this.shouldReconnect = true
    this.pingInterval = null

    // Track the highest sequence number seen per symbol so we can request catchup
    this.lastSeq = {}   // symbol -> seq number
  }

  connect() {
    this.shouldReconnect = true
    this._connect()
  }

  _connect() {
    const url = `${WS_BASE}/ws?token=${encodeURIComponent(this.token)}`
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      console.log('[WS] Connected')
      this.reconnectDelay = 1000
      this.onConnect?.()
      this._startPing()

      // If we have sequence state, ask server for any ticks we missed
      if (Object.keys(this.lastSeq).length > 0) {
        this._sendCatchup()
      }
    }

    this.ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data)
        if (msg.type === 'pong') return

        // Track sequence IDs for missed-message recovery
        if (msg.type === 'price_update' || msg.type === 'snapshot' || msg.type === 'catchup_data') {
          for (const item of msg.data || []) {
            if (item.seq !== undefined) {
              this.lastSeq[item.symbol] = Math.max(this.lastSeq[item.symbol] ?? 0, item.seq)
            }
          }
        }

        this.onMessage?.(msg)
      } catch (e) {
        console.error('[WS] Parse error:', e)
      }
    }

    this.ws.onclose = ({ code }) => {
      console.log(`[WS] Disconnected (${code})`)
      this._stopPing()
      this.onDisconnect?.()

      if (this.shouldReconnect && code !== 4001) {
        setTimeout(() => this._connect(), this.reconnectDelay)
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)
      }
    }

    this.ws.onerror = (e) => console.error('[WS] Error:', e)
  }

  _sendCatchup() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'catchup', seq: { ...this.lastSeq } }))
    }
  }

  _startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send('ping')
    }, 15000)
  }

  _stopPing() {
    clearInterval(this.pingInterval)
    this.pingInterval = null
  }

  disconnect() {
    this.shouldReconnect = false
    this._stopPing()
    this.ws?.close()
  }
}
