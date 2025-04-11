import { type NextRequest, NextResponse } from "next/server"
import { TradingManager } from "@/lib/services/trading-manager"

export async function POST(request: NextRequest) {
  try {
    const { symbol, action, confidence } = await request.json()

    if (!symbol || !action) {
      return NextResponse.json({ error: "Symbol and action are required" }, { status: 400 })
    }

    if (!["BUY", "SELL", "HOLD"].includes(action)) {
      return NextResponse.json({ error: "Action must be BUY, SELL, or HOLD" }, { status: 400 })
    }

    const tradingManager = TradingManager.getInstance()

    if (!tradingManager.isInitialized()) {
      return NextResponse.json({ error: "Trading service not initialized" }, { status: 400 })
    }

    const result = await tradingManager.executeTrade(symbol, action as "BUY" | "SELL" | "HOLD", confidence || 0.5)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error executing trade:", error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
