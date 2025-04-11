export interface MarketData {
  timestamp: number
  open: number
  high: number
  close: number
  low: number
  volume: number
  rsi: number
  macd: number
  signal: number
  histogram: number
}

export interface Signal {
  action: "BUY" | "SELL" | "HOLD"
  confidence: number
  rsi?: number
  macd?: number
}

export interface BacktestData {
  totalTrades: number
  winRate: number
  profitFactor: number
  sharpeRatio: number
  maxDrawdown: number
  netProfit: number
  summary: string
}

export interface Trade {
  id: string
  symbol: string
  action: "BUY" | "SELL"
  price: number
  timestamp: number
  risk: number
  profit?: number
}
