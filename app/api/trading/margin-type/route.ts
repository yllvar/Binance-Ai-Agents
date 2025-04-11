import { type NextRequest, NextResponse } from "next/server"
import { TradingManager } from "@/lib/services/trading-manager"

export async function POST(request: NextRequest) {
  try {
    const { symbol, marginType } = await request.json()

    if (!symbol || !marginType) {
      return NextResponse.json({ error: "Symbol and marginType are required" }, { status: 400 })
    }

    if (marginType !== "ISOLATED" && marginType !== "CROSSED") {
      return NextResponse.json({ error: "marginType must be ISOLATED or CROSSED" }, { status: 400 })
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

    const success = await tradingManager.changeMarginType(symbol, marginType)

    return NextResponse.json({
      success,
      message: success ? "Margin type changed successfully" : "Failed to change margin type",
    })
  } catch (error) {
    console.error("Error changing margin type:", error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
