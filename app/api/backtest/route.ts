import { type NextRequest, NextResponse } from "next/server"
import type { BacktestData } from "@/lib/types"
import { queryBART } from "@/lib/huggingface"

// Logger for debugging
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data ? JSON.stringify(data) : "")
  },
  error: (message: string, error: any) => {
    console.error(`[ERROR] ${message}`, error)
  },
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const symbol = searchParams.get("symbol") || "BTCUSDT"
  const useMock = searchParams.get("mock") === "true"

  try {
    logger.info(`Starting backtest for ${symbol}`)

    // Generate mock backtest results
    const backtestData = await generateMockBacktest(symbol)
    logger.info("Backtest completed", backtestData)

    return NextResponse.json(backtestData)
  } catch (error) {
    logger.error("Error running backtest:", error)

    // Determine appropriate status code
    const statusCode =
      error instanceof Error && "status" in error && typeof (error as any).status === "number"
        ? (error as any).status
        : 500

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "An unknown error occurred",
        timestamp: Date.now(),
      },
      { status: statusCode },
    )
  }
}

async function generateMockBacktest(symbol: string): Promise<BacktestData> {
  try {
    // Generate mock backtest metrics
    const totalTrades = 50 + Math.floor(Math.random() * 50)
    const winRate = 0.4 + Math.random() * 0.3
    const profitFactor = 1 + Math.random() * 1.5
    const sharpeRatio = 0.8 + Math.random() * 1.2
    const maxDrawdown = 0.1 + Math.random() * 0.2
    const netProfit = Math.random() * 50 - 10

    // Create a text description for BART to summarize
    const backtestDescription = `
      Trading backtest results for ${symbol}:
      Total Trades: ${totalTrades}
      Win Rate: ${(winRate * 100).toFixed(1)}%
      Profit Factor: ${profitFactor.toFixed(2)}
      Sharpe Ratio: ${sharpeRatio.toFixed(2)}
      Max Drawdown: ${(maxDrawdown * 100).toFixed(1)}%
      Net Profit: ${netProfit.toFixed(2)}%
      
      The strategy was tested over a 6-month period with hourly candles.
      ${winRate > 0.5 ? "The strategy showed promising results." : "The strategy needs further optimization."}
      ${profitFactor > 1.5 ? "The profit factor indicates good risk-reward ratio." : "The profit factor suggests moderate risk-reward."}
      ${sharpeRatio > 1 ? "The Sharpe ratio is acceptable." : "The Sharpe ratio is below optimal levels."}
    `

    let summary = ""

    try {
      // Use BART to generate a summary
      logger.info("Generating backtest summary with BART")
      summary = await queryBART(backtestDescription)
      logger.info(`Generated summary: ${summary}`)
    } catch (error) {
      logger.error("Error generating summary with BART:", error)
      // Fallback summary if BART fails
      summary = `This ${symbol} trading strategy ${
        netProfit > 0 ? "was profitable" : "was not profitable"
      } during the backtest period, with a ${(winRate * 100).toFixed(1)}% win rate and a maximum drawdown of ${(
        maxDrawdown * 100
      ).toFixed(1)}%.`
    }

    return {
      totalTrades,
      winRate,
      profitFactor,
      sharpeRatio,
      maxDrawdown,
      netProfit,
      summary,
    }
  } catch (error) {
    logger.error("Error generating backtest:", error)

    // Return fallback data with error message
    return {
      totalTrades: 0,
      winRate: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      netProfit: 0,
      summary: "Failed to generate backtest summary due to an error.",
    }
  }
}
