import { type NextRequest, NextResponse } from "next/server"
import { TradingManager } from "@/lib/services/trading-manager"
import type { ApiCredentials, TradingConfig } from "@/lib/types/trading"

export async function POST(request: NextRequest) {
  try {
    const { apiKey, apiSecret, testMode, isFutures, config } = await request.json()

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: "API key and secret are required" }, { status: 400 })
    }

    const credentials: ApiCredentials = {
      apiKey,
      apiSecret,
      testnet: testMode === true,
    }

    // Get default config based on trading type
    const defaultConfig = TradingManager.getDefaultConfig(isFutures === true)

    const tradingConfig: Partial<TradingConfig> = {
      testMode: testMode === true,
      isFutures: isFutures === true,
      ...config,
    }

    const tradingManager = TradingManager.getInstance()
    const success = await tradingManager.initialize(credentials, tradingConfig)

    if (!success) {
      return NextResponse.json({ error: "Failed to initialize trading service" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `${isFutures ? "Futures" : "Spot"} trading service initialized successfully`,
      config: tradingManager.getConfig(),
    })
  } catch (error) {
    console.error("Error initializing trading service:", error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
