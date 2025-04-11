import crypto from "crypto"
import type {
  ApiCredentials,
  MarketOrder,
  LimitOrder,
  StopLossOrder,
  TakeProfitOrder,
  Order,
  Position,
  FuturesAccountBalance,
  TradeExecutionResult,
  FundingRate,
  LeverageInfo,
} from "../types/trading"

// Logger for debugging
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[BINANCE FUTURES API] ${message}`, data ? JSON.stringify(data) : "")
  },
  error: (message: string, error: any) => {
    console.error(`[BINANCE FUTURES API] ${message}`, error)
  },
}

export class BinanceFuturesApiError extends Error {
  code?: number

  constructor(message: string, code?: number) {
    super(message)
    this.name = "BinanceFuturesApiError"
    this.code = code
  }
}

export class BinanceFuturesApi {
  private apiKey: string
  private apiSecret: string
  private baseUrl: string

  constructor(credentials: ApiCredentials) {
    this.apiKey = credentials.apiKey
    this.apiSecret = credentials.apiSecret

    // Use testnet if specified
    this.baseUrl = credentials.testnet ? "https://testnet.binancefuture.com/fapi" : "https://fapi.binance.com/fapi"
  }

  // Generate signature for authenticated requests
  private generateSignature(queryString: string): string {
    return crypto.createHmac("sha256", this.apiSecret).update(queryString).digest("hex")
  }

  // Make a public request (no authentication required)
  private async publicRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    try {
      const queryString = new URLSearchParams(params).toString()
      const url = `${this.baseUrl}${endpoint}${queryString ? `?${queryString}` : ""}`

      logger.info(`Making public request to ${endpoint}`)

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const error = await response.json()
        logger.error(`Public request failed: ${error.msg || response.statusText}`, error)
        throw new BinanceFuturesApiError(error.msg || "Public request failed", error.code)
      }

      return await response.json()
    } catch (error) {
      if (error instanceof BinanceFuturesApiError) {
        throw error
      }

      logger.error(
        `Unexpected error in public request: ${error instanceof Error ? error.message : String(error)}`,
        error,
      )
      throw new BinanceFuturesApiError(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Make an authenticated request (requires API key and signature)
  private async privateRequest(
    endpoint: string,
    params: Record<string, any> = {},
    method: "GET" | "POST" | "DELETE" = "GET",
  ): Promise<any> {
    try {
      // Add timestamp parameter required for signature
      const timestamp = Date.now()
      const queryParams = {
        ...params,
        timestamp,
      }

      // Create query string and signature
      const queryString = new URLSearchParams(
        Object.entries(queryParams).map(([key, value]) => [key, String(value)]),
      ).toString()

      const signature = this.generateSignature(queryString)

      // Add signature to query string
      const fullQueryString = `${queryString}&signature=${signature}`

      // Construct URL
      const url = `${this.baseUrl}${endpoint}?${fullQueryString}`

      logger.info(`Making private ${method} request to ${endpoint}`)

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-MBX-APIKEY": this.apiKey,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        logger.error(`Private request failed: ${error.msg || response.statusText}`, error)
        throw new BinanceFuturesApiError(error.msg || "Private request failed", error.code)
      }

      return await response.json()
    } catch (error) {
      if (error instanceof BinanceFuturesApiError) {
        throw error
      }

      logger.error(
        `Unexpected error in private request: ${error instanceof Error ? error.message : String(error)}`,
        error,
      )
      throw new BinanceFuturesApiError(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Get server time
  async getServerTime(): Promise<number> {
    const response = await this.publicRequest("/v1/time")
    return response.serverTime
  }

  // Get exchange information
  async getExchangeInfo(): Promise<any> {
    return this.publicRequest("/v1/exchangeInfo")
  }

  // Get account information
  async getAccountInfo(): Promise<any> {
    return this.privateRequest("/v2/account")
  }

  // Get account balances
  async getBalances(): Promise<FuturesAccountBalance[]> {
    const account = await this.privateRequest("/v2/account")

    return account.assets.map((asset: any) => ({
      asset: asset.asset,
      free: Number.parseFloat(asset.availableBalance),
      locked: Number.parseFloat(asset.initialMargin),
      total: Number.parseFloat(asset.walletBalance),
      crossUnPnl: Number.parseFloat(asset.crossUnPnl),
      availableBalance: Number.parseFloat(asset.availableBalance),
    }))
  }

  // Get open positions
  async getPositions(): Promise<Position[]> {
    const account = await this.privateRequest("/v2/account")

    return account.positions
      .filter((position: any) => Number.parseFloat(position.positionAmt) !== 0)
      .map((position: any) => ({
        symbol: position.symbol,
        positionSide: position.positionSide,
        quantity: Math.abs(Number.parseFloat(position.positionAmt)),
        entryPrice: Number.parseFloat(position.entryPrice),
        markPrice: Number.parseFloat(position.markPrice),
        pnl: Number.parseFloat(position.unrealizedProfit),
        pnlPercent:
          (Number.parseFloat(position.unrealizedProfit) /
            (Number.parseFloat(position.isolatedWallet) || Number.parseFloat(position.positionInitialMargin))) *
          100,
        liquidationPrice: Number.parseFloat(position.liquidationPrice),
        leverage: Number.parseFloat(position.leverage),
        marginType: position.marginType,
        isolatedMargin: position.marginType === "isolated" ? Number.parseFloat(position.isolatedWallet) : undefined,
        unrealizedPnl: Number.parseFloat(position.unrealizedProfit),
      }))
  }

  // Get open orders
  async getOpenOrders(symbol?: string): Promise<any[]> {
    const params: Record<string, any> = {}
    if (symbol) {
      params.symbol = symbol
    }

    return this.privateRequest("/v1/openOrders", params)
  }

  // Get order status
  async getOrder(symbol: string, orderId: string): Promise<any> {
    return this.privateRequest("/v1/order", { symbol, orderId })
  }

  // Place a market order
  async placeMarketOrder(order: MarketOrder): Promise<TradeExecutionResult> {
    try {
      const params: Record<string, any> = {
        symbol: order.symbol,
        side: order.side,
        type: "MARKET",
        quantity: order.quantity,
      }

      // If quoteOrderQty is provided, use it instead of quantity
      if (order.quoteOrderQty) {
        delete params.quantity
        params.quoteOrderQty = order.quoteOrderQty
      }

      // Add futures-specific parameters if provided
      if (order.reduceOnly !== undefined) {
        params.reduceOnly = order.reduceOnly
      }

      if (order.positionSide) {
        params.positionSide = order.positionSide
      }

      const response = await this.privateRequest("/v1/order", params, "POST")

      return {
        success: true,
        orderId: response.orderId,
        order: this.mapOrderResponse(response),
      }
    } catch (error) {
      logger.error(`Failed to place market order: ${error instanceof Error ? error.message : String(error)}`, error)

      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // Place a limit order
  async placeLimitOrder(order: LimitOrder): Promise<TradeExecutionResult> {
    try {
      const params: Record<string, any> = {
        symbol: order.symbol,
        side: order.side,
        type: "LIMIT",
        timeInForce: order.timeInForce,
        quantity: order.quantity,
        price: order.price,
      }

      // Add futures-specific parameters if provided
      if (order.reduceOnly !== undefined) {
        params.reduceOnly = order.reduceOnly
      }

      if (order.positionSide) {
        params.positionSide = order.positionSide
      }

      const response = await this.privateRequest("/v1/order", params, "POST")

      return {
        success: true,
        orderId: response.orderId,
        order: this.mapOrderResponse(response),
      }
    } catch (error) {
      logger.error(`Failed to place limit order: ${error instanceof Error ? error.message : String(error)}`, error)

      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // Place a stop loss order
  async placeStopLossOrder(order: StopLossOrder): Promise<TradeExecutionResult> {
    try {
      const params: Record<string, any> = {
        symbol: order.symbol,
        side: order.side,
        type: "STOP",
        timeInForce: "GTC",
        quantity: order.quantity,
        price: order.price,
        stopPrice: order.stopPrice,
        workingType: "MARK_PRICE", // Use mark price for triggering
      }

      // Add futures-specific parameters if provided
      if (order.reduceOnly !== undefined) {
        params.reduceOnly = order.reduceOnly
      }

      if (order.positionSide) {
        params.positionSide = order.positionSide
      }

      const response = await this.privateRequest("/v1/order", params, "POST")

      return {
        success: true,
        orderId: response.orderId,
        order: this.mapOrderResponse(response),
      }
    } catch (error) {
      logger.error(`Failed to place stop loss order: ${error instanceof Error ? error.message : String(error)}`, error)

      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // Place a take profit order
  async placeTakeProfitOrder(order: TakeProfitOrder): Promise<TradeExecutionResult> {
    try {
      const params: Record<string, any> = {
        symbol: order.symbol,
        side: order.side,
        type: "TAKE_PROFIT",
        timeInForce: "GTC",
        quantity: order.quantity,
        price: order.price,
        stopPrice: order.stopPrice,
        workingType: "MARK_PRICE", // Use mark price for triggering
      }

      // Add futures-specific parameters if provided
      if (order.reduceOnly !== undefined) {
        params.reduceOnly = order.reduceOnly
      }

      if (order.positionSide) {
        params.positionSide = order.positionSide
      }

      const response = await this.privateRequest("/v1/order", params, "POST")

      return {
        success: true,
        orderId: response.orderId,
        order: this.mapOrderResponse(response),
      }
    } catch (error) {
      logger.error(
        `Failed to place take profit order: ${error instanceof Error ? error.message : String(error)}`,
        error,
      )

      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // Cancel an order
  async cancelOrder(symbol: string, orderId: string): Promise<boolean> {
    try {
      await this.privateRequest("/v1/order", { symbol, orderId }, "DELETE")
      return true
    } catch (error) {
      logger.error(`Failed to cancel order: ${error instanceof Error ? error.message : String(error)}`, error)
      return false
    }
  }

  // Cancel all open orders for a symbol
  async cancelAllOrders(symbol: string): Promise<boolean> {
    try {
      await this.privateRequest("/v1/allOpenOrders", { symbol }, "DELETE")
      return true
    } catch (error) {
      logger.error(`Failed to cancel all orders: ${error instanceof Error ? error.message : String(error)}`, error)
      return false
    }
  }

  // Get current price for a symbol
  async getCurrentPrice(symbol: string): Promise<number> {
    const ticker = await this.publicRequest("/v1/ticker/price", { symbol })
    return Number.parseFloat(ticker.price)
  }

  // Get current prices for all symbols
  async getAllPrices(): Promise<Record<string, number>> {
    const tickers = await this.publicRequest("/v1/ticker/price")

    return tickers.reduce((acc: Record<string, number>, ticker: any) => {
      acc[ticker.symbol] = Number.parseFloat(ticker.price)
      return acc
    }, {})
  }

  // Get funding rate
  async getFundingRate(symbol: string): Promise<FundingRate> {
    const data = await this.publicRequest("/v1/premiumIndex", { symbol })

    return {
      symbol: data.symbol,
      markPrice: Number.parseFloat(data.markPrice),
      indexPrice: Number.parseFloat(data.indexPrice),
      estimatedSettlePrice: Number.parseFloat(data.estimatedSettlePrice),
      lastFundingRate: Number.parseFloat(data.lastFundingRate),
      nextFundingTime: data.nextFundingTime,
      interestRate: Number.parseFloat(data.interestRate),
    }
  }

  // Change leverage
  async changeLeverage(symbol: string, leverage: number): Promise<LeverageInfo> {
    const data = await this.privateRequest("/v1/leverage", { symbol, leverage }, "POST")

    return {
      symbol: data.symbol,
      leverage: Number.parseFloat(data.leverage),
      maxNotionalValue: Number.parseFloat(data.maxNotionalValue),
    }
  }

  // Change margin type
  async changeMarginType(symbol: string, marginType: "ISOLATED" | "CROSSED"): Promise<boolean> {
    try {
      await this.privateRequest("/v1/marginType", { symbol, marginType }, "POST")
      return true
    } catch (error) {
      logger.error(`Failed to change margin type: ${error instanceof Error ? error.message : String(error)}`, error)
      return false
    }
  }

  // Get position information
  async getPositionInfo(symbol: string): Promise<Position | null> {
    try {
      const positions = await this.getPositions()
      return positions.find((position) => position.symbol === symbol) || null
    } catch (error) {
      logger.error(`Failed to get position info: ${error instanceof Error ? error.message : String(error)}`, error)
      return null
    }
  }

  // Change position mode (Hedge Mode vs. One-way Mode)
  async changePositionMode(dualSidePosition: boolean): Promise<boolean> {
    try {
      await this.privateRequest("/v1/positionSide/dual", { dualSidePosition }, "POST")
      return true
    } catch (error) {
      logger.error(`Failed to change position mode: ${error instanceof Error ? error.message : String(error)}`, error)
      return false
    }
  }

  // Helper method to map Binance order response to our Order type
  private mapOrderResponse(response: any): Order {
    return {
      id: response.orderId,
      symbol: response.symbol,
      side: response.side,
      type: response.type,
      status: response.status,
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
