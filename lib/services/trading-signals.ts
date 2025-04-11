import {
  queryTapas,
  queryDistilBERT,
  queryFLANT5,
  queryBART,
  fallbackTableAnalysis,
  fallbackSentimentAnalysis,
  fallbackDecisionMaking,
  fallbackSummarization,
} from "../huggingface"

export interface ModelResults {
  decision: "BUY" | "SELL" | "HOLD"
  riskScore: number
  tapasReasoning?: string
  sentimentReasoning?: string
  decisionReasoning?: string
  summaryReasoning?: string
  tapasUsingFallback?: boolean
  sentimentUsingFallback?: boolean
  decisionUsingFallback?: boolean
  summaryUsingFallback?: boolean
}

export interface MarketData {
  rsi: number
  macd: number
  signal: number
  volume: number
  price: number
}

export interface NewsData {
  headlines: string[]
  summaries: string[]
}

function convertMarketDataToTable(marketData: MarketData): Record<string, string[]> {
  try {
    // Create a properly formatted table for Tapas
    return {
      Indicator: ["RSI", "MACD", "Signal", "Volume", "Price"],
      Value: [
        marketData.rsi.toString(),
        marketData.macd.toString(),
        marketData.signal.toString(),
        marketData.volume.toString(),
        marketData.price.toString(),
      ],
    }
  } catch (error) {
    console.error("Error converting market data to table:", error)
    // Return a simple fallback table
    return {
      Indicator: ["RSI", "MACD", "Signal"],
      Value: ["50", "0", "0"],
    }
  }
}

function calculateRiskScore(marketData: MarketData, sentimentScore: number): number {
  let riskScore = 0.5

  // RSI: Higher RSI (overbought) increases risk
  if (marketData.rsi > 70) {
    riskScore += 0.1
  } else if (marketData.rsi < 30) {
    riskScore -= 0.1
  }

  // MACD: Consider the MACD and signal line relationship
  if (marketData.macd > marketData.signal) {
    riskScore -= 0.05
  } else {
    riskScore += 0.05
  }

  // Volume: Higher volume might indicate higher risk
  if (marketData.volume > 1000000) {
    riskScore += 0.05
  }

  // Sentiment: Positive sentiment reduces risk, negative increases it
  riskScore += (sentimentScore - 0.5) * 0.2

  // Ensure risk score stays within 0 and 1
  riskScore = Math.max(0, Math.min(1, riskScore))

  return riskScore
}

export async function analyzeSignals(
  marketData: MarketData,
  newsData: NewsData,
  useFallback = false,
): Promise<ModelResults> {
  console.log("Analyzing signals with market data and news data")

  // Default result in case of errors
  const defaultResult: ModelResults = {
    decision: "HOLD",
    riskScore: 0.5,
    tapasReasoning: "Unable to analyze market data.",
    sentimentReasoning: "Unable to analyze news sentiment.",
    decisionReasoning: "Using default conservative position due to analysis errors.",
    summaryReasoning: "No summary available due to analysis errors.",
    tapasUsingFallback: true,
    sentimentUsingFallback: true,
    decisionUsingFallback: true,
    summaryUsingFallback: true,
  }

  if (useFallback) {
    console.log("Using fallback mode for all models")

    try {
      // Prepare market data for table analysis
      const table = convertMarketDataToTable(marketData)

      // Use fallbacks directly
      const tapasResult = fallbackTableAnalysis(
        "Based on the technical indicators, should I buy, sell, or hold?",
        table,
      )

      const sentimentResult = fallbackSentimentAnalysis(
        newsData.headlines.join(" ") + " " + newsData.summaries.join(" "),
      )

      const flantResult = fallbackDecisionMaking(
        `RSI=${marketData.rsi.toFixed(2)}, MACD=${marketData.macd.toFixed(2)}, Signal=${marketData.signal.toFixed(2)}, Volume=${marketData.volume}, Price=${marketData.price}`,
      )

      const bartResult = fallbackSummarization(
        `Market Analysis: RSI is ${marketData.rsi.toFixed(2)} which is ${marketData.rsi > 70 ? "overbought" : marketData.rsi < 30 ? "oversold" : "neutral"}. ` +
          `MACD is ${marketData.macd > marketData.signal ? "above" : "below"} the signal line. ` +
          `The current price is ${marketData.price} with a volume of ${marketData.volume}. ` +
          `Recent news sentiment is ${sentimentResult.score > 0.6 ? "positive" : sentimentResult.score < 0.4 ? "negative" : "neutral"}.`,
      )

      return {
        decision: flantResult.decision as "BUY" | "SELL" | "HOLD",
        riskScore: calculateRiskScore(marketData, sentimentResult.score),
        tapasReasoning: tapasResult.reasoning,
        sentimentReasoning: sentimentResult.reasoning,
        decisionReasoning: flantResult.reasoning,
        summaryReasoning: bartResult.reasoning,
        tapasUsingFallback: true,
        sentimentUsingFallback: true,
        decisionUsingFallback: true,
        summaryUsingFallback: true,
      }
    } catch (error) {
      console.error("Error in fallback mode:", error)
      return defaultResult
    }
  }

  try {
    // Prepare market data for table analysis
    const table = convertMarketDataToTable(marketData)

    // Step 1: Analyze market data with Tapas
    let tapasResult
    let tapasUsingFallback = false
    try {
      tapasResult = await queryTapas("Based on the technical indicators, should I buy, sell, or hold?", table)
      // Check if the result came from a fallback (queryTapas now handles multiple fallback attempts internally)
      tapasUsingFallback = tapasResult.reasoning && tapasResult.reasoning.includes("Fallback")
    } catch (error) {
      console.error("Error in Tapas analysis:", error)
      tapasResult = fallbackTableAnalysis("Based on the technical indicators, should I buy, sell, or hold?", table)
      tapasUsingFallback = true
    }

    // Step 2: Analyze news sentiment with DistilBERT
    let sentimentResult
    let sentimentUsingFallback = false
    try {
      sentimentResult = await queryDistilBERT(newsData.headlines.join(" ") + " " + newsData.summaries.join(" "))
      // Check if the result came from a fallback
      sentimentUsingFallback = sentimentResult.reasoning && sentimentResult.reasoning.includes("Fallback")
    } catch (error) {
      console.error("Error in sentiment analysis:", error)
      sentimentResult = fallbackSentimentAnalysis(newsData.headlines.join(" ") + " " + newsData.summaries.join(" "))
      sentimentUsingFallback = true
    }

    // Step 3: Make a decision with FLAN-T5 (now DeepSeek)
    let flantResult
    let decisionUsingFallback = false
    try {
      flantResult = await queryFLANT5(
        `Given the following information, should I buy, sell, or hold?
      
      Technical Indicators:
      - RSI: ${marketData.rsi.toFixed(2)}
      - MACD: ${marketData.macd.toFixed(2)}
      - Signal: ${marketData.signal.toFixed(2)}
      - Current Price: ${marketData.price}
      - Volume: ${marketData.volume}
      
      Market Analysis:
      - ${tapasResult.answer}
      
      News Sentiment:
      - Sentiment Score: ${sentimentResult.score.toFixed(2)} (0=negative, 1=positive)
      
      Risk Level:
      - ${calculateRiskScore(marketData, sentimentResult.score).toFixed(2)} (0=low risk, 1=high risk)
      `,
      )
      // Check if the result came from a fallback
      decisionUsingFallback = flantResult.reasoning && flantResult.reasoning.includes("Fallback")
    } catch (error) {
      console.error("Error in decision making:", error)
      flantResult = fallbackDecisionMaking(
        `RSI=${marketData.rsi.toFixed(2)}, MACD=${marketData.macd.toFixed(2)}, Signal=${marketData.signal.toFixed(2)}, Volume=${marketData.volume}, Price=${marketData.price}`,
      )
      decisionUsingFallback = true
    }

    // Step 4: Generate a summary with BART
    let bartResult
    let summaryUsingFallback = false
    try {
      bartResult = await queryBART(
        `Market Analysis: RSI is ${marketData.rsi.toFixed(2)} which is ${marketData.rsi > 70 ? "overbought" : marketData.rsi < 30 ? "oversold" : "neutral"}. ` +
          `MACD is ${marketData.macd > marketData.signal ? "above" : "below"} the signal line. ` +
          `The current price is ${marketData.price} with a volume of ${marketData.volume}. ` +
          `Recent news sentiment is ${sentimentResult.score > 0.6 ? "positive" : sentimentResult.score < 0.4 ? "negative" : "neutral"}. ` +
          `The trading decision is to ${flantResult.decision}.`,
      )
      // Check if the result came from a fallback
      summaryUsingFallback = bartResult.reasoning && bartResult.reasoning.includes("Fallback")
    } catch (error) {
      console.error("Error in summary generation:", error)
      bartResult = fallbackSummarization(
        `Market Analysis: RSI is ${marketData.rsi.toFixed(2)} which is ${marketData.rsi > 70 ? "overbought" : marketData.rsi < 30 ? "oversold" : "neutral"}. ` +
          `MACD is ${marketData.macd > marketData.signal ? "above" : "below"} the signal line. ` +
          `The current price is ${marketData.price} with a volume of ${marketData.volume}. ` +
          `Recent news sentiment is ${sentimentResult.score > 0.6 ? "positive" : sentimentResult.score < 0.4 ? "negative" : "neutral"}.`,
      )
      summaryUsingFallback = true
    }

    // Calculate risk score based on market data and sentiment
    const riskScore = calculateRiskScore(marketData, sentimentResult.score)

    return {
      decision: flantResult.decision as "BUY" | "SELL" | "HOLD",
      riskScore,
      tapasReasoning: tapasResult.reasoning,
      sentimentReasoning: sentimentResult.reasoning,
      decisionReasoning: flantResult.reasoning,
      summaryReasoning: bartResult.reasoning,
      tapasUsingFallback,
      sentimentUsingFallback,
      decisionUsingFallback,
      summaryUsingFallback,
    }
  } catch (error) {
    console.error("Error in analyzeSignals:", error)
    return defaultResult
  }
}
