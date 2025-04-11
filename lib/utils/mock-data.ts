import type { MarketData } from "../types"

// Generate mock market data for testing or when API is unavailable
export function generateMockMarketData(symbol: string, timeframe: string, count = 100): MarketData[] {
  const now = Date.now()
  const data: MarketData[] = []

  // Determine candle interval in milliseconds
  let interval = 60 * 60 * 1000 // Default to 1h
  switch (timeframe) {
    case "1m":
      interval = 60 * 1000
      break
    case "5m":
      interval = 5 * 60 * 1000
      break
    case "15m":
      interval = 15 * 60 * 1000
      break
    case "1h":
      interval = 60 * 60 * 1000
      break
    case "4h":
      interval = 4 * 60 * 60 * 1000
      break
    case "1d":
      interval = 24 * 60 * 60 * 1000
      break
  }

  // Generate base price based on symbol
  let basePrice = 100
  if (symbol.includes("BTC")) basePrice = 60000 + Math.random() * 20000
  else if (symbol.includes("ETH")) basePrice = 3000 + Math.random() * 1000
  else if (symbol.includes("BNB")) basePrice = 500 + Math.random() * 100

  // Generate mock candles
  let lastClose = basePrice
  for (let i = 0; i < count; i++) {
    const timestamp = now - (count - i) * interval

    // Generate random price movement
    const changePercent = (Math.random() * 2 - 1) * 2 // -2% to +2%
    const range = lastClose * 0.01 // 1% of last close

    const close = lastClose * (1 + changePercent / 100)
    const open = lastClose
    const high = Math.max(open, close) + Math.random() * range
    const low = Math.min(open, close) - Math.random() * range
    const volume = basePrice * (Math.random() * 10 + 1) // Random volume

    // Simple mock indicators
    const rsi = 30 + Math.random() * 40 // Random RSI between 30-70
    const macd = -2 + Math.random() * 4 // Random MACD between -2 and 2
    const signal = -2 + Math.random() * 4 // Random signal line
    const histogram = macd - signal

    data.push({
      timestamp,
      open,
      high,
      low,
      close,
      volume,
      rsi,
      macd,
      signal,
      histogram,
    })

    lastClose = close
  }

  return data
}
