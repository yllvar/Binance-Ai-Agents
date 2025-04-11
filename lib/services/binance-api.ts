import crypto from "crypto"
import type {
  ApiCredentials,
  MarketOrder,
  LimitOrder,
  StopLossOrder,
  TakeProfitOrder,
  Order,
  AccountBalance,
  TradeExecutionResult,
} from "../types/trading"

// Logger for debugging
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[BINANCE API] ${message}`, data ? JSON.stringify(data) : "")
  },
  error: (message: string, error: any) => {
    console.error(`[BINANCE API] ${message}`, error)
  },
}

export class BinanceApiError extends Error {
  code?: number

  constructor(message: string, code?: number) {
    super(message)
    this.name = "BinanceApiError"
    this.code = code
  }
}

export class BinanceApi {
  private apiKey: string
  private apiSecret: string
  private baseUrl: string

  constructor(credentials: ApiCredentials) {
    this.apiKey = credentials.apiKey
    this.apiSecret = credentials.apiSecret

    // Use testnet if specified
    this.baseUrl = credentials.testnet ? "https://testnet.binance.vision/api" : "https://api.binance.com/api"
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
        throw new BinanceApiError(error.msg || "Public request failed", error.code)
      }

      return await response.json()
    } catch (error) {
      if (error instanceof BinanceApiError) {
        throw error
      }

      logger.error(
        `Unexpected error in public request: ${error instanceof Error ? error.message : String(error)}`,
        error,
      )
      throw new BinanceApiError(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`)
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
        throw new BinanceApiError(error.msg || "Private request failed", error.code)
      }

      return await response.json()
    } catch (error) {
      if (error instanceof BinanceApiError) {
        throw error
      }

      logger.error(
        `Unexpected error in private request: ${error instanceof Error ? error.message : String(error)}`,
        error,
      )
      throw new BinanceApiError(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Get server time
  async getServerTime(): Promise<number> {
    const response = await this.publicRequest("/v3/time")
    return response.serverTime
  }

  // Get exchange information
  async getExchangeInfo(): Promise<any> {
    return this.publicRequest("/v3/exchangeInfo")
  }

  // Get account information
  async getAccountInfo(): Promise<any> {
    return this.privateRequest("/v3/account")
  }

  // Get account balances
  async getBalances(): Promise<AccountBalance[]> {
    const account = await this.privateRequest("/v3/account")

    return account.balances.map((balance: any) => ({
      asset: balance.asset,
      free: Number.parseFloat(balance.free),
      locked: Number.parseFloat(balance.locked),
      total: Number.parseFloat(balance.free) + Number.parseFloat(balance.locked),
    }))
  }

  // Get open orders
  async getOpenOrders(symbol?: string): Promise<any[]> {
    const params: Record<string, any> = {}
    if (symbol) {
      params.symbol = symbol
    }

    return this.privateRequest("/v3/openOrders", params)
  }

  // Get order status
  async getOrder(symbol: string, orderId: string): Promise<any> {
    return this.privateRequest("/v3/order", { symbol, orderId })
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

      const response = await this.privateRequest("/v3/order", params, "POST")

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
      const params = {
        symbol: order.symbol,
        side: order.side,
        type: "LIMIT",
        timeInForce: order.timeInForce,
        quantity: order.quantity,
        price: order.price,
      }

      const response = await this.privateRequest("/v3/order", params, "POST")

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
      const params = {
        symbol: order.symbol,
        side: order.side,
        type: "STOP_LOSS_LIMIT",
        timeInForce: "GTC",
        quantity: order.quantity,
        price: order.price,
        stopPrice: order.stopPrice,
      }

      const response = await this.privateRequest("/v3/order", params, "POST")

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
      const params = {
        symbol: order.symbol,
        side: order.side,
        type: "TAKE_PROFIT_LIMIT",
        timeInForce: "GTC",
        quantity: order.quantity,
        price: order.price,
        stopPrice: order.stopPrice,
      }

      const response = await this.privateRequest("/v3/order", params, "POST")

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
      await this.privateRequest("/v3/order", { symbol, orderId }, "DELETE")
      return true
    } catch (error) {
      logger.error(`Failed to cancel order: ${error instanceof Error ? error.message : String(error)}`, error)
      return false
    }
  }

  // Cancel all open orders for a symbol
  async cancelAllOrders(symbol: string): Promise<boolean> {
    try {
      await this.privateRequest("/v3/openOrders", { symbol }, "DELETE")
      return true
    } catch (error) {
      logger.error(`Failed to cancel all orders: ${error instanceof Error ? error.message : String(error)}`, error)
      return false
    }
  }

  // Get recent trades for a symbol
  async getRecentTrades(symbol: string, limit = 500): Promise<any[]> {
    return this.publicRequest("/v3/trades", { symbol, limit })
  }

  // Get historical trades for a symbol
  async getHistoricalTrades(symbol: string, limit = 500, fromId?: string): Promise<any[]> {
    const params: Record<string, any> = { symbol, limit }
    if (fromId) {
      params.fromId = fromId
    }

    return this.privateRequest("/v3/historicalTrades", params)
  }

  // Get current price for a symbol
  async getCurrentPrice(symbol: string): Promise<number> {
    const ticker = await this.publicRequest("/v3/ticker/price", { symbol })
    return Number.parseFloat(ticker.price)
  }

  // Get current prices for all symbols
  async getAllPrices(): Promise<Record<string, number>> {
    const tickers = await this.publicRequest("/v3/ticker/price")

    return tickers.reduce((acc: Record<string, number>, ticker: any) => {
      acc[ticker.symbol] = Number.parseFloat(ticker.price)
      return acc
    }, {})
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
      executedPrice: response.cummulativeQuoteQty
        ? Number.parseFloat(response.cummulativeQuoteQty) / Number.parseFloat(response.executedQty)
        : undefined,
      timestamp: response.time || Date.now(),
      clientOrderId: response.clientOrderId,
    }
  }
}
