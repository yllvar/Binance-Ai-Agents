import { type NextRequest, NextResponse } from "next/server"
import { TradingManager } from "@/lib/services/trading-manager"
import type { TradingMode } from "@/lib/types/trading"

export async function GET(request: NextRequest) {
  try {
    const tradingManager = TradingManager.getInstance()

    if (!tradingManager.isInitialized()) {
      return NextResponse.json({ error: "Trading service not initialized" }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      mode: tradingManager.getTradingMode(),
    })
  } catch (error) {
    console.error("Error getting trading mode:", error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { mode } = await request.json()

    if (!mode || (mode !== "spot" && mode !== "futures")) {
      return NextResponse.json({ error: "Invalid trading mode. Must be 'spot' or 'futures'" }, { status: 400 })
    }

    const tradingManager = TradingManager.getInstance()

    if (!tradingManager.isInitialized()) {
      return NextResponse.json({ error: "Trading service not initialized" }, { status: 400 })
    }

    const success = await tradingManager.switchTradingMode(mode as TradingMode)

    if (!success) {
      return NextResponse.json({ error: `Failed to switch to ${mode} trading mode` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      mode,
      message: `Successfully switched to ${mode} trading mode`,
    })
  } catch (error) {
    console.error("Error switching trading mode:", error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
