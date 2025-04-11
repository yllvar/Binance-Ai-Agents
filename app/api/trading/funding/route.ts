import { type NextRequest, NextResponse } from "next/server"
import { TradingManager } from "@/lib/services/trading-manager"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const symbol = searchParams.get("symbol")

    if (!symbol) {
      return NextResponse.json({ error: "Symbol is required" }, { status: 400 })
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

    const fundingRate = await tradingManager.getFundingRate(symbol)

    return NextResponse.json({
      success: true,
      fundingRate,
    })
  } catch (error) {
    console.error("Error fetching funding rate:", error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
