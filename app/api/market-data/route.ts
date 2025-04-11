import { type NextRequest, NextResponse } from "next/server"
import { calculateIndicators } from "@/lib/market-data"
import { generateMockMarketData } from "@/lib/utils/mock-data"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const symbol = searchParams.get("symbol") || "BTCUSDT"
  const timeframe = searchParams.get("timeframe") || "1h"
  const limit = searchParams.get("limit") || "100"
  const useMock = searchParams.get("mock") === "true"
  const marketType = searchParams.get("marketType") || "spot" // New parameter for market type

  try {
    // If mock parameter is provided, return mock data
    if (useMock) {
      console.log(`Generating mock data for ${symbol} with timeframe ${timeframe} (${marketType})`)
      const mockData = generateMockMarketData(symbol, timeframe, Number.parseInt(limit))
      return NextResponse.json(mockData)
    }

    console.log(`Fetching ${marketType} market data for ${symbol} with timeframe ${timeframe}`)

    // Determine the appropriate API endpoint based on market type
    let url: string
    if (marketType === "futures") {
      // Binance Futures API endpoint
      url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${timeframe}&limit=${limit}`
    } else {
      // Default to Binance Spot API endpoint
      url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=${limit}`
    }

    console.log(`Requesting: ${url}`)

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "AI-Trading-Agent/1.0",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Binance API error (${response.status}): ${errorText}`)

      // Fall back to mock data if Binance API fails
      console.log(`Falling back to mock data for ${symbol} (${marketType})`)
      const mockData = generateMockMarketData(symbol, timeframe, Number.parseInt(limit))
      return NextResponse.json(mockData)
    }

    const data = await response.json()
    console.log(`Received ${data.length} candles from Binance ${marketType} market`)

    if (!Array.isArray(data) || data.length === 0) {
      console.error("Binance returned empty or invalid data", data)

      // Fall back to mock data if Binance returns empty data
      console.log(`Falling back to mock data for ${symbol} (${marketType})`)
      const mockData = generateMockMarketData(symbol, timeframe, Number.parseInt(limit))
      return NextResponse.json(mockData)
    }

    const marketData = calculateIndicators(data)
    return NextResponse.json(marketData)
  } catch (error) {
    console.error("Error fetching market data:", error)

    // Fall back to mock data in case of any error
    console.log(`Falling back to mock data due to error for ${symbol} (${marketType})`)
    const mockData = generateMockMarketData(symbol, timeframe, Number.parseInt(limit))
    return NextResponse.json(mockData)
  }
}
