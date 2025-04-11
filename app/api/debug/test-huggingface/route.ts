import { type NextRequest, NextResponse } from "next/server"
import { queryDistilBERT, queryFLANT5, queryBART, queryTapas } from "@/lib/huggingface"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const symbol = searchParams.get("symbol") || "BTCUSDT"

  try {
    console.log("[DEBUG] Testing Hugging Face connection")

    // Test results for each model
    const results = {
      distilbert: null,
      flant5: null,
      bart: null,
      tapas: null,
      errors: [] as string[],
    }

    // Test DistilBERT
    try {
      console.log("[DEBUG] Testing DistilBERT")
      const sentiment = await queryDistilBERT(`Testing sentiment analysis for ${symbol} trading.`)
      results.distilbert = { sentiment }
    } catch (error) {
      console.error("[DEBUG] DistilBERT test failed:", error)
      results.errors.push(`DistilBERT: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Test FLAN-T5
    try {
      console.log("[DEBUG] Testing FLAN-T5")
      const decision = await queryFLANT5(`Should I buy or sell ${symbol}? Respond with BUY, SELL, or HOLD.`)
      results.flant5 = { decision }
    } catch (error) {
      console.error("[DEBUG] FLAN-T5 test failed:", error)
      results.errors.push(`FLAN-T5: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Test BART
    try {
      console.log("[DEBUG] Testing BART")
      const summary = await queryBART(
        `${symbol} is a cryptocurrency trading pair on Binance. It has shown volatility in recent weeks.`,
      )
      results.bart = { summary }
    } catch (error) {
      console.error("[DEBUG] BART test failed:", error)
      results.errors.push(`BART: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Test Tapas
    try {
      console.log("[DEBUG] Testing Tapas")
      const table = {
        Date: ["2023-01-01", "2023-01-02", "2023-01-03"],
        Price: ["20000", "21000", "19500"],
        Volume: ["1000", "1200", "800"],
      }
      const answer = await queryTapas("What was the highest price?", table)
      results.tapas = { answer }
    } catch (error) {
      console.error("[DEBUG] Tapas test failed:", error)
      results.errors.push(`Tapas: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Determine overall status - consider it a success if at least one model works
    const success = Object.values(results).some((val) => val !== null && !Array.isArray(val))

    return NextResponse.json({
      success,
      timestamp: Date.now(),
      results,
      message: success
        ? "Some models are working correctly"
        : "All models failed - Hugging Face service may be unavailable",
    })
  } catch (error) {
    console.error("[DEBUG] Error testing Hugging Face connection:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred",
        timestamp: Date.now(),
        message: "Failed to test Hugging Face connection",
      },
      { status: 500 },
    )
  }
}
