import { type NextRequest, NextResponse } from "next/server"
import { TradingManager } from "@/lib/services/trading-manager"

export async function POST(request: NextRequest) {
  try {
    const { symbol, leverage } = await request.json()

    if (!symbol || !leverage) {
      return NextResponse.json({ error: "Symbol and leverage are required" }, { status: 400 })
    }

    const tradingManager = TradingManager.getInstance()

    if (!tradingManager.isInitialized()) {
      return NextResponse.json({ error: "Trading service not initialized" }, { status: 400 })
    }

    // Check if futures trading is enabled
    const config = tradingManager.getConfig()
    if (!config.isFutures) {
      return NextResponse.json({ error: "Futures trading is not enabled" }, { status: 400 })
    }

    const result = await tradingManager.changeLeverage(symbol, leverage)

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    console.error("Error changing leverage:", error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
