import { type NextRequest, NextResponse } from "next/server"
import { TradingManager } from "@/lib/services/trading-manager"

export async function GET(request: NextRequest) {
  try {
    const tradingManager = TradingManager.getInstance()
    const config = tradingManager.getConfig()

    return NextResponse.json({
      success: true,
      config,
    })
  } catch (error) {
    console.error("Error fetching trading config:", error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const config = await request.json()

    const tradingManager = TradingManager.getInstance()
    tradingManager.updateConfig(config)

    return NextResponse.json({
      success: true,
      message: "Trading configuration updated successfully",
      config: tradingManager.getConfig(),
    })
  } catch (error) {
    console.error("Error updating trading config:", error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
