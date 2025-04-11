// Types for trading integration

export interface ApiCredentials {
  apiKey: string
  apiSecret: string
  testnet?: boolean
}

export interface MarketOrder {
  symbol: string
  side: "BUY" | "SELL"
  quantity: number
  quoteOrderQty?: number // For buying with exact quote amount (e.g., spend exactly 100 USDT)
  reduceOnly?: boolean // Futures-specific: only reduce position size, not open new positions
  positionSide?: "BOTH" | "LONG" | "SHORT" // Futures-specific: for hedge mode
}

export interface LimitOrder {
  symbol: string
  side: "BUY" | "SELL"
  quantity: number
  price: number
  timeInForce: "GTC" | "IOC" | "FOK" // Good Till Cancel, Immediate or Cancel, Fill or Kill
  reduceOnly?: boolean // Futures-specific
  positionSide?: "BOTH" | "LONG" | "SHORT" // Futures-specific
}

export interface StopLossOrder {
  symbol: string
  side: "SELL" | "BUY" // Can be BUY for short positions in futures
  quantity: number
  stopPrice: number
  price: number // Limit price after stop is triggered
  reduceOnly?: boolean // Futures-specific
  positionSide?: "BOTH" | "LONG" | "SHORT" // Futures-specific
}

export interface TakeProfitOrder {
  symbol: string
  side: "SELL" | "BUY" // Can be BUY for short positions in futures
  quantity: number
  stopPrice: number
  price: number // Limit price after stop is triggered
  reduceOnly?: boolean // Futures-specific
  positionSide?: "BOTH" | "LONG" | "SHORT" // Futures-specific
}

export type OrderType = "MARKET" | "LIMIT" | "STOP_LOSS_LIMIT" | "TAKE_PROFIT_LIMIT"

export interface Order {
  id: string
  symbol: string
  side: "BUY" | "SELL"
  type: OrderType
  status: OrderStatus
  quantity: number
  price?: number
  stopPrice?: number
  executedQty: number
  executedPrice?: number
  commission?: number
  commissionAsset?: string
  timestamp: number
  clientOrderId?: string
  reduceOnly?: boolean // Futures-specific
  positionSide?: "BOTH" | "LONG" | "SHORT" // Futures-specific
}

export type OrderStatus = "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "PENDING_CANCEL" | "REJECTED" | "EXPIRED"

export interface Position {
  symbol: string
  positionSide: "BOTH" | "LONG" | "SHORT" // Futures-specific
  quantity: number
  entryPrice: number
  markPrice: number
  pnl: number
  pnlPercent: number
  liquidationPrice: number // Futures-specific
  leverage: number // Futures-specific
  marginType: "ISOLATED" | "CROSSED" // Futures-specific
  isolatedMargin?: number // Futures-specific: amount of isolated margin
  unrealizedPnl: number // Futures-specific
}

export interface AccountBalance {
  asset: string
  free: number
  locked: number
  total: number
}

export interface FuturesAccountBalance extends AccountBalance {
  crossUnPnl: number // Unrealized PnL for cross positions
  availableBalance: number // Balance available for new positions
}

export interface TradeExecutionResult {
  success: boolean
  orderId?: string
  errorMessage?: string
  order?: Order
}

export interface RiskParameters {
  maxPositionSize: number // Maximum position size in quote currency (e.g., USDT)
  maxLeverage: number // Maximum leverage to use
  stopLossPercent: number // Default stop loss percentage
  takeProfitPercent: number // Default take profit percentage
  maxDailyLoss: number // Maximum daily loss in quote currency
  maxDrawdownPercent: number // Maximum drawdown percentage before stopping trading
}

export interface FuturesRiskParameters extends RiskParameters {
  marginType: "ISOLATED" | "CROSSED" // Futures-specific
  defaultLeverage: number // Default leverage to use
  maxOpenPositions: number // Maximum number of open positions
  maxLossPerPosition: number // Maximum loss per position in quote currency
}

export type TradingMode = "spot" | "futures"

export interface TradingConfig {
  enabled: boolean
  testMode: boolean // If true, use testnet and don't execute real trades
  tradingMode: TradingMode // Which trading mode is active
  riskParameters: RiskParameters
  allowedSymbols: string[] // List of symbols allowed to trade
  futuresConfig?: {
    hedgeMode: boolean // Whether to use hedge mode (can have both long and short positions)
    marginType: "ISOLATED" | "CROSSED" // Default margin type
    defaultLeverage: number // Default leverage
    riskParameters?: FuturesRiskParameters // Futures-specific risk parameters
  }
}

// Futures-specific types
export interface FundingRate {
  symbol: string
  markPrice: number
  indexPrice: number
  estimatedSettlePrice: number
  lastFundingRate: number
  nextFundingTime: number
  interestRate: number
}

export interface LeverageInfo {
  symbol: string
  leverage: number
  maxNotionalValue: number // Maximum position size in USDT
}

export interface MarginType {
  symbol: string
  marginType: "ISOLATED" | "CROSSED"
}
