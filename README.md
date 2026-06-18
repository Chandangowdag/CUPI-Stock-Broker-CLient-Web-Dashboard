# TradePulse — Real-Time Stock Broker Dashboard

TradePulse is a high-performance, full-stack stock trading simulator designed for a seamless and interactive user experience. It features a realistic price engine, professional technical analysis tools, and a robust virtual portfolio system.

![Project Status](https://img.shields.io/badge/Status-Complete-success)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688)
![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB)
![WebSocket](https://img.shields.io/badge/Streaming-WebSockets-orange)

## 🚀 Key Features

- **Live Market Feed:** Experience the thrill of the market with 1-second price updates streamed via low-latency WebSockets.
- **Advanced Analysis:** Toggle between high-level sparklines and professional **1-minute Candlestick (OHLC) charts** for deep technical analysis.
- **Virtual Trading:** Practice your strategy with a $10,000 virtual balance. Buy and sell fractional shares of tech giants like GOOG, TSLA, and NVDA.
- **Data Resiliency:** Custom sequence-based recovery ensures your dashboard stays accurate even after a brief connection loss.
- **Secure Authentication:** Industry-standard JWT authentication and bcrypt hashing protect your account and watchlist.
- **Premium Aesthetics:** A polished, dark-themed "glassmorphic" interface optimized for clarity and focus.

## 🛠️ Technical Architecture

### Backend (Python/FastAPI)
- **FastAPI:** Orchestrates the API and high-speed WebSocket broadcasting.
- **Async SQLAlchemy:** Handles database operations without blocking the price engine.
- **SQLite (aiosqlite):** Provides reliable persistence for users, trades, and historical data.
- **Simulation Engine:** Uses random-walk algorithms with mean reversion to generate realistic market behavior.

### Frontend (React/JS)
- **Vite:** Powers the build system for near-instant load times.
- **ApexCharts:** Renders interactive OHLC candlestick charts with zoom and pan capabilities.
- **Tailwind CSS:** Delivers a modern, responsive design that works on all screen sizes.
- **React Hot Toast:** Provides real-time feedback for trades and connectivity status.

## 💻 Getting Started

### 1. Prerequisites
- Python 3.10 or higher
- Node.js 18 or higher

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload
```
*Note: The database and historical data will be automatically generated on first startup.*

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*The dashboard will be available at `http://localhost:5173`.*

## 📄 License
This project is open-source and available under the MIT License.
