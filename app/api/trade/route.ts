import { NextResponse } from "next/server"
import type { MarketData, Signal } from "@/lib/types"
import { calculateIndicators } from "@/lib/market-data"
import { queryTapas, queryDistilBERT, queryFLANT5 } from "@/lib/huggingface"
import { analyzeSignals as analyzeTradingSignals } from "@/lib/services/trading-signals"

// Logger for debugging
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data ? JSON.stringify(data) : "")
  },
  error: (message: string, error: any) => {
    console.error(`[ERROR] ${message}`, error)
  },
}

// Mock market data for demonstration
const mockMarketData = {
  rsi: 55,
  macd: 0.2,
  signal: 0.1,
  volume: 1500000,
  price: 65000,
}

// Mock news data for demonstration
const mockNewsData = {
  headlines: [
    "Bitcoin shows strong momentum as institutional adoption increases",
    "Market analysts predict continued growth for major cryptocurrencies",
  ],
  summaries: [
    "Institutional investors continue to show interest in Bitcoin, driving prices higher.",
    "Technical indicators suggest a bullish trend for Bitcoin in the coming weeks.",
  ],
}

export async function GET(request: Request) {
  try {
    // Get the symbol from the URL query parameters
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get("symbol") || "BTCUSDT"
    const useFallback = searchParams.get("fallback") === "true"

    console.log(`Processing trade analysis for ${symbol}, fallback mode: ${useFallback}`)

    // In a real application, you would fetch real market data here
    // For now, we'll use mock data

    // Analyze signals using our AI models (or fallbacks)
    const modelResults = await analyzeTradingSignals(mockMarketData, mockNewsData, useFallback)

    // Return the analysis results
    return NextResponse.json({
      symbol,
      action: modelResults.decision,
      risk: modelResults.riskScore,
      modelResults,
      useFallback:
        useFallback ||
        modelResults.tapasUsingFallback ||
        modelResults.sentimentUsingFallback ||
        modelResults.decisionUsingFallback ||
        modelResults.summaryUsingFallback,
    })
  } catch (error) {
    console.error("Error in trade API route:", error)

    // Return a proper error response
    return NextResponse.json(
      {
        error: "Failed to analyze trading signals",
        details: error instanceof Error ? error.message : "Unknown error",
        fallbackRecommendation: "HOLD", // Safe default
      },
      { status: 500 },
    )
  }
}

async function getMarketData(symbol: string): Promise<MarketData[]> {
  try {
    // Fetch data from Binance API
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=100`)

    if (!response.ok) {
      throw new Error(`Failed to fetch data from Binance: ${response.statusText}`)
    }

    const data = await response.json()
    return calculateIndicators(data)
  } catch (error) {
    logger.error(`Error fetching market data for ${symbol}:`, error)
    throw new Error(`Failed to fetch market data: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function analyzeSignals(data: MarketData[]): Promise<{ signal: Signal; reasoning: string }> {
  try {
    // Extract the last 10 data points for analysis
    const recentData = data.slice(-10)

    // Prepare table data for Tapas model
    const tableData = {
      Timestamp: recentData.map((d) => new Date(d.timestamp).toISOString().substring(0, 19)),
      RSI: recentData.map((d) => d.rsi.toFixed(2)),
      MACD: recentData.map((d) => d.macd.toFixed(2)),
      Signal: recentData.map((d) => d.signal.toFixed(2)),
      Histogram: recentData.map((d) => d.histogram.toFixed(2)),
    }

    // Query Tapas for signal analysis
    const query = "Based on RSI and MACD values, should we BUY, SELL, or HOLD?"

    try {
      const tapasResult = await queryTapas(query, tableData)
      const answer = tapasResult.answer
      const reasoning = tapasResult.reasoning

      // Parse the answer to get a valid action
      let action: "BUY" | "SELL" | "HOLD"
      if (answer.toUpperCase().includes("BUY")) {
        action = "BUY"
      } else if (answer.toUpperCase().includes("SELL")) {
        action = "SELL"
      } else {
        action = "HOLD"
      }

      // Get the last data point for the signal
      const lastData = data[data.length - 1]

      return {
        signal: {
          action,
          confidence: 0.85,
          rsi: lastData.rsi,
          macd: lastData.macd,
        },
        reasoning,
      }
    } catch (error) {
      // If Tapas fails, use fallback immediately
      logger.error("Tapas query failed, using fallback:", error)
      return fallbackSignalAnalysis(data)
    }
  } catch (error) {
    logger.error("Error analyzing signals:", error)
    // Ensure we always return a result by using fallback
    return fallbackSignalAnalysis(data)
  }
}

// Fallback signal analysis when Tapas fails
function fallbackSignalAnalysis(data: MarketData[]): { signal: Signal; reasoning: string } {
  const lastData = data[data.length - 1]
  const prevData = data[data.length - 2] || lastData
  let reasoning = "Fallback signal analysis reasoning:\n"

  let action: "BUY" | "SELL" | "HOLD" = "HOLD"

  // Simple RSI-based strategy
  if (lastData.rsi < 30) {
    action = "BUY" // Oversold
    reasoning += `- RSI value (${lastData.rsi.toFixed(2)}) is below 30, indicating oversold conditions\n`
    reasoning += "- Oversold conditions often present buying opportunities\n"
  } else if (lastData.rsi > 70) {
    action = "SELL" // Overbought
    reasoning += `- RSI value (${lastData.rsi.toFixed(2)}) is above 70, indicating overbought conditions\n`
    reasoning += "- Overbought conditions often suggest selling opportunities\n"
  } else if (lastData.macd > 0 && prevData.macd <= 0) {
    action = "BUY" // MACD crossed above zero
    reasoning += `- MACD (${lastData.macd.toFixed(2)}) has crossed above zero line\n`
    reasoning += "- MACD crossing above zero is a bullish signal\n"
  } else if (lastData.macd < 0 && prevData.macd >= 0) {
    action = "SELL" // MACD crossed below zero
    reasoning += `- MACD (${lastData.macd.toFixed(2)}) has crossed below zero line\n`
    reasoning += "- MACD crossing below zero is a bearish signal\n"
  } else {
    reasoning += `- RSI (${lastData.rsi.toFixed(2)}) is within normal range (30-70)\n`
    reasoning += `- MACD (${lastData.macd.toFixed(2)}) shows no significant crossover\n`
    reasoning += "- No strong buy or sell signals detected, recommending HOLD\n"
  }

  return {
    signal: {
      action,
      confidence: 0.6, // Lower confidence for fallback
      rsi: lastData.rsi,
      macd: lastData.macd,
    },
    reasoning,
  }
}

async function assessRisk(signal: Signal): Promise<{ risk: number; reasoning: string }> {
  try {
    // Create a prompt for risk assessment
    const prompt = `
      Trading signal: ${signal.action}
      RSI: ${signal.rsi?.toFixed(2) || "N/A"}
      MACD: ${signal.macd?.toFixed(2) || "N/A"}
      Market conditions: Volatile
      
      Assess the risk level of this trade.
    `

    // Use DistilBERT for sentiment analysis to assess risk
    const result = await queryDistilBERT(prompt)
    const riskScore = result.score
    const reasoning = result.reasoning

    // Invert the score for risk (higher positive sentiment = lower risk)
    return { risk: 1 - riskScore, reasoning }
  } catch (error) {
    logger.error("Error assessing risk:", error)
    throw error
  }
}

// Fallback risk assessment when DistilBERT fails
function fallbackRiskAssessment(data: MarketData[], signal: Signal): { risk: number; reasoning: string } {
  let reasoning = "Fallback risk assessment reasoning:\n"

  // Calculate volatility as a risk factor
  const prices = data.slice(-20).map((d) => d.close)
  const returns = []

  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1])
  }

  // Calculate standard deviation of returns as volatility
  const mean = returns.reduce((sum, val) => sum + val, 0) / returns.length
  const variance = returns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / returns.length
  const volatility = Math.sqrt(variance)

  reasoning += `- Calculated price volatility: ${(volatility * 100).toFixed(2)}%\n`

  // Scale volatility to a 0-1 risk score (higher volatility = higher risk)
  let riskScore = Math.min(volatility * 10, 1)
  reasoning += `- Base risk score from volatility: ${(riskScore * 100).toFixed(1)}%\n`

  // Adjust risk based on RSI
  if (signal.rsi) {
    if (signal.rsi < 30 || signal.rsi > 70) {
      riskScore += 0.2 // Extreme RSI values increase risk
      reasoning += `- RSI value (${signal.rsi.toFixed(2)}) is in extreme territory, adding 20% to risk\n`
    } else {
      reasoning += `- RSI value (${signal.rsi.toFixed(2)}) is within normal range\n`
    }
  }

  // Cap risk between 0.2 and 0.8
  const finalRisk = Math.max(0.2, Math.min(0.8, riskScore))
  reasoning += `- Final risk assessment: ${(finalRisk * 100).toFixed(1)}%\n`

  if (finalRisk < 0.4) {
    reasoning += "- This represents a relatively low risk trade\n"
  } else if (finalRisk < 0.6) {
    reasoning += "- This represents a moderate risk trade\n"
  } else {
    reasoning += "- This represents a high risk trade\n"
  }

  return { risk: finalRisk, reasoning }
}

async function decideAction(signal: Signal, risk: number): Promise<{ action: string; reasoning: string }> {
  try {
    // Create a prompt for FLAN-T5
    const prompt = `
      Given:
      - Signal: ${signal.action}
      - Risk: ${risk.toFixed(2)}
      - RSI: ${signal.rsi?.toFixed(2) || "N/A"}
      - MACD: ${signal.macd?.toFixed(2) || "N/A"}
      
      Make a final trading decision. Respond with ONLY "BUY", "SELL", or "HOLD".
      If risk is high (> 0.7), consider being more conservative.
    `

    // Query FLAN-T5 for the final decision
    const result = await queryFLANT5(prompt)
    const decision = result.decision
    const reasoning = result.reasoning

    // Parse the decision to get a valid action
    let action = "HOLD"
    if (decision.toUpperCase().includes("BUY")) {
      action = "BUY"
    } else if (decision.toUpperCase().includes("SELL")) {
      action = "SELL"
    }

    return { action, reasoning }
  } catch (error) {
    logger.error("Error deciding action:", error)
    throw error
  }
}

// Fallback decision making when FLAN-T5 fails
function fallbackDecisionMaking(signal: Signal, risk: number): { action: string; reasoning: string } {
  let reasoning = "Fallback decision making reasoning:\n"

  // Conservative approach based on risk
  if (risk > 0.6) {
    reasoning += `- Risk level (${(risk * 100).toFixed(1)}%) is high (> 60%)\n`
    reasoning += "- Taking conservative approach due to high risk\n"
    reasoning += "- Recommending HOLD regardless of signal\n"
    return { action: "HOLD", reasoning }
  }

  // Otherwise, follow the signal
  reasoning += `- Risk level (${(risk * 100).toFixed(1)}%) is acceptable (< 60%)\n`
  reasoning += `- Following the original signal: ${signal.action}\n`

  if (signal.action === "BUY") {
    reasoning += "- Buy signal with acceptable risk suggests good entry opportunity\n"
  } else if (signal.action === "SELL") {
    reasoning += "- Sell signal with acceptable risk suggests good exit opportunity\n"
  } else {
    reasoning += "- Hold signal maintained as no strong directional indication\n"
  }

  return { action: signal.action, reasoning }
}
