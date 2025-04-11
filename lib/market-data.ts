import type { MarketData } from "./types"

// Calculate RSI (Relative Strength Index)
function calculateRSI(closePrices: number[], period = 14): number[] {
  try {
    const rsiValues: number[] = []

    if (!Array.isArray(closePrices) || closePrices.length <= period) {
      // Not enough data
      return Array(closePrices?.length || 0).fill(50)
    }

    // Calculate price changes
    const changes: number[] = []
    for (let i = 1; i < closePrices.length; i++) {
      changes.push(closePrices[i] - closePrices[i - 1])
    }

    // Calculate initial average gains and losses
    let avgGain = 0
    let avgLoss = 0

    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) {
        avgGain += changes[i]
      } else {
        avgLoss += Math.abs(changes[i])
      }
    }

    avgGain /= period
    avgLoss /= period

    // Calculate RSI for the first period
    let rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss) // Avoid division by zero
    let rsi = 100 - 100 / (1 + rs)
    rsiValues.push(50) // First period doesn't have RSI

    for (let i = 1; i < period; i++) {
      rsiValues.push(50) // Fill initial periods with neutral value
    }

    rsiValues.push(rsi)

    // Calculate RSI for remaining periods using smoothed method
    for (let i = period; i < changes.length; i++) {
      const currentGain = changes[i] > 0 ? changes[i] : 0
      const currentLoss = changes[i] < 0 ? Math.abs(changes[i]) : 0

      avgGain = (avgGain * (period - 1) + currentGain) / period
      avgLoss = (avgLoss * (period - 1) + currentLoss) / period

      rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss)
      rsi = 100 - 100 / (1 + rs)

      rsiValues.push(rsi)
    }

    return rsiValues
  } catch (error) {
    console.error("Error calculating RSI:", error)
    return Array(closePrices?.length || 0).fill(50)
  }
}

// Calculate EMA (Exponential Moving Average)
function calculateEMA(data: number[], period: number): number[] {
  try {
    if (!Array.isArray(data) || data.length < period) {
      return Array(data?.length || 0).fill(0)
    }

    const ema: number[] = []
    const multiplier = 2 / (period + 1)

    // Start with SMA for the first period
    let sum = 0
    for (let i = 0; i < period; i++) {
      sum += data[i]
      ema.push(0) // Placeholder
    }

    ema[period - 1] = sum / period

    // Calculate EMA for the rest of the data
    for (let i = period; i < data.length; i++) {
      ema.push(data[i] * multiplier + ema[i - 1] * (1 - multiplier))
    }

    return ema
  } catch (error) {
    console.error("Error calculating EMA:", error)
    return Array(data?.length || 0).fill(0)
  }
}

// Calculate MACD (Moving Average Convergence Divergence)
function calculateMACD(
  closePrices: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): {
  macd: number[]
  signal: number[]
  histogram: number[]
} {
  try {
    if (!Array.isArray(closePrices) || closePrices.length < Math.max(fastPeriod, slowPeriod) + signalPeriod) {
      return {
        macd: Array(closePrices?.length || 0).fill(0),
        signal: Array(closePrices?.length || 0).fill(0),
        histogram: Array(closePrices?.length || 0).fill(0),
      }
    }

    // Calculate fast and slow EMAs
    const fastEMA = calculateEMA(closePrices, fastPeriod)
    const slowEMA = calculateEMA(closePrices, slowPeriod)

    // Calculate MACD line (fast EMA - slow EMA)
    const macdLine: number[] = []
    for (let i = 0; i < closePrices.length; i++) {
      if (i < slowPeriod - 1) {
        macdLine.push(0)
      } else {
        macdLine.push(fastEMA[i] - slowEMA[i])
      }
    }

    // Calculate signal line (EMA of MACD line)
    const signalLine = calculateEMA(macdLine, signalPeriod)

    // Calculate histogram (MACD line - signal line)
    const histogram: number[] = []
    for (let i = 0; i < closePrices.length; i++) {
      if (i < slowPeriod + signalPeriod - 2) {
        histogram.push(0)
      } else {
        histogram.push(macdLine[i] - signalLine[i])
      }
    }

    return {
      macd: macdLine,
      signal: signalLine,
      histogram,
    }
  } catch (error) {
    console.error("Error calculating MACD:", error)
    return {
      macd: Array(closePrices?.length || 0).fill(0),
      signal: Array(closePrices?.length || 0).fill(0),
      histogram: Array(closePrices?.length || 0).fill(0),
    }
  }
}

// This function converts raw OHLCV data to MarketData with indicators
export function calculateIndicators(data: any[]): MarketData[] {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      console.error("Invalid data passed to calculateIndicators:", data)
      return []
    }

    // Extract close prices for indicator calculations
    const closePrices = data.map((candle) => {
      const closePrice = Number.parseFloat(candle[4])
      return isNaN(closePrice) ? 0 : closePrice
    })

    // Calculate RSI
    const rsiValues = calculateRSI(closePrices)

    // Calculate MACD
    const macdData = calculateMACD(closePrices)

    // Convert raw OHLCV data to MarketData with indicators
    return data.map((candle, index) => {
      // Parse values safely
      const timestamp = Number(candle[0]) || 0
      const open = Number.parseFloat(candle[1]) || 0
      const high = Number.parseFloat(candle[2]) || 0
      const low = Number.parseFloat(candle[3]) || 0
      const close = Number.parseFloat(candle[4]) || 0
      const volume = Number.parseFloat(candle[5]) || 0

      return {
        timestamp,
        open,
        high,
        low,
        close,
        volume,
        rsi: rsiValues[index] || 50,
        macd: macdData.macd[index] || 0,
        signal: macdData.signal[index] || 0,
        histogram: macdData.histogram[index] || 0,
      }
    })
  } catch (error) {
    console.error("Error in calculateIndicators:", error)
    return []
  }
}
