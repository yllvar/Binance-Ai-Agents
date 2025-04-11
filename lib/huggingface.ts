// Utility functions for Hugging Face API calls
import { recordPrediction, updateConnectionStatus } from "./services/model-tracking"
import type { ModelType } from "./types/model-tracking"

// Environment variable for Hugging Face API token
const HF_API_TOKEN = process.env.HUGGING_FACE_API_TOKEN || ""

// Error class for Hugging Face API errors
export class HuggingFaceError extends Error {
  status?: number
  endpoint?: string

  constructor(message: string, status?: number, endpoint?: string) {
    super(message)
    this.name = "HuggingFaceError"
    this.status = status
    this.endpoint = endpoint
  }
}

// Export fallback functions for direct use
export { fallbackTableAnalysis, fallbackSentimentAnalysis, fallbackDecisionMaking, fallbackSummarization }

// Base query function for Hugging Face API
async function queryHuggingFace<T>(endpoint: string, data: any, modelType: ModelType): Promise<T> {
  const startTime = Date.now()
  let success = false
  let errorMessage = ""

  try {
    if (!HF_API_TOKEN) {
      const error = new HuggingFaceError(
        "Hugging Face API token is not set. Please set the HUGGING_FACE_API_TOKEN environment variable.",
        401,
        endpoint,
      )

      updateConnectionStatus({
        modelType,
        status: "disconnected",
        responseTime: 0,
        errorMessage: error.message,
      })

      throw error
    }

    console.log(`[HF API] Querying ${endpoint} with data:`, JSON.stringify(data))

    const response = await fetch(`https://router.huggingface.co/hf-inference/models/${endpoint}`, {
      headers: {
        Authorization: `Bearer ${HF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify(data),
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(15000), // 15 second timeout
    })

    if (!response.ok) {
      let errorText = ""
      try {
        // Check if the response is HTML (common for 503 errors)
        const contentType = response.headers.get("content-type") || ""
        if (contentType.includes("text/html")) {
          errorText = "Service returned HTML instead of JSON (service may be unavailable)"
        } else {
          errorText = await response.text()
        }
      } catch (e) {
        errorText = "Could not retrieve error details"
      }

      console.error(`[HF API] Error from ${endpoint} (${response.status}):`, errorText)

      // Check if it's a 503 Service Unavailable error
      if (response.status === 503) {
        errorMessage = `Hugging Face service is temporarily unavailable. Please try again later.`
      } else {
        errorMessage = `Hugging Face API error (${response.status}): ${response.statusText}`
      }

      updateConnectionStatus({
        modelType,
        status: "disconnected", // Changed from "degraded" to "disconnected" for 503 errors
        responseTime: Date.now() - startTime,
        errorMessage,
      })

      throw new HuggingFaceError(errorMessage, response.status, endpoint)
    }

    // Check if the response is valid JSON before parsing
    const contentType = response.headers.get("content-type") || ""
    if (!contentType.includes("application/json")) {
      errorMessage = `Invalid response content type: ${contentType}, expected application/json`
      console.error(`[HF API] ${errorMessage}`)

      updateConnectionStatus({
        modelType,
        status: "degraded",
        responseTime: Date.now() - startTime,
        errorMessage,
      })

      throw new HuggingFaceError(errorMessage, response.status, endpoint)
    }

    const result = await response.json()

    // Validate the response structure
    if (!result) {
      errorMessage = `Invalid response format from ${endpoint}`
      console.error(`[HF API] ${errorMessage}:`, result)

      updateConnectionStatus({
        modelType,
        status: "degraded",
        responseTime: Date.now() - startTime,
        errorMessage,
      })

      throw new HuggingFaceError(errorMessage, 500, endpoint)
    }

    // Special handling for FLAN-T5 array response format
    if (modelType === "flant5" && Array.isArray(result)) {
      if (!result[0] || !result[0].generated_text) {
        errorMessage = `Invalid response format from ${endpoint}: missing generated_text`
        console.error(`[HF API] ${errorMessage}:`, result)
        throw new HuggingFaceError(errorMessage, 500, endpoint)
      }
    } else if (modelType === "flant5" && !result.generated_text) {
      errorMessage = `Invalid response format from ${endpoint}: missing generated_text`
      console.error(`[HF API] ${errorMessage}:`, result)
      throw new HuggingFaceError(errorMessage, 500, endpoint)
    }

    console.log(`[HF API] Response from ${endpoint}:`, JSON.stringify(result))

    success = true

    updateConnectionStatus({
      modelType,
      status: "connected",
      responseTime: Date.now() - startTime,
    })

    return result as T
  } catch (error) {
    const latency = Date.now() - startTime

    if (!(error instanceof HuggingFaceError)) {
      errorMessage = `Unexpected error querying Hugging Face API: ${error instanceof Error ? error.message : String(error)}`

      updateConnectionStatus({
        modelType,
        status: "disconnected",
        responseTime: latency,
        errorMessage,
      })

      console.error(`[HF API] Unexpected error querying ${endpoint}:`, error)
      throw new HuggingFaceError(errorMessage, 500, endpoint)
    }

    throw error
  } finally {
    // Record the prediction attempt
    recordPrediction({
      timestamp: startTime,
      modelType,
      input: JSON.stringify(data),
      output: success ? "Success" : `Error: ${errorMessage}`,
      latency: Date.now() - startTime,
      success,
      error: success ? undefined : errorMessage,
    })
  }
}

// Interface for DistilBERT response
interface DistilBERTResponse {
  [index: number]: {
    label: string
    score: number
  }[]
}

// Enhanced fallback for sentiment analysis with reasoning
function fallbackSentimentAnalysis(text: string): { score: number; reasoning: string } {
  console.log("[HF API] Using enhanced sentiment analysis fallback")

  // Convert text to lowercase for easier matching
  const lowerText = text.toLowerCase()

  // Define positive and negative keywords with weights
  const sentimentKeywords = {
    positive: [
      { word: "bullish", weight: 0.8 },
      { word: "uptrend", weight: 0.7 },
      { word: "buy", weight: 0.6 },
      { word: "growth", weight: 0.6 },
      { word: "increase", weight: 0.5 },
      { word: "gain", weight: 0.5 },
      { word: "profit", weight: 0.5 },
      { word: "positive", weight: 0.5 },
      { word: "strong", weight: 0.4 },
      { word: "opportunity", weight: 0.4 },
      { word: "support", weight: 0.3 },
      { word: "recovery", weight: 0.3 },
      { word: "momentum", weight: 0.3 },
    ],
    negative: [
      { word: "bearish", weight: 0.8 },
      { word: "downtrend", weight: 0.7 },
      { word: "sell", weight: 0.6 },
      { word: "decline", weight: 0.6 },
      { word: "decrease", weight: 0.5 },
      { word: "loss", weight: 0.5 },
      { word: "negative", weight: 0.5 },
      { word: "weak", weight: 0.4 },
      { word: "risk", weight: 0.4 },
      { word: "resistance", weight: 0.3 },
      { word: "correction", weight: 0.3 },
      { word: "volatile", weight: 0.3 },
    ],
  }

  // Calculate positive and negative scores
  let positiveScore = 0
  let negativeScore = 0
  let totalWeight = 0

  // Track matched keywords for reasoning
  const matchedPositive: string[] = []
  const matchedNegative: string[] = []

  // Check for positive keywords
  for (const { word, weight } of sentimentKeywords.positive) {
    if (lowerText.includes(word)) {
      positiveScore += weight
      totalWeight += weight
      matchedPositive.push(word)
    }
  }

  // Check for negative keywords
  for (const { word, weight } of sentimentKeywords.negative) {
    if (lowerText.includes(word)) {
      negativeScore += weight
      totalWeight += weight
      matchedNegative.push(word)
    }
  }

  // If no keywords found, return neutral sentiment
  if (totalWeight === 0) {
    return {
      score: 0.5,
      reasoning: "No clear sentiment indicators found in the text. Assigning neutral sentiment.",
    }
  }

  // Calculate final sentiment score (0 to 1, where 0 is negative and 1 is positive)
  const score = positiveScore / (positiveScore + negativeScore)

  // Generate reasoning
  let reasoning = "Sentiment analysis based on keyword matching:\n"

  if (matchedPositive.length > 0) {
    reasoning += `- Positive indicators: ${matchedPositive.join(", ")}\n`
  }

  if (matchedNegative.length > 0) {
    reasoning += `- Negative indicators: ${matchedNegative.join(", ")}\n`
  }

  reasoning += `- Overall sentiment: ${score < 0.4 ? "Negative" : score > 0.6 ? "Positive" : "Neutral"} (${(score * 100).toFixed(1)}%)`

  return { score, reasoning }
}

// Query DistilBERT for sentiment analysis
export async function queryDistilBERT(text: string): Promise<{ score: number; reasoning: string }> {
  try {
    const response = await queryHuggingFace<DistilBERTResponse>(
      "distilbert/distilbert-base-uncased-finetuned-sst-2-english",
      { inputs: text },
      "distilbert",
    )

    // Find the positive sentiment score
    const positiveItem = response[0]?.find((item) => item.label === "POSITIVE")
    const negativeItem = response[0]?.find((item) => item.label === "NEGATIVE")
    const positiveScore = positiveItem?.score || 0.5

    // Generate reasoning
    let reasoning = "Sentiment analysis from DistilBERT model:\n"

    if (positiveItem && negativeItem) {
      reasoning += `- Positive sentiment: ${(positiveItem.score * 100).toFixed(1)}%\n`
      reasoning += `- Negative sentiment: ${(negativeItem.score * 100).toFixed(1)}%\n`
      reasoning += `- Overall assessment: ${positiveScore > 0.6 ? "Positive" : positiveScore < 0.4 ? "Negative" : "Neutral"}`
    } else {
      reasoning = "Sentiment analysis completed, but detailed scores unavailable."
    }

    return { score: positiveScore, reasoning }
  } catch (error) {
    console.error("[HF API] Error in queryDistilBERT, using enhanced fallback:", error)
    // Use enhanced fallback sentiment analysis
    return fallbackSentimentAnalysis(text)
  }
}

// Interface for Tapas response
interface TapasResponse {
  answer: string
  coordinates: number[][]
  cells: string[]
  aggregator: string
}

// Enhanced fallback for tabular analysis with reasoning
function fallbackTableAnalysis(query: string, table: Record<string, string[]>): { answer: string; reasoning: string } {
  console.log("[HF API] Using enhanced table analysis fallback")

  // Convert query to lowercase for easier matching
  const lowerQuery = query.toLowerCase()

  // Extract column names and convert to lowercase for matching
  const columns = Object.keys(table)
  const lowerColumns = columns.map((col) => col.toLowerCase())

  // Get number of rows in the table
  const numRows = table[columns[0]]?.length || 0

  // Function to check if a value is numeric
  const isNumeric = (value: string): boolean => {
    return !isNaN(Number.parseFloat(value)) && isFinite(Number(value.replace(/[^0-9.-]+/g, "")))
  }

  // Function to convert string to number safely
  const toNumber = (value: string): number => {
    \
    return Number.parseFloat(value.replace(/[^0-9.-]+/g, "\")))
  }

  // Function to find column index by partial name match
  const findColumnIndex = (partialName: string): number => {
    const returnowerColumns = lowerColumns // Fix: Assign lowerColumns to returnowerColumns
    return returnowerColumns.findIndex((col) => col.includes(partialName))
  }

  let reasoning = "Table analysis reasoning:\n"

  // Check for highest/maximum value query
  if (lowerQuery.includes("highest") || lowerQuery.includes("maximum") || lowerQuery.includes("max")) {
    reasoning += "- Detected query type: Finding maximum/highest value\n"

    // Try to identify which column to analyze
    let targetColumnIndex = -1
    let targetColumnReason = ""

    // Look for column name in the query
    for (let i = 0; i < columns.length; i++) {
      if (lowerQuery.includes(lowerColumns[i])) {
        targetColumnIndex = i
        targetColumnReason = `- Found column '${columns[i]}' mentioned in query\n`
        break
      }
    }

    // If no specific column mentioned, try to find numeric columns
    if (targetColumnIndex === -1) {
      reasoning += "- No specific column mentioned in query, searching for numeric columns\n"

      for (let i = 0; i < columns.length; i++) {
        // Check if this column has numeric values
        const hasNumericValues = table[columns[i]].some((value) => isNumeric(value))
        if (hasNumericValues) {
          targetColumnIndex = i
          targetColumnReason = `- Selected column '${columns[i]}' as it contains numeric values\n`
          break
        }
      }
    }

    reasoning += targetColumnReason

    // If we found a column to analyze
    if (targetColumnIndex !== -1) {
      const columnName = columns[targetColumnIndex]
      const values = table[columnName]

      // Find the maximum value and its index
      let maxValue = Number.NEGATIVE_INFINITY
      let maxIndex = -1

      for (let i = 0; i < values.length; i++) {
        if (isNumeric(values[i])) {
          const numValue = toNumber(values[i])
          if (numValue > maxValue) {
            maxValue = numValue
            maxIndex = i
          }
        }
      }

      if (maxIndex !== -1) {
        reasoning += `- Found maximum value ${values[maxIndex]} in row ${maxIndex + 1}\n`
        return { answer: values[maxIndex], reasoning }
      } else {
        reasoning += "- No numeric values found in the selected column\n"
      }
    } else {
      reasoning += "- Could not identify a suitable numeric column for analysis\n"
    }
  }

  // Check for lowest/minimum value query
  else if (lowerQuery.includes("lowest") || lowerQuery.includes("minimum") || lowerQuery.includes("min")) {
    reasoning += "- Detected query type: Finding minimum/lowest value\n"

    // Similar logic as above but finding minimum
    let targetColumnIndex = -1
    let targetColumnReason = ""

    for (let i = 0; i < columns.length; i++) {
      if (lowerQuery.includes(lowerColumns[i])) {
        targetColumnIndex = i
        targetColumnReason = `- Found column '${columns[i]}' mentioned in query\n`
        break
      }
    }

    if (targetColumnIndex === -1) {
      reasoning += "- No specific column mentioned in query, searching for numeric columns\n"

      for (let i = 0; i < columns.length; i++) {
        const hasNumericValues = table[columns[i]].some((value) => isNumeric(value))
        if (hasNumericValues) {
          targetColumnIndex = i
          targetColumnReason = `- Selected column '${columns[i]}' as it contains numeric values\n`
          break
        }
      }
    }

    reasoning += targetColumnReason

    if (targetColumnIndex !== -1) {
      const columnName = columns[targetColumnIndex]
      const values = table[columnName]

      let minValue = Number.POSITIVE_INFINITY
      let minIndex = -1

      for (let i = 0; i < values.length; i++) {
        if (isNumeric(values[i])) {
          const numValue = toNumber(values[i])
          if (numValue < minValue) {
            minValue = numValue
            minIndex = i
          }
        }
      }

      if (minIndex !== -1) {
        reasoning += `- Found minimum value ${values[minIndex]} in row ${minIndex + 1}\n`
        return { answer: values[minIndex], reasoning }
      } else {
        reasoning += "- No numeric values found in the selected column\n"
      }
    } else {
      reasoning += "- Could not identify a suitable numeric column for analysis\n"
    }
  }

  // Check for average/mean value query
  else if (lowerQuery.includes("average") || lowerQuery.includes("mean") || lowerQuery.includes("avg")) {
    reasoning += "- Detected query type: Finding average/mean value\n"

    let targetColumnIndex = -1
    let targetColumnReason = ""

    for (let i = 0; i < columns.length; i++) {
      if (lowerQuery.includes(lowerColumns[i])) {
        targetColumnIndex = i
        targetColumnReason = `- Found column '${columns[i]}' mentioned in query\n`
        break
      }
    }

    if (targetColumnIndex === -1) {
      reasoning += "- No specific column mentioned in query, searching for numeric columns\n"

      for (let i = 0; i < columns.length; i++) {
        const hasNumericValues = table[columns[i]].some((value) => isNumeric(value))
        if (hasNumericValues) {
          targetColumnIndex = i
          targetColumnReason = `- Selected column '${columns[i]}' as it contains numeric values\n`
          break
        }
      }
    }

    reasoning += targetColumnReason

    if (targetColumnIndex !== -1) {
      const columnName = columns[targetColumnIndex]
      const values = table[columnName]

      let sum = 0
      let count = 0
      const numericValues: number[] = []

      for (let i = 0; i < values.length; i++) {
        if (isNumeric(values[i])) {
          const numValue = toNumber(values[i])
          sum += numValue
          count++
          numericValues.push(numValue)
        }
      }

      if (count > 0) {
        const average = sum / count
        reasoning += `- Calculated average from ${count} numeric values\n`
        reasoning += `- Values used: ${numericValues.join(", ")}\n`
        reasoning += `- Sum: ${sum}, Count: ${count}, Average: ${average.toFixed(2)}\n`
        return { answer: average.toFixed(2), reasoning }
      } else {
        reasoning += "- No numeric values found in the selected column\n"
      }
    } else {
      reasoning += "- Could not identify a suitable numeric column for analysis\n"
    }
  }

  // Check for RSI-based trading decision
  else if (
    lowerQuery.includes("rsi") &&
    (lowerQuery.includes("buy") || lowerQuery.includes("sell") || lowerQuery.includes("hold"))
  ) {
    reasoning += "- Detected query type: RSI-based trading decision\n"

    // Find RSI column
    const rsiColumnIndex = findColumnIndex("rsi")

    if (rsiColumnIndex !== -1) {
      reasoning += `- Found RSI column: '${columns[rsiColumnIndex]}'\n`

      const rsiColumn = columns[rsiColumnIndex]
      const rsiValues = table[rsiColumn]

      // Get the latest RSI value
      const latestRSI = rsiValues.length > 0 ? toNumber(rsiValues[rsiValues.length - 1]) : 50
      reasoning += `- Latest RSI value: ${latestRSI}\n`

      // Simple RSI-based decision
      let decision = "HOLD"
      if (latestRSI > 70) {
        decision = "SELL"
        reasoning += "- RSI > 70 indicates overbought conditions, suggesting SELL\n"
      } else if (latestRSI < 30) {
        decision = "BUY"
        reasoning += "- RSI < 30 indicates oversold conditions, suggesting BUY\n"
      } else {
        reasoning += "- RSI between 30-70 indicates neutral conditions, suggesting HOLD\n"
      }

      return { answer: decision, reasoning }
    } else {
      reasoning += "- Could not find RSI column in the table\n"
    }
  }

  // Check for MACD-based trading decision
  else if (
    lowerQuery.includes("macd") &&
    (lowerQuery.includes("buy") || lowerQuery.includes("sell") || lowerQuery.includes("hold"))
  ) {
    reasoning += "- Detected query type: MACD-based trading decision\n"

    // Find MACD and Signal columns
    const macdColumnIndex = findColumnIndex("macd")
    const signalColumnIndex = findColumnIndex("signal")

    if (macdColumnIndex !== -1 && signalColumnIndex !== -1) {
      reasoning += `- Found MACD column: '${columns[macdColumnIndex]}'\n`
      reasoning += `- Found Signal column: '${columns[signalColumnIndex]}'\n`

      const macdColumn = columns[macdColumnIndex]
      const signalColumn = columns[signalColumnIndex]

      const macdValues = table[macdColumn]
      const signalValues = table[signalColumn]

      // Get the latest values
      const latestMACD = macdValues.length > 0 ? toNumber(macdValues[macdValues.length - 1]) : 0
      const latestSignal = signalValues.length > 0 ? toNumber(signalValues[signalValues.length - 1]) : 0

      reasoning += `- Latest MACD value: ${latestMACD}\n`
      reasoning += `- Latest Signal value: ${latestSignal}\n`

      // Previous values
      const prevMACD = macdValues.length > 1 ? toNumber(macdValues[macdValues.length - 2]) : 0
      const prevSignal = signalValues.length > 1 ? toNumber(signalValues[signalValues.length - 2]) : 0

      reasoning += `- Previous MACD value: ${prevMACD}\n`
      reasoning += `- Previous Signal value: ${prevSignal}\n`

      // MACD crossover strategy
      let decision = "HOLD"
      if (prevMACD < prevSignal && latestMACD > latestSignal) {
        decision = "BUY"
        reasoning += "- MACD crossed above Signal line (bullish crossover), suggesting BUY\n"
      } else if (prevMACD > prevSignal && latestMACD < latestSignal) {
        decision = "SELL"
        reasoning += "- MACD crossed below Signal line (bearish crossover), suggesting SELL\n"
      } else if (latestMACD > latestSignal) {
        reasoning += "- MACD above Signal line but no recent crossover, suggesting HOLD with bullish bias\n"
      } else if (latestMACD < latestSignal) {
        reasoning += "- MACD below Signal line but no recent crossover, suggesting HOLD with bearish bias\n"
      } else {
        reasoning += "- No clear MACD signal, suggesting HOLD\n"
      }

      return { answer: decision, reasoning }
    } else {
      if (macdColumnIndex === -1) reasoning += "- Could not find MACD column in the table\n"
      if (signalColumnIndex === -1) reasoning += "- Could not find Signal column in the table\n"
    }
  }

  // Default response if no specific analysis could be performed
  reasoning += "- Could not determine specific analysis type from query\n"
  reasoning += "- Defaulting to HOLD recommendation as a conservative approach\n"

  return { answer: "HOLD", reasoning }
}

// Query Tapas for tabular analysis
export async function queryTapas(
  query: string,
  table: Record<string, string[]>,
): Promise<{ answer: string; reasoning: string }> {
  try {
  // First try with the standard endpoint
  try {
    const response = await queryHuggingFace<TapasResponse>(
      "google/tapas-base-finetuned-wtq",
      {
        inputs: {
          query,
          table,
        },
      },
      "tapas",
    )

    // Generate reasoning based on the Tapas response
    let reasoning = "Table analysis from Tapas model:\n"

    if (response.coordinates && response.coordinates.length > 0) {
      reasoning += `- Selected cells: ${response.cells?.join(", ") || "N/A"}\n`
      reasoning += `- Aggregation method: ${response.aggregator || "None"}\n`
      reasoning += `- Final answer: ${response.answer}\n`
    } else {
      reasoning += `- Direct answer: ${response.answer}\n`
    }

    return { answer: response.answer, reasoning }
  } catch (error) {
    console.warn("[HF API] Primary Tapas endpoint failed, trying alternative models:", error)

    // Try alternative Tapas model if available
    try {
      console.log("[HF API] Attempting to use alternative Tapas model")
      const response = await queryHuggingFace<TapasResponse>(
        "google/tapas-large-finetuned-wtq",
        {
          inputs: {
            query,
            table,
          },
        },
        "tapas",
      )

      let reasoning = "Table analysis from alternative Tapas model:\n"
      if (response.coordinates && response.coordinates.length > 0) {
        reasoning += `- Selected cells: ${response.cells?.join(", ") || "N/A"}\n`
        reasoning += `- Aggregation method: ${response.aggregator || "None"}\n`
        reasoning += `- Final answer: ${response.answer}\n`
      } else {
        reasoning += `- Direct answer: ${response.answer}\n`
      }

      return { answer: response.answer, reasoning }
    } catch (altError) {
      console.warn("[HF API] Alternative Tapas model also failed, trying one more model:", altError)
      
      // Try one more alternative model before falling back
      try {
        console.log("[HF API] Attempting to use last resort Tapas model")
        const response = await queryHuggingFace<TapasResponse>(
          "google/tapas-base",
          {
            inputs: {
              query,
              table,
            },
          },
          "tapas",
        )

        let reasoning = "Table analysis from last resort Tapas model:\n"
        if (response.coordinates && response.coordinates.length > 0) {
          reasoning += `- Selected cells: ${response.cells?.join(", ") || "N/A"}\n`
          reasoning += `- Aggregation method: ${response.aggregator || "None"}\n`
          reasoning += `- Final answer: ${response.answer}\n`
        } else {
          reasoning += `- Direct answer: ${response.answer}\n`
        }

        return { answer: response.answer, reasoning }
      } catch (lastError) {
        console.warn("[HF API] All Tapas models failed, using enhanced fallback:", lastError)
        // Use enhanced fallback table analysis
        return fallbackTableAnalysis(query, table)
      }
    }
  } catch (error) 
    console.error("[HF API] Error in queryTapas:", error)
    // Return a fallback answer with reasoning
    return fallbackTableAnalysis(query, table)
}

// Interface for BART response
interface BARTResponse {
  summary_text: string
}

// Enhanced fallback for summarization with reasoning
function fallbackSummarization(text: string): { summary: string; reasoning: string } {
  console.log("[HF API] Using enhanced summarization fallback")

  // Split text into sentences
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  let reasoning = "Summarization reasoning:\n"

  if (sentences.length === 0) {
    reasoning += "- No content to summarize\n"
    return { summary: "No content to summarize.", reasoning }
  }

  if (sentences.length === 1) {
    reasoning += "- Text contains only one sentence, returning as is\n"
    return { summary: sentences[0].trim(), reasoning }
  }

  // For longer texts, use a more sophisticated approach
  if (sentences.length > 2) {
    reasoning += `- Text contains ${sentences.length} sentences, using frequency-based extraction\n`

    // Calculate word frequency to identify important sentences
    const wordFrequency: Record<string, number> = {}
    const stopWords = ["the", "and", "that", "this", "with", "for", "was", "were", "from", "have", "has"]

    // Count word frequencies
    sentences.forEach((sentence) => {
      const words = sentence.toLowerCase().split(/\s+/)
      words.forEach((word) => {
        // Ignore very short words and common stop words
        if (word.length > 3 && !stopWords.includes(word)) {
          wordFrequency[word] = (wordFrequency[word] || 0) + 1
        }
      })
    })

    reasoning += `- Identified ${Object.keys(wordFrequency).length} unique keywords\n`

    // Get top keywords for reasoning
    const topKeywords = Object.entries(wordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => `${word} (${count})`)

    reasoning += `- Top keywords: ${topKeywords.join(", ")}\n`

    // Score sentences based on word frequency
    const sentenceScores = sentences.map((sentence, index) => {
      const words = sentence.toLowerCase().split(/\s+/)
      let score = 0

      words.forEach((word) => {
        if (wordFrequency[word]) {
          score += wordFrequency[word]
        }
      })

      // Normalize by sentence length to avoid bias towards longer sentences
      return { sentence, score: score / words.length, index }
    })

    // Sort sentences by score
    sentenceScores.sort((a, b) => b.score - a.score)

    // Take top 2-3 sentences depending on text length
    const numSentences = Math.min(3, Math.ceil(sentences.length / 3))
    const topSentences = sentenceScores.slice(0, numSentences)

    reasoning += `- Selected top ${numSentences} sentences by relevance score\n`
    reasoning += `- Sentence scores: ${topSentences.map((s) => `#${s.index + 1} (${s.score.toFixed(2)})`).join(", ")}\n`

    // Sort back to original order
    topSentences.sort((a, b) => a.index - b.index)

    // Join the top sentences
    const summary = topSentences.map((item) => item.sentence.trim()).join(". ") + "."
    reasoning += "- Arranged selected sentences in original order for coherence\n"

    return { summary, reasoning }
  }

  // For very short texts, just return first and last sentence
  reasoning += "- Text is short, using first and last sentence extraction\n"

  const summary = `${sentences[0].trim()}. ${sentences[sentences.length - 1].trim()}.`

  return { summary, reasoning }
}

// Query BART for summarization
export async function queryBART(text: string): Promise<{ summary: string; reasoning: string }> {
  try {
    const response = await queryHuggingFace<BARTResponse>("facebook/bart-large-cnn", { inputs: text }, "bart")

    return {
      summary: response.summary_text,
      reasoning:
        "Summarization performed by BART model, which uses a neural network trained on millions of documents to extract key information while maintaining context and coherence.",
    }
  } catch (error) {
    console.error("[HF API] Error in queryBART, using enhanced fallback:", error)

    // Use enhanced fallback summarization
    return fallbackSummarization(text)
  }
}

// Interface for DeepSeek response
interface DeepSeekResponse {
  choices: {
    message: {
      content: string
    }
  }[]
}

// Query DeepSeek for decision making
async function queryDeepSeek(prompt: string): Promise<{ decision: string; reasoning: string }> {
  const startTime = Date.now()
  let success = false
  const errorMessage = ""

  try {
    if (!HF_API_TOKEN) {
      throw new Error("Hugging Face API token is not set. Please set the HUGGING_FACE_API_TOKEN environment variable.")
    }

    console.log("[HF API] Querying DeepSeek with prompt:", prompt)

    // Format the prompt for DeepSeek
    const formattedPrompt = `You are a trading assistant that helps make decisions based on market indicators.
    
Given the following information, provide a clear trading decision (BUY, SELL, or HOLD) followed by your reasoning.
Your response should start with the decision in capital letters on the first line, then provide your detailed reasoning.

${prompt}

Remember to consider risk levels carefully. If risk is high (>0.7), be more conservative in your recommendation.`

    // Try using Hugging Face directly with DeepSeek model
    try {
      console.log("[HF API] Attempting to use Hugging Face endpoint for DeepSeek")

      // Use Hugging Face text generation API directly
      const response = await fetch(
        "https://api-inference.huggingface.co/models/deepseek-ai/deepseek-coder-33b-instruct",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${HF_API_TOKEN}`,
          },
          body: JSON.stringify({
            inputs: formattedPrompt,
            parameters: {
              max_new_tokens: 500,
              temperature: 0.1,
              return_full_text: false,
            },
          }),
          signal: AbortSignal.timeout(20000), // 20 second timeout
        },
      )

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || ""
        if (contentType.includes("text/html")) {
          throw new Error("Service returned HTML instead of JSON (service may be unavailable)")
        }

        throw new Error(`Hugging Face API error (${response.status}): ${response.statusText}`)
      }

      const result = await response.json()

      if (!result || !Array.isArray(result) || !result[0] || !result[0].generated_text) {
        throw new Error("Invalid response format from Hugging Face")
      }

      const content = result[0].generated_text.trim()
      console.log(`[HF API] Response from DeepSeek via Hugging Face:`, content)

      // Extract decision from the first line
      const lines = content.split("\n")
      let decision = "HOLD" // Default
      const reasoning = content

      // Try to extract the decision from the first line
      if (lines.length > 0) {
        const firstLine = lines[0].toUpperCase()
        if (firstLine.includes("BUY")) {
          decision = "BUY"
        } else if (firstLine.includes("SELL")) {
          decision = "SELL"
        } else if (firstLine.includes("HOLD")) {
          decision = "HOLD"
        }
      }

      success = true

      updateConnectionStatus({
        modelType: "flant5", // Keep using flant5 as the model type for tracking
        status: "connected",
        responseTime: Date.now() - startTime,
      })

      return { decision, reasoning }
    } catch (huggingFaceError) {
      console.warn(`[HF API] Hugging Face endpoint failed: ${huggingFaceError.message}`)

      // Fall back to OpenAI-compatible endpoint
      console.log("[HF API] Falling back to OpenAI-compatible endpoint")

      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${HF_API_TOKEN}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "user",
              content: formattedPrompt,
            },
          ],
          max_tokens: 500,
          temperature: 0.1, // Low temperature for more deterministic responses
        }),
        signal: AbortSignal.timeout(20000), // 20 second timeout
      })

      if (!response.ok) {
        throw new Error(`DeepSeek API error (${response.status}): ${response.statusText}`)
      }

      const result = await response.json()

      if (!result || !result.choices || !result.choices[0] || !result.choices[0].message) {
        throw new Error("Invalid response format from DeepSeek")
      }

      const content = result.choices[0].message.content.trim()
      console.log(`[HF API] Response from DeepSeek:`, content)

      // Extract decision from the first line
      const lines = content.split("\n")
      let decision = "HOLD" // Default
      const reasoning = content

      // Try to extract the decision from the first line
      if (lines.length > 0) {
        const firstLine = lines[0].toUpperCase()
        if (firstLine.includes("BUY")) {
          decision = "BUY"
        } else if (firstLine.includes("SELL")) {
          decision = "SELL"
        } else if (firstLine.includes("HOLD")) {
          decision = "HOLD"
        }
      }

      success = true

      updateConnectionStatus({
        modelType: "flant5", // Keep using flant5 as the model type for tracking
        status: "connected",
        responseTime: Date.now() - startTime,
      })

      return { decision, reasoning }
    }
  } catch (error) {
    const latency = Date.now() - startTime
    let errorMessage = ""
    
    // Improved error classification
    if (error instanceof Error) {
      if (error.message.includes("401")) {
        errorMessage = "Authentication error with DeepSeek API. Please check your API token."
        console.error(`[HF API] ${errorMessage}`)
      } else if (error.message.includes("429")) {
        errorMessage = "Rate limit exceeded for DeepSeek API. Please try again later."
        console.error(`[HF API] ${errorMessage}`)
      } else if (error.message.includes("503") || error.message.includes("502")) {
        errorMessage = "DeepSeek API is temporarily unavailable. Service may be down."
        console.error(`[HF API] ${errorMessage}`)
      } else {
        errorMessage = `Error querying DeepSeek: ${error.message}`
        console.error(`[HF API] ${errorMessage}`)
      }
    } else {
      errorMessage = `Unknown error querying DeepSeek: ${String(error)}`
      console.error(`[HF API] ${errorMessage}`)
    }

    updateConnectionStatus({
      modelType: "flant5", // Keep using flant5 as the model type for tracking
      status: "disconnected",
      responseTime: latency,
      errorMessage,
    })

    // Instead of throwing, use the fallback
    console.log("[HF API] Using fallback decision making due to DeepSeek API error")
    return fallbackDecisionMaking(prompt)
  } finally {
    // Record the prediction attempt
    recordPrediction({
      timestamp: startTime,
      modelType: "flant5", // Keep using flant5 as the model type for tracking
      input: prompt,
      output: success ? "Success" : `Error: ${errorMessage}`,
      latency: Date.now() - startTime,
      success,
      error: success ? undefined : errorMessage,
    })
  }
}

// Enhanced fallback for decision making with reasoning
function fallbackDecisionMaking(prompt: string): { decision: string; reasoning: string } {
  console.log("[HF API] Using enhanced decision making fallback")

  // Convert prompt to lowercase for easier matching
  const promptLower = prompt.toLowerCase()
  let reasoning = "Trading decision reasoning:\n"

  // Extract technical indicators from the prompt
  const indicators = {
    rsi: Number.parseFloat(
      promptLower.match(/rsi:?\s*([\d.]+)/i)?.[1] || promptLower.match(/rsi\s+(?:is|of|at|=)\s*([\d.]+)/i)?.[1] || "50",
    ),
    macd: Number.parseFloat(
      promptLower.match(/macd:?\s*([-\d.]+)/i)?.[1] ||
        promptLower.match(/macd\s+(?:is|of|at|=)\s*([-\d.]+)/i)?.[1] ||
        "0",
    ),
    signal: Number.parseFloat(
      promptLower.match(/signal:?\s*([-\d.]+)/i)?.[1] ||
        promptLower.match(/signal\s+(?:is|of|at|=)\s*([-\d.]+)/i)?.[1] ||
        "0",
    ),
    risk: Number.parseFloat(
      promptLower.match(/risk:?\s*([\d.]+)/i)?.[1] ||
        promptLower.match(/risk\s+(?:is|of|at|=)\s*([\d.]+)/i)?.[1] ||
        "0.5",
    ),
  }

  reasoning += `- Extracted indicators: RSI=${indicators.rsi}, MACD=${indicators.macd}, Signal=${indicators.signal}, Risk=${indicators.risk}\n`

  // Check for market conditions
  const marketConditions = {
    volatile: promptLower.includes("volatile") || promptLower.includes("volatility"),
    trending: promptLower.includes("trending") || promptLower.includes("trend"),
    uptrend: promptLower.includes("uptrend") || promptLower.includes("bullish"),
    downtrend: promptLower.includes("downtrend") || promptLower.includes("bearish"),
    sideways: promptLower.includes("sideways") || promptLower.includes("range"),
  }

  // Log detected market conditions
  const detectedConditions = Object.entries(marketConditions)
    .filter(([_, detected]) => detected)
    .map(([condition, _]) => condition)

  if (detectedConditions.length > 0) {
    reasoning += `- Detected market conditions: ${detectedConditions.join(", ")}\n`
  } else {
    reasoning += "- No specific market conditions detected\n"
  }

  // Decision logic based on multiple factors
  let decision = "HOLD"
  let decisionReason = ""

  // 1. High risk override - if risk is very high, be conservative
  if (indicators.risk > 0.7) {
    decision = "HOLD"
    decisionReason = "High risk level (> 0.7) detected, recommending HOLD as a conservative approach"
    reasoning += `- ${decisionReason}\n`
    return { decision, reasoning }
  }

  // 2. RSI-based decisions
  if (indicators.rsi > 70) {
    // Overbought condition
    decision = "SELL"
    decisionReason = "RSI > 70 indicates overbought conditions, suggesting SELL"
    reasoning += `- ${decisionReason}\n`
    return { decision, reasoning }
  } else if (indicators.rsi < 30) {
    // Oversold condition
    decision = "BUY"
    decisionReason = "RSI < 30 indicates oversold conditions, suggesting BUY"
    reasoning += `- ${decisionReason}\n`
    return { decision, reasoning }
  }

  // 3. MACD-based decisions
  if (indicators.macd > 0 && indicators.macd > indicators.signal) {
    // MACD is positive and above signal line - bullish
    if (indicators.risk < 0.5) {
      decision = "BUY"
      decisionReason = "MACD is positive and above signal line with acceptable risk, suggesting BUY"
      reasoning += `- ${decisionReason}\n`
      return { decision, reasoning }
    } else {
      reasoning += "- MACD is bullish but risk is elevated, continuing analysis\n"
    }
  } else if (indicators.macd < 0 && indicators.macd < indicators.signal) {
    // MACD is negative and below signal line - bearish
    decision = "SELL"
    decisionReason = "MACD is negative and below signal line, suggesting SELL"
    reasoning += `- ${decisionReason}\n`
    return { decision, reasoning }
  }

  // 4. Market condition based decisions
  if (marketConditions.volatile && indicators.risk > 0.5) {
    // High volatility and moderate risk - better to hold
    decision = "HOLD"
    decisionReason = "Market is volatile with moderate to high risk, suggesting HOLD"
    reasoning += `- ${decisionReason}\n`
    return { decision, reasoning }
  }

  if (marketConditions.uptrend && indicators.risk < 0.6) {
    decision = "BUY"
    decisionReason = "Market is in uptrend with acceptable risk, suggesting BUY"
    reasoning += `- ${decisionReason}\n`
    return { decision, reasoning }
  }

  if (marketConditions.downtrend) {
    decision = "SELL"
    decisionReason = "Market is in downtrend, suggesting SELL"
    reasoning += `- ${decisionReason}\n`
    return { decision, reasoning }
  }

  if (marketConditions.sideways) {
    decision = "HOLD"
    decisionReason = "Market is moving sideways, suggesting HOLD"
    reasoning += `- ${decisionReason}\n`
    return { decision, reasoning }
  }

  // Default to HOLD if no clear signal
  reasoning += "- No strong signals detected, defaulting to HOLD\n"
  return { decision: "HOLD", reasoning }
}

// Query FLAN-T5 for decision making (now using DeepSeek)
export async function queryFLANT5(prompt: string): Promise<{ decision: string; reasoning: string }> {
  try {
    // Use DeepSeek instead of FLAN-T5
    return await queryDeepSeek(prompt)
  } catch (error) {
    console.error("[HF API] Error in queryFLANT5:", error)
    // Return a fallback decision with reasoning
    return fallbackDecisionMaking(prompt)
  }
}

// Interface for BART response
interface BARTResponse {
  summary_text: string
}

// Enhanced fallback for summarization with reasoning
function fallbackSummarization(text: string): { summary: string; reasoning: string } {
  console.log("[HF API] Using enhanced summarization fallback")

  // Split text into sentences
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  let reasoning = "Summarization reasoning:\n"

  if (sentences.length === 0) {
    reasoning += "- No content to summarize\n"
    return { summary: "No content to summarize.", reasoning }
  }

  if (sentences.length === 1) {
    reasoning += "- Text contains only one sentence, returning as is\n"
    return { summary: sentences[0].trim(), reasoning }
  }

  // For longer texts, use a more sophisticated approach
  if (sentences.length > 2) {
    reasoning += `- Text contains ${sentences.length} sentences, using frequency-based extraction\n`

    // Calculate word frequency to identify important sentences
    const wordFrequency: Record<string, number> = {}
    const stopWords = ["the", "and", "that", "this", "with", "for", "was", "were", "from", "have", "has"]

    // Count word frequencies
    sentences.forEach((sentence) => {
      const words = sentence.toLowerCase().split(/\s+/)
      words.forEach((word) => {
        // Ignore very short words and common stop words
        if (word.length > 3 && !stopWords.includes(word)) {
          wordFrequency[word] = (wordFrequency[word] || 0) + 1
        }
      })
    })

    reasoning += `- Identified ${Object.keys(wordFrequency).length} unique keywords\n`

    // Get top keywords for reasoning
    const topKeywords = Object.entries(wordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => `${word} (${count})`)

    reasoning += `- Top keywords: ${topKeywords.join(", ")}\n`

    // Score sentences based on word frequency
    const sentenceScores = sentences.map((sentence, index) => {
      const words = sentence.toLowerCase().split(/\s+/)
      let score = 0

      words.forEach((word) => {
        if (wordFrequency[word]) {
          score += wordFrequency[word]
        }
      })

      // Normalize by sentence length to avoid bias towards longer sentences
      return { sentence, score: score / words.length, index }
    })

    // Sort sentences by score
    sentenceScores.sort((a, b) => b.score - a.score)

    // Take top 2-3 sentences depending on text length
    const numSentences = Math.min(3, Math.ceil(sentences.length / 3))
    const topSentences = sentenceScores.slice(0, numSentences)

    reasoning += `- Selected top ${numSentences} sentences by relevance score\n`
    reasoning += `- Sentence scores: ${topSentences.map((s) => `#${s.index + 1} (${s.score.toFixed(2)})`).join(", ")}\n`

    // Sort back to original order
    topSentences.sort((a, b) => a.index - b.index)

    // Join the top sentences
    const summary = topSentences.map((item) => item.sentence.trim()).join(". ") + "."
    reasoning += "- Arranged selected sentences in original order for coherence\n"

    return { summary, reasoning }
  }

  // For very short texts, just return first and last sentence
  reasoning += "- Text is short, using first and last sentence extraction\n"

  const summary = `${sentences[0].trim()}. ${sentences[sentences.length - 1].trim()}.`

  return { summary, reasoning }
}

// Query BART for summarization
export async function queryBART(text: string): Promise<{ summary: string; reasoning: string }> {
  try {
    const response = await queryHuggingFace<BARTResponse>("facebook/bart-large-cnn", { inputs: text }, "bart")

    return {
      summary: response.summary_text,
      reasoning:
        "Summarization performed by BART model, which uses a neural network trained on millions of documents to extract key information while maintaining context and coherence.",
    }
  } catch (error) {
    console.error("[HF API] Error in queryBART, using enhanced fallback:", error)

    // Use enhanced fallback summarization
    return fallbackSummarization(text)
  }
}

// Interface for DeepSeek response
interface DeepSeekResponse {
  choices: {
    message: {
      content: string
    }
  }[]
}

// Query DeepSeek for decision making
async function queryDeepSeek(prompt: string): Promise<{ decision: string; reasoning: string }> {
  const startTime = Date.now()
  let success = false
  const errorMessage = ""

  try {
    if (!HF_API_TOKEN) {
      throw new Error("Hugging Face API token is not set. Please set the HUGGING_FACE_API_TOKEN environment variable.")
    }

    console.log("[HF API] Querying DeepSeek with prompt:", prompt)

    // Format the prompt for DeepSeek
    const formattedPrompt = `You are a trading assistant that helps make decisions based on market indicators.
    
Given the following information, provide a clear trading decision (BUY, SELL, or HOLD) followed by your reasoning.
Your response should start with the decision in capital letters on the first line, then provide your detailed reasoning.

${prompt}

Remember to consider risk levels carefully. If risk is high (>0.7), be more conservative in your recommendation.`

    // Try using Hugging Face directly with DeepSeek model
    try {
      console.log("[HF API] Attempting to use Hugging Face endpoint for DeepSeek")

      // Use Hugging Face text generation API directly
      const response = await fetch(
        "https://api-inference.huggingface.co/models/deepseek-ai/deepseek-coder-33b-instruct",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${HF_API_TOKEN}`,
          },
          body: JSON.stringify({
            inputs: formattedPrompt,
            parameters: {
              max_new_tokens: 500,
              temperature: 0.1,
              return_full_text: false,
            },
          }),
          signal: AbortSignal.timeout(20000), // 20 second timeout
        },
      )

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || ""
        if (contentType.includes("text/html")) {
          throw new Error("Service returned HTML instead of JSON (service may be unavailable)")
        }

        throw new Error(`Hugging Face API error (${response.status}): ${response.statusText}`)
      }

      const result = await response.json()

      if (!result || !Array.isArray(result) || !result[0] || !result[0].generated_text) {
        throw new Error("Invalid response format from Hugging Face")
      }

      const content = result[0].generated_text.trim()
      console.log(`[HF API] Response from DeepSeek via Hugging Face:`, content)

      // Extract decision from the first line
      const lines = content.split("\n")
      let decision = "HOLD" // Default
      const reasoning = content

      // Try to extract the decision from the first line
      if (lines.length > 0) {
        const firstLine = lines[0].toUpperCase()
        if (firstLine.includes("BUY")) {
          decision = "BUY"
        } else if (firstLine.includes("SELL")) {
          decision = "SELL"
        } else if (firstLine.includes("HOLD")) {
          decision = "HOLD"
        }
      }

      success = true

      updateConnectionStatus({
        modelType: "flant5", // Keep using flant5 as the model type for tracking
        status: "connected",
        responseTime: Date.now() - startTime,
      })

      return { decision, reasoning }
    } catch (huggingFaceError) {
      console.warn(`[HF API] Hugging Face endpoint failed: ${huggingFaceError.message}`)

      // Fall back to OpenAI-compatible endpoint
      console.log("[HF API] Falling back to OpenAI-compatible endpoint")

      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${HF_API_TOKEN}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "user",
              content: formattedPrompt,
            },
          ],
          max_tokens: 500,
          temperature: 0.1, // Low temperature for more deterministic responses
        }),
        signal: AbortSignal.timeout(20000), // 20 second timeout
      })

      if (!response.ok) {
        throw new Error(`DeepSeek API error (${response.status}): ${response.statusText}`)
      }

      const result = await response.json()

      if (!result || !result.choices || !result.choices[0] || !result.choices[0].message) {
        throw new Error("Invalid response format from DeepSeek")
      }

      const content = result.choices[0].message.content.trim()
      console.log(`[HF API] Response from DeepSeek:`, content)

      // Extract decision from the first line
      const lines = content.split("\n")
      let decision = "HOLD" // Default
      const reasoning = content

      // Try to extract the decision from the first line
      if (lines.length > 0) {
        const firstLine = lines[0].toUpperCase()
        if (firstLine.includes("BUY")) {
          decision = "BUY"
        } else if (firstLine.includes("SELL")) {
          decision = "SELL"
        } else if (firstLine.includes("HOLD")) {
          decision = "HOLD"
        }
      }

      success = true

      updateConnectionStatus({
        modelType: "flant5", // Keep using flant5 as the model type for tracking
        status: "connected",
        responseTime: Date.now() - startTime,
      })

      return { decision, reasoning }
    }
  } catch (error) {
    const latency = Date.now() - startTime
    let errorMessage = ""
    
    // Improved error classification
    if (error instanceof Error) {
      if (error.message.includes("401")) {
        errorMessage = "Authentication error with DeepSeek API. Please check your API token."
        console.error(`[HF API] ${errorMessage}`)
      } else if (error.message.includes("429")) {
        errorMessage = "Rate limit exceeded for DeepSeek API. Please try again later."
        console.error(`[HF API] ${errorMessage}`)
      } else if (error.message.includes("503") || error.message.includes("502")) {
        errorMessage = "DeepSeek API is temporarily unavailable. Service may be down."
        console.error(`[HF API] ${errorMessage}`)
      } else {
        errorMessage = `Error querying DeepSeek: ${error.message}`
        console.error(`[HF API] ${errorMessage}`)
      }
    } else {
      errorMessage = `Unknown error querying DeepSeek: ${String(error)}`
      console.error(`[HF API] ${errorMessage}`)
    }

    updateConnectionStatus({
      modelType: "flant5", // Keep using flant5 as the model type for tracking
      status: "disconnected",
      responseTime: latency,
      errorMessage,
    })

    // Instead of throwing, use the fallback
    console.log("[HF API] Using fallback decision making due to DeepSeek API error")
    return fallbackDecisionMaking(prompt)
  } finally {
    // Record the prediction attempt
    recordPrediction({
      timestamp: startTime,
      modelType: "flant5", // Keep using flant5 as the model type for tracking
      input: prompt,
      output: success ? "Success" : `Error: ${errorMessage}`,
      latency: Date.now() - startTime,
      success,
      error: success ? undefined : errorMessage,
    })
  }
}

// Enhanced fallback for decision making with reasoning
function fallbackDecisionMaking(prompt: string): { decision: string; reasoning: string } {
  console.log("[HF API] Using enhanced decision making fallback")

  // Convert prompt to lowercase for easier matching
  const promptLower = prompt.toLowerCase()
  let reasoning = "Trading decision reasoning:\n"

  // Extract technical indicators from the prompt
  const indicators = {
    rsi: Number.parseFloat(
      promptLower.match(/rsi:?\s*([\d.]+)/i)?.[1] || promptLower.match(/rsi\s+(?:is|of|at|=)\s*([\d.]+)/i)?.[1] || "50",
    ),
    macd: Number.parseFloat(
      promptLower.match(/macd:?\s*([-\d.]+)/i)?.[1] ||
        promptLower.match(/macd\s+(?:is|of|at|=)\s*([-\d.]+)/i)?.[1] ||
        "0",
    ),
    signal: Number.parseFloat(
      promptLower.match(/signal:?\s*([-\d.]+)/i)?.[1] ||
        promptLower.match(/signal\s+(?:is|of|at|=)\s*([-\d.]+)/i)?.[1] ||
        "0",
    ),
    risk: Number.parseFloat(
      promptLower.match(/risk:?\s*([\d.]+)/i)?.[1] ||
        promptLower.match(/risk\s+(?:is|of|at|=)\s*([\d.]+)/i)?.[1] ||
        "0.5",
    ),
  }

  reasoning += `- Extracted indicators: RSI=${indicators.rsi}, MACD=${indicators.macd}, Signal=${indicators.signal}, Risk=${indicators.risk}\n`

  // Check for market conditions
  const marketConditions = {
    volatile: promptLower.includes("volatile") || promptLower.includes("volatility"),
    trending: promptLower.includes("trending") || promptLower.includes("trend"),
    uptrend: promptLower.includes("uptrend") || promptLower.includes("bullish"),
    downtrend: promptLower.includes("downtrend") || promptLower.includes("bearish"),
    sideways: promptLower.includes("sideways") || promptLower.includes("range"),
  }

  // Log detected market conditions
  const detectedConditions = Object.entries(marketConditions)
    .filter(([_, detected]) => detected)
    .map(([condition, _]) => condition)

  if (detectedConditions.length > 0) {
    reasoning += `- Detected market conditions: ${detectedConditions.join(", ")}\n`
  } else {
    reasoning += "- No specific market conditions detected\n"
  }

  // Decision logic based on multiple factors
  let decision = "HOLD"
  let decisionReason = ""

  // 1. High risk override - if risk is very high, be conservative
  if (indicators.risk > 0.7) {
    decision = "HOLD"
    decisionReason = "High risk level (> 0.7) detected, recommending HOLD as a conservative approach"
    reasoning += `- ${decisionReason}\n`
    return { decision, reasoning }
  }

  // 2. RSI-based decisions
  if (indicators.rsi > 70) {
    // Overbought condition
    decision = "SELL"
    decisionReason = "RSI > 70 indicates overbought conditions, suggesting SELL"
    reasoning += `- ${decisionReason}\n`
    return { decision, reasoning }
  } else if (indicators.rsi < 30) {
    // Oversold condition
    decision = "BUY"
    decisionReason = "RSI < 30 indicates oversold conditions, suggesting BUY"
    reasoning += `- ${decisionReason}\n`
    return { decision, reasoning }
  }

  // 3. MACD-based decisions
  if (indicators.macd > 0 && indicators.macd > indicators.signal) {
    // MACD is positive and above signal line - bullish
    if (indicators.risk < 0.5) {
      decision = "BUY"
      decisionReason = "MACD is positive and above signal line with acceptable risk, suggesting BUY"
      reasoning += `- ${decisionReason}\n`
      return { decision, reasoning }
    } else {
      reasoning += "- MACD is bullish but risk is elevated, continuing analysis\n"
    }
  } else if (indicators.macd < 0 && indicators.macd < indicators.signal) {
    // MACD is negative and below signal line - bearish
    decision = "SELL"
    decisionReason = "MACD is negative and below signal line, suggesting SELL"
    reasoning += `- ${decisionReason}\n`
    return { decision, reasoning }
  }

  // 4. Market condition based decisions
  if (marketConditions.volatile && indicators.risk > 0.5) {
    // High volatility and moderate risk - better to hold
    decision = "HOLD"
    decisionReason = "Market is volatile with moderate to high risk, suggesting HOLD"
    reasoning += `- ${decisionReason}\n`
    return { decision, reasoning }
  }

  if (marketConditions.uptrend && indicators.risk < 0.6) {
    decision = "BUY"
    decisionReason = "Market is in uptrend with acceptable risk, suggesting BUY"
    reasoning += `- ${decisionReason}\n`
    return { decision, reasoning }
  }

  if (marketConditions.downtrend) {
    decision = "SELL"
    decisionReason = "Market is in downtrend, suggesting SELL"
    reasoning += `- ${decisionReason}\n`
    return { decision, reasoning }
  }

  if (marketConditions.sideways) {
    decision = "HOLD"
    decisionReason = "Market is moving sideways, suggesting HOLD"
    reasoning += `- ${decisionReason}\n`
    return { decision, reasoning }
  }

  // Default to HOLD if no clear signal
  reasoning += "- No strong signals detected, defaulting to HOLD\n"
  return { decision: "HOLD", reasoning }
}

// Query FLAN-T5 for decision making (now using DeepSeek)
export async function queryFLANT5(prompt: string): Promise<{ decision: string; reasoning: string }> {
  try {
    // Use DeepSeek instead of FLAN-T5
    return await queryDeepSeek(prompt)
  } catch (error) {
    console.error("[HF API] Error in queryFLANT5:", error)
    // Return a fallback decision with reasoning
    return fallbackDecisionMaking(prompt)
  }
}

// Interface for BART response
interface BARTResponse {
  summary_text: string
}

// Enhanced fallback for summarization with reasoning
function fallbackSummarization(text: string): { summary: string; reasoning: string } {
  console.log("[HF API] Using enhanced summarization fallback")

  // Split text into sentences
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  let reasoning = "Summarization reasoning:\n"

  if (sentences.length === 0) {
    reasoning += "- No content to summarize\n"
    return { summary: "No content to summarize.", reasoning }
  }

  if (sentences.length === 1) {
    reasoning += "- Text contains only one sentence, returning as is\n"
    return { summary: sentences[0].trim(), reasoning }
  }

  // For longer texts, use a more sophisticated approach
  if (sentences.length > 2) {
    reasoning += `- Text contains ${sentences.length} sentences, using frequency-based extraction\n`

    // Calculate word frequency to identify important sentences
    const wordFrequency: Record<string, number> = {}
    const stopWords = ["the", "and", "that", "this", "with", "for", "was", "were", "from", "have", "has"]

    // Count word frequencies
    sentences.forEach((sentence) => {
      const words = sentence.toLowerCase().split(/\s+/)
      words.forEach((word) => {
        // Ignore very short words and common stop words
        if (word.length > 3 && !stopWords.includes(word)) {
          wordFrequency[word] = (wordFrequency[word] || 0) + 1
        }
      })
    })

    reasoning += `- Identified ${Object.keys(wordFrequency).length} unique keywords\n`

    // Get top keywords for reasoning
    const topKeywords = Object.entries(wordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => `${word} (${count})`)

    reasoning += `- Top keywords: ${topKeywords.join(", ")}\n`

    // Score sentences based on word frequency
    const sentenceScores = sentences.map((sentence, index) => {
      const words = sentence.toLowerCase().split(/\s+/)
      let score = 0

      words.forEach((word) => {
        if (wordFrequency[word]) {
          score += wordFrequency[word]
        }
      })

      // Normalize by sentence length to avoid bias towards longer sentences
      return { sentence, score: score / words.length, index }
    })

    // Sort sentences by score
    sentenceScores.sort((a, b) => b.score - a.score)

    // Take top 2-3 sentences depending on text length
    const numSentences = Math.min(3, Math.ceil(sentences.length / 3))
    const topSentences = sentenceScores.slice(0, numSentences)

    reasoning += `- Selected top ${numSentences} sentences by relevance score\n`
    reasoning += `- Sentence scores: ${topSentences.map((s) => `#${s.index + 1} (${s.score.toFixed(2)})`).join(", ")}\n`

    // Sort back to original order
    topSentences.sort((a, b) => a.index - b.index)

    // Join the top sentences
    const summary = topSentences.map((item) => item.sentence.trim()).join(". ") + "."
    reasoning += "- Arranged selected sentences in original order for coherence\n"

    return { summary, reasoning }
  }

  // For very short texts, just return first and last sentence
  reasoning += "- Text is short, using first and last sentence extraction\n"

  const summary = `${sentences[0].trim()}. ${sentences[sentences.length - 1].trim()}.`

  return { summary, reasoning }
}

// Query BART for summarization
export async function queryBART(text: string): Promise<{ summary: string; reasoning: string }> {
  try {
    const response = await queryHuggingFace<BARTResponse>("facebook/bart-large-cnn", { inputs: text }, "bart")

    return {
      summary: response.summary_text,
      reasoning:
        "Summarization performed by BART model, which uses a neural network trained on millions of documents to extract key information while maintaining context and coherence.",
    }
  } catch (error) {
    console.error("[HF API] Error in queryBART, using enhanced fallback:", error)

    // Use enhanced fallback summarization
    return fallbackSummarization(text)
  }
}
