import { type NextRequest, NextResponse } from "next/server"
import type { Trade } from "@/lib/types"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const symbol = searchParams.get("symbol") || "BTCUSDT"

  try {
    // In a real app, this would fetch from a database
    // For demo purposes, we'll generate mock data
    const trades: Trade[] = generateMockTrades(symbol)

    return NextResponse.json(trades)
  } catch (error) {
    console.error("Error fetching trade history:", error)
    return NextResponse.json({ error: "Failed to fetch trade history" }, { status: 500 })
  }
}

function generateMockTrades(symbol: string): Trade[] {
  const trades: Trade[] = []
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000

  // Generate 10 mock trades over the past 10 days
  for (let i = 0; i < 10; i++) {
    const action = Math.random() > 0.5 ? "BUY" : "SELL"
    const timestamp = now - i * day
    const price = 30000 + (Math.random() * 5000 - 2500)
    const risk = 0.2 + Math.random() * 0.6
    const profit = action === "BUY" ? Math.random() * 10 - 3 : Math.random() * 10 - 7

    trades.push({
      id: `trade-${i}`,
      symbol,
      action,
      price,
      timestamp,
      risk,
      profit,
    })
  }

  return trades
}
