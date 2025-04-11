import { TradingService } from "./trading-service"
import { FuturesTradingService } from "./futures-trading-service"
import type {
  ApiCredentials,
  TradingConfig,
  TradingMode,
  RiskParameters,
  FuturesRiskParameters,
  Order,
  Position,
  AccountBalance,
  FuturesAccountBalance,
  TradeExecutionResult,
} from "../types/trading"

// Default risk parameters
const DEFAULT_RISK_PARAMETERS: RiskParameters = {
  maxPositionSize: 100, // $100 USDT
  maxLeverage: 1, // No leverage
  stopLossPercent: 2, // 2% stop loss
  takeProfitPercent: 4, // 4% take profit
  maxDailyLoss: 200, // $200 USDT max daily loss
  maxDrawdownPercent: 10, // 10% max drawdown
}

// Default futures risk parameters
const DEFAULT_FUTURES_RISK_PARAMETERS: FuturesRiskParameters = {
  ...DEFAULT_RISK_PARAMETERS,
  marginType: "ISOLATED", // Default to isolated margin
  defaultLeverage: 3, // Default leverage
  maxOpenPositions: 5, // Maximum number of open positions
  maxLossPerPosition: 50, // Maximum loss per position in USDT
}

// Default trading configuration
const DEFAULT_TRADING_CONFIG: TradingConfig = {
  enabled: false, // Disabled by default for safety
  testMode: true, // Test mode by default
  tradingMode: "spot", // Default to spot trading
  riskParameters: DEFAULT_RISK_PARAMETERS,
  allowedSymbols: ["BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "DOGEUSDT"],
  futuresConfig: {
    hedgeMode: false,
    marginType: "ISOLATED",
    defaultLeverage: 3,
    riskParameters: DEFAULT_FUTURES_RISK_PARAMETERS,
  },
}

// Singleton instance
let instance: TradingManager | null = null

export class TradingManager {
  private spotTradingService: TradingService | null = null
  private futuresTradingService: FuturesTradingService | null = null
  private config: TradingConfig = DEFAULT_TRADING_CONFIG
  private credentials: ApiCredentials | null = null
  private initialized = false

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  // Get singleton instance
  static getInstance(): TradingManager {
    if (!instance) {
      instance = new TradingManager()
    }
    return instance
  }

  // Initialize the trading manager with API credentials
  async initialize(credentials: ApiCredentials, config?: Partial<TradingConfig>): Promise<boolean> {
    try {
      // Store credentials for later use
      this.credentials = credentials

      // Update config with provided values
      if (config) {
        this.config = {
          ...this.config,
          ...config,
        }
      }

      // Initialize the appropriate trading service based on mode
      const success = await this.initializeCurrentMode()
      this.initialized = success

      return success
    } catch (error) {
      console.error("Failed to initialize trading manager", error)
      this.initialized = false
      return false
    }
  }

  // Initialize the current trading mode
  private async initializeCurrentMode(): Promise<boolean> {
    if (!this.credentials) {
      return false
    }

    try {
      if (this.config.tradingMode === "futures") {
        // Initialize futures trading
        if (!this.futuresTradingService) {
          this.futuresTradingService = new FuturesTradingService(this.credentials, this.config)
        }
        return await this.futuresTradingService.initialize()
      } else {
        // Initialize spot trading
        if (!this.spotTradingService) {
          this.spotTradingService = new TradingService(this.credentials, this.config)
        }
        return await this.spotTradingService.initialize()
      }
    } catch (error) {
      console.error(`Failed to initialize ${this.config.tradingMode} trading service`, error)
      return false
    }
  }

  // Switch trading mode
  async switchTradingMode(mode: TradingMode): Promise<boolean> {
    if (this.config.tradingMode === mode) {
      return true // Already in this mode
    }

    // Update config
    this.config.tradingMode = mode

    // Initialize the new mode
    return await this.initializeCurrentMode()
  }

  // Get the active trading service
  private getActiveTradingService(): TradingService | FuturesTradingService | null {
    return this.config.tradingMode === "futures" ? this.futuresTradingService : this.spotTradingService
  }

  // Check if trading manager is initialized
  isInitialized(): boolean {
    return this.initialized
  }

  // Get current trading mode
  getTradingMode(): TradingMode {
    return this.config.tradingMode
  }

  // Execute a trade based on AI recommendation
  async executeTrade(
    symbol: string,
    action: "BUY" | "SELL" | "HOLD",
    confidence: number,
  ): Promise<TradeExecutionResult> {
    const tradingService = this.getActiveTradingService()

    if (!tradingService || !this.initialized) {
      return {
        success: false,
        errorMessage: "Trading service not initialized",
      }
    }

    return tradingService.executeTrade(symbol, action, confidence)
  }

  // Get account balances
  async getBalances(): Promise<AccountBalance[] | FuturesAccountBalance[]> {
    const tradingService = this.getActiveTradingService()

    if (!tradingService || !this.initialized) {
      return []
    }

    return tradingService.getBalances()
  }

  // Get open positions (futures only)
  async getPositions(): Promise<Position[]> {
    if (!this.futuresTradingService || !this.initialized || this.config.tradingMode !== "futures") {
      return []
    }

    return this.futuresTradingService.getPositions()
  }

  // Get open orders
  async getOpenOrders(symbol?: string): Promise<Order[]> {
    const tradingService = this.getActiveTradingService()

    if (!tradingService || !this.initialized) {
      return []
    }

    return tradingService.getOpenOrders(symbol)
  }

  // Cancel all open orders for a symbol
  async cancelAllOrders(symbol: string): Promise<boolean> {
    const tradingService = this.getActiveTradingService()

    if (!tradingService || !this.initialized) {
      return false
    }

    return tradingService.cancelAllOrders(symbol)
  }

  // Get current price for a symbol
  async getCurrentPrice(symbol: string): Promise<number> {
    const tradingService = this.getActiveTradingService()

    if (!tradingService || !this.initialized) {
      return 0
    }

    return tradingService.getCurrentPrice(symbol)
  }

  // Get funding rate for a symbol (futures only)
  async getFundingRate(symbol: string): Promise<any> {
    if (!this.futuresTradingService || !this.initialized || this.config.tradingMode !== "futures") {
      return null
    }

    return this.futuresTradingService.getFundingRate(symbol)
  }

  // Change leverage for a symbol (futures only)
  async changeLeverage(symbol: string, leverage: number): Promise<any> {
    if (!this.futuresTradingService || !this.initialized || this.config.tradingMode !== "futures") {
      return null
    }

    return this.futuresTradingService.changeLeverage(symbol, leverage)
  }

  // Change margin type for a symbol (futures only)
  async changeMarginType(symbol: string, marginType: "ISOLATED" | "CROSSED"): Promise<boolean> {
    if (!this.futuresTradingService || !this.initialized || this.config.tradingMode !== "futures") {
      return false
    }

    return this.futuresTradingService.changeMarginType(symbol, marginType)
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

    // Update the active trading service
    const tradingService = this.getActiveTradingService()
    if (tradingService) {
      tradingService.updateConfig(this.config)
    }
  }

  // Get default trading configuration
  static getDefaultConfig(): TradingConfig {
    return DEFAULT_TRADING_CONFIG
  }
}
