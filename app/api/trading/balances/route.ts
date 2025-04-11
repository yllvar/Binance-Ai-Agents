import { type NextRequest, NextResponse } from "next/server"
import { TradingManager } from "@/lib/services/trading-manager"

export async function GET(request: NextRequest) {
  try {
    const tradingManager = TradingManager.getInstance()

    if (!tradingManager.isInitialized()) {
      return NextResponse.json({ error: "Trading service not initialized" }, { status: 400 })
    }

    const balances = await tradingManager.getBalances()

    return NextResponse.json({
      success: true,
      balances,
    })
  } catch (error) {
    console.error("Error fetching balances:", error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
