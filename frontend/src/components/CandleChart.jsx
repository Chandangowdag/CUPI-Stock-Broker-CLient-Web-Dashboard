import React from 'react'
import Chart from 'react-apexcharts'

/**
 * CandleChart — Professional OHLC candlestick chart using ApexCharts.
 * 
 * Props:
 *   symbol — stock symbol
 *   data   — array of {time, open, high, low, close}
 *   color  — brand color for the stock
 */
export default function CandleChart({ symbol, data, color }) {
  const series = [{
    data: (data || []).map(d => ({
      x: new Date(d.time),
      y: [d.open, d.high, d.low, d.close]
    }))
  }]

  const options = {
    chart: {
      type: 'candlestick',
      height: 250,
      toolbar: { show: true }, // Enable zoom/pan for analysis
      animations: { enabled: false },
      background: 'transparent',
      fontFamily: 'JetBrains Mono, monospace',
    },
    theme: {
      mode: 'dark',
    },
    xaxis: {
      type: 'datetime',
      labels: {
        style: { colors: '#64748b', fontSize: '10px' },
        datetimeUTC: false,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
    },
    yaxis: {
      tooltip: { enabled: true },
      labels: {
        style: { colors: '#64748b', fontSize: '10px' },
        formatter: (val) => `$${val.toFixed(2)}`,
      },
      tickAmount: 4,
    },
    grid: {
      borderColor: '#1e2d45',
      strokeDashArray: 4,
      padding: { left: 10, right: 10 },
    },
    plotOptions: {
      candlestick: {
        colors: {
          upward: '#00ff88',
          downward: '#ff4466'
        },
        wick: { useFillColor: true }
      }
    },
    tooltip: {
      theme: 'dark',
      x: { format: 'MMM dd HH:mm' }
    }
  }

  return (
    <div className="h-full w-full">
      <Chart
        options={options}
        series={series}
        type="candlestick"
        height="100%"
        width="100%"
      />
    </div>
  )
}
