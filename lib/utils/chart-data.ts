import type { MarketData } from "../types"

// Convert our MarketData format to the format expected by Lightweight Charts
export function convertToChartData(data: MarketData[]) {
  if (!Array.isArray(data) || data.length === 0) {
    console.warn("Empty or invalid data passed to convertToChartData")
    return {
      ohlcData: [],
      volumeData: [],
      rsiData: [],
      macdData: [],
    }
  }

  try {
    // Sort data by timestamp (oldest first)
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp)

    // Convert to OHLC format for candlestick chart
    const ohlcData = sortedData.map((item) => ({
      time: item.timestamp / 1000, // Convert to seconds for Lightweight Charts
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
    }))

    // Convert to format for volume chart
    const volumeData = sortedData.map((item) => ({
      time: item.timestamp / 1000,
      value: item.volume,
      color: item.close >= item.open ? "rgba(0, 150, 136, 0.5)" : "rgba(255, 82, 82, 0.5)",
    }))

    // Convert to format for RSI indicator
    const rsiData = sortedData.map((item) => ({
      time: item.timestamp / 1000,
      value: item.rsi,
    }))

    // Convert to format for MACD indicator
    const macdData = sortedData.map((item) => ({
      time: item.timestamp / 1000,
      macd: item.macd,
      signal: item.signal,
      histogram: item.histogram,
    }))

    return {
      ohlcData,
      volumeData,
      rsiData,
      macdData,
    }
  } catch (error) {
    console.error("Error converting chart data:", error)
    return {
      ohlcData: [],
      volumeData: [],
      rsiData: [],
      macdData: [],
    }
  }
}

// Format price with appropriate precision
export function formatPrice(price: number, precision = 2): string {
  if (isNaN(price)) return "N/A"
  try {
    return price.toFixed(precision)
  } catch (error) {
    console.error("Error formatting price:", error)
    return "N/A"
  }
}

// Determine appropriate price precision based on price range
export function determinePricePrecision(price: number): number {
  if (isNaN(price)) return 2
  try {
    if (price < 0.1) return 6
    if (price < 1) return 4
    if (price < 10) return 3
    if (price < 1000) return 2
    return 1
  } catch (error) {
    console.error("Error determining price precision:", error)
    return 2
  }
}

// Calculate percentage change
export function calculateChange(currentPrice: number, previousPrice: number): number {
  if (isNaN(currentPrice) || isNaN(previousPrice) || previousPrice === 0) return 0
  try {
    return ((currentPrice - previousPrice) / previousPrice) * 100
  } catch (error) {
    console.error("Error calculating change:", error)
    return 0
  }
}
