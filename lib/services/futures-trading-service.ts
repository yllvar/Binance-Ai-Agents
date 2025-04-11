import { BinanceFuturesApi } from "./binance-futures-api"
import type {
  ApiCredentials,
  MarketOrder,
  StopLossOrder,
  TakeProfitOrder,
  Order,
  Position,
  FuturesAccountBalance,
  TradeExecutionResult,
  TradingConfig,
  FuturesRiskParameters,
} from "../types/trading"

// Logger for debugging
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[FUTURES TRADING] ${message}`, data ? JSON.stringify(data) : "")
  },
  error: (message: string, error: any) => {
    console.error(`[FUTURES TRADING] ${message}`, error)
  },
  warn: (message: string, data?: any) => {
    console.warn(`[FUTURES TRADING] ${message}`, data ? JSON.stringify(data) : "")
  },
}

export class FuturesTradingService {
  private api: BinanceFuturesApi
  private config: TradingConfig
  private dailyPnL = 0
  private initialBalance = 0
  private currentDrawdown = 0

  constructor(credentials: ApiCredentials, config: TradingConfig) {
    this.api = new BinanceFuturesApi(credentials)
    this.config = config
  }

  // Initialize the trading service
  async initialize(): Promise<boolean> {
    try {
      // Check connection to Binance API
      await this.api.getServerTime()

      // Get initial balance for drawdown calculation
      const balances = await this.api.getBalances()
      const usdtBalance = balances.find((b) => b.asset === "USDT")

      if (usdtBalance) {
        this.initialBalance = usdtBalance.total
        logger.info(`Initial USDT balance: ${this.initialBalance}`)
      }

      // Set up hedge mode if specified
      if (this.config.futuresSpecific?.hedgeMode) {
        await this.api.changePositionMode(true)
        logger.info("Hedge mode enabled")
      }

      return true
    } catch (error) {
      logger.error("Failed to initialize futures trading service", error)
      return false
    }
  }

  // Execute a trade based on AI recommendation
  async executeTrade(
    symbol: string,
    action: "BUY" | "SELL" | "HOLD",
    confidence: number,
  ): Promise<TradeExecutionResult> {
    // If trading is disabled or action is HOLD, don't execute trade
    if (!this.config.enabled || action === "HOLD") {
      return {
        success: false,
        errorMessage: !this.config.enabled
          ? "Trading is disabled in configuration"
          : "Action is HOLD, no trade executed",
      }
    }

    // Check if symbol is allowed
    if (!this.config.allowedSymbols.includes(symbol)) {
      return {
        success: false,
        errorMessage: `Symbol ${symbol} is not in the allowed symbols list`,
      }
    }

    try {
      // Check if we're in test mode
      if (this.config.testMode) {
        logger.info(`[TEST MODE] Would execute ${action} for ${symbol} with confidence ${confidence}`)
        return {
          success: true,
          orderId: `test_${Date.now()}`,
          order: {
            id: `test_${Date.now()}`,
            symbol,
            side: action,
            type: "MARKET",
            status: "FILLED",
            quantity: 0,
            executedQty: 0,
            timestamp: Date.now(),
          },
        }
      }

      // Check risk parameters before executing trade
      if (!this.checkRiskParameters()) {
        return {
          success: false,
          errorMessage: "Trade rejected due to risk parameters",
        }
      }

      // Get current balance
      const balances = await this.api.getBalances()
      const usdtBalance = balances.find((b) => b.asset === "USDT")

      if (!usdtBalance || usdtBalance.availableBalance <= 0) {
        return {
          success: false,
          errorMessage: "Insufficient USDT balance",
        }
      }

      // Calculate position size based on risk parameters and leverage
      const leverage = this.config.futuresSpecific?.defaultLeverage || 1
      const positionSize = this.calculatePositionSize(usdtBalance.availableBalance, confidence, leverage)

      // Get current price
      const currentPrice = await this.api.getCurrentPrice(symbol)

      // Calculate quantity based on position size and current price
      const quantity = positionSize / currentPrice

      // Check if we already have a position for this symbol
      const existingPosition = await this.api.getPositionInfo(symbol)

      // Set up margin type and leverage
      if (this.config.futuresSpecific?.marginType) {
        await this.api.changeMarginType(symbol, this.config.futuresSpecific.marginType)
      }

      await this.api.changeLeverage(symbol, leverage)

      // Execute the trade
      if (action === "BUY") {
        // If we have a short position and hedge mode is not enabled, close it first
        if (
          existingPosition &&
          existingPosition.quantity > 0 &&
          existingPosition.positionSide === "SHORT" &&
          !this.config.futuresSpecific?.hedgeMode
        ) {
          // Close the short position
          const closeOrder: MarketOrder = {
            symbol,
            side: "BUY", // Buy to close short
            quantity: existingPosition.quantity,
            reduceOnly: true,
          }

          await this.api.placeMarketOrder(closeOrder)
        }

        // Open a long position
        const marketOrder: MarketOrder = {
          symbol,
          side: "BUY",
          quantity,
          positionSide: this.config.futuresSpecific?.hedgeMode ? "LONG" : "BOTH",
        }

        const result = await this.api.placeMarketOrder(marketOrder)

        // If order was successful, place stop loss and take profit orders
        if (result.success && result.order) {
          await this.placeStopLossAndTakeProfit(symbol, "BUY", result.order.executedQty, currentPrice)
        }

        return result
      } else if (action === "SELL") {
        // If we have a long position and hedge mode is not enabled, close it first
        if (
          existingPosition &&
          existingPosition.quantity > 0 &&
          existingPosition.positionSide === "LONG" &&
          !this.config.futuresSpecific?.hedgeMode
        ) {
          // Close the long position
          const closeOrder: MarketOrder = {
            symbol,
            side: "SELL", // Sell to close long
            quantity: existingPosition.quantity,
            reduceOnly: true,
          }

          await this.api.placeMarketOrder(closeOrder)
        }

        // Open a short position
        const marketOrder: MarketOrder = {
          symbol,
          side: "SELL",
          quantity,
          positionSide: this.config.futuresSpecific?.hedgeMode ? "SHORT" : "BOTH",
        }

        const result = await this.api.placeMarketOrder(marketOrder)

        // If order was successful, place stop loss and take profit orders
        if (result.success && result.order) {
          await this.placeStopLossAndTakeProfit(symbol, "SELL", result.order.executedQty, currentPrice)
        }

        return result
      }

      return {
        success: false,
        errorMessage: "Invalid action",
      }
    } catch (error) {
      logger.error(`Failed to execute trade for ${symbol}`, error)

      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // Place stop loss and take profit orders
  private async placeStopLossAndTakeProfit(
    symbol: string,
    side: "BUY" | "SELL",
    quantity: number,
    entryPrice: number,
  ): Promise<void> {
    try {
      const stopLossPercent = this.config.riskParameters.stopLossPercent / 100
      const takeProfitPercent = this.config.riskParameters.takeProfitPercent / 100
      const positionSide = this.config.futuresSpecific?.hedgeMode ? (side === "BUY" ? "LONG" : "SHORT") : "BOTH"

      if (side === "BUY") {
        // For long positions
        const stopLossPrice = entryPrice * (1 - stopLossPercent)
        const takeProfitPrice = entryPrice * (1 + takeProfitPercent)

        // Place stop loss order
        const stopLossOrder: StopLossOrder = {
          symbol,
          side: "SELL", // Sell to close long position
          quantity,
          stopPrice: stopLossPrice,
          price: stopLossPrice * 0.99, // Set limit price slightly below stop price
          reduceOnly: true,
          positionSide,
        }

        await this.api.placeStopLossOrder(stopLossOrder)

        // Place take profit order
        const takeProfitOrder: TakeProfitOrder = {
          symbol,
          side: "SELL", // Sell to close long position
          quantity,
          stopPrice: takeProfitPrice,
          price: takeProfitPrice * 0.99, // Set limit price slightly below stop price
          reduceOnly: true,
          positionSide,
        }

        await this.api.placeTakeProfitOrder(takeProfitOrder)
      } else {
        // For short positions
        const stopLossPrice = entryPrice * (1 + stopLossPercent)
        const takeProfitPrice = entryPrice * (1 - takeProfitPercent)

        // Place stop loss order
        const stopLossOrder: StopLossOrder = {
          symbol,
          side: "BUY", // Buy to close short position
          quantity,
          stopPrice: stopLossPrice,
          price: stopLossPrice * 1.01, // Set limit price slightly above stop price
          reduceOnly: true,
          positionSide,
        }

        await this.api.placeStopLossOrder(stopLossOrder)

        // Place take profit order
        const takeProfitOrder: TakeProfitOrder = {
          symbol,
          side: "BUY", // Buy to close short position
          quantity,
          stopPrice: takeProfitPrice,
          price: takeProfitPrice * 1.01, // Set limit price slightly above stop price
          reduceOnly: true,
          positionSide,
        }

        await this.api.placeTakeProfitOrder(takeProfitOrder)
      }
    } catch (error) {
      logger.error(`Failed to place stop loss and take profit orders for ${symbol}`, error)
    }
  }

  // Calculate position size based on risk parameters
  private calculatePositionSize(availableBalance: number, confidence: number, leverage: number): number {
    // Base position size on max position size from risk parameters
    let positionSize = this.config.riskParameters.maxPositionSize

    // Adjust position size based on confidence
    positionSize = positionSize * confidence

    // Apply leverage (be careful with this!)
    positionSize = positionSize * leverage

    // Ensure position size doesn't exceed available balance * leverage
    const maxPossibleSize = availableBalance * leverage
    positionSize = Math.min(positionSize, maxPossibleSize)

    // Round to 2 decimal places
    return Math.floor(positionSize * 100) / 100
  }

  // Check risk parameters before executing trade
  private async checkRiskParameters(): Promise<boolean> {
    try {
      // Check daily loss limit
      if (this.dailyPnL < -this.config.riskParameters.maxDailyLoss) {
        logger.warn(`Daily loss limit reached: ${this.dailyPnL}`)
        return false
      }

      // Check drawdown limit
      const balances = await this.api.getBalances()
      const usdtBalance = balances.find((b) => b.asset === "USDT")

      if (usdtBalance && this.initialBalance > 0) {
        const currentDrawdown = 1 - usdtBalance.total / this.initialBalance
        this.currentDrawdown = currentDrawdown

        if (currentDrawdown > this.config.riskParameters.maxDrawdownPercent / 100) {
          logger.warn(`Max drawdown reached: ${currentDrawdown * 100}%`)
          return false
        }
      }

      // Check max open positions if specified in futures risk parameters
      if (this.config.riskParameters as FuturesRiskParameters) {
        const futuresRisk = this.config.riskParameters as FuturesRiskParameters
        if (futuresRisk.maxOpenPositions) {
          const positions = await this.api.getPositions()
          if (positions.length >= futuresRisk.maxOpenPositions) {
            logger.warn(`Max open positions reached: ${positions.length}`)
            return false
          }
        }
      }

      return true
    } catch (error) {
      logger.error("Failed to check risk parameters", error)
      return false
    }
  }

  // Get account balances
  async getBalances(): Promise<FuturesAccountBalance[]> {
    return this.api.getBalances()
  }

  // Get open positions
  async getPositions(): Promise<Position[]> {
    return this.api.getPositions()
  }

  // Get open orders
  async getOpenOrders(symbol?: string): Promise<Order[]> {
    const orders = await this.api.getOpenOrders(symbol)
    return orders.map((order: any) => this.mapOrderResponse(order))
  }

  // Cancel all open orders for a symbol
  async cancelAllOrders(symbol: string): Promise<boolean> {
    return this.api.cancelAllOrders(symbol)
  }

  // Get current price for a symbol
  async getCurrentPrice(symbol: string): Promise<number> {
    return this.api.getCurrentPrice(symbol)
  }

  // Get funding rate for a symbol
  async getFundingRate(symbol: string): Promise<any> {
    return this.api.getFundingRate(symbol)
  }

  // Change leverage for a symbol
  async changeLeverage(symbol: string, leverage: number): Promise<any> {
    return this.api.changeLeverage(symbol, leverage)
  }

  // Change margin type for a symbol
  async changeMarginType(symbol: string, marginType: "ISOLATED" | "CROSSED"): Promise<boolean> {
    return this.api.changeMarginType(symbol, marginType)
  }

  // Get trading configuration
  getConfig(): TradingConfig {
    return this.config
  }

  // Update trading configuration
  updateConfig(config: Partial<TradingConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    }
  }

  // Helper method to map Binance order response to our Order type
  private mapOrderResponse(response: any): Order {
    return {
      id: response.orderId,
      symbol: response.symbol,
      side: response.side,
      type: response.type as any,
      status: response.status as any,
      quantity: Number.parseFloat(response.origQty),
      price: response.price ? Number.parseFloat(response.price) : undefined,
      stopPrice: response.stopPrice ? Number.parseFloat(response.stopPrice) : undefined,
      executedQty: Number.parseFloat(response.executedQty),
      executedPrice: response.avgPrice ? Number.parseFloat(response.avgPrice) : undefined,
      timestamp: response.time || Date.now(),
      clientOrderId: response.clientOrderId,
      reduceOnly: response.reduceOnly,
      positionSide: response.positionSide,
    }
  }
}
