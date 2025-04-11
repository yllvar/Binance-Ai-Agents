"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, TrendingUp, TrendingDown, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface TradingPanelProps {
  symbol: string
}

export function TradingPanel({ symbol }: TradingPanelProps) {
  const [action, setAction] = useState<string>("")
  const [risk, setRisk] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tradeResult, setTradeResult] = useState<any | null>(null)
  const [tradingEnabled, setTradingEnabled] = useState(false)
  const [testMode, setTestMode] = useState(true)
  const [reasoning, setReasoning] = useState<any | null>(null)
  const [useFallback, setUseFallback] = useState(false)
  const [isMobile] = useState(false)
  const [modelResults, setModelResults] = useState<any | null>(null)
  const [useFallbackMode, setUseFallbackMode] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  const executeTrade = async () => {
    try {
      setLoading(true)
      setError(null)
      setReasoning(null)
      setModelResults(null)

      const response = await fetch(`/api/trade?symbol=${symbol}${useFallback ? "&fallback=true" : ""}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.details || errorData.error || `Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setAction(data.action)
      setRisk(data.risk)

      // Store the reasoning data
      if (data.reasoning) {
        setReasoning(data.reasoning)
      }

      setModelResults(data.modelResults)
      setUseFallbackMode(data.useFallback)
    } catch (err) {
      console.error("Error executing trade analysis:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")

      // If we're not already using fallback mode, suggest it
      if (!useFallback) {
        setError(
          (prevError) => `${prevError instanceof Error ? prevError.message : prevError}. Try enabling Fallback Mode.`,
        )
      }
    } finally {
      setLoading(false)
    }
  }

  const executeRealTrade = async () => {
    try {
      setExecuting(true)
      setError(null)
      setTradeResult(null)

      const response = await fetch("/api/trading/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symbol,
          action,
          confidence: 1 - risk, // Convert risk to confidence
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to execute trade")
      }

      setTradeResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setExecuting(false)
    }
  }

  const getActionColor = () => {
    if (action === "BUY") return "bg-green-500"
    if (action === "SELL") return "bg-red-500"
    return "bg-yellow-500"
  }

  const getRiskColor = () => {
    if (risk < 0.3) return "bg-green-500"
    if (risk < 0.7) return "bg-yellow-500"
    return "bg-red-500"
  }

  const fetchTradingConfig = async () => {
    try {
      const response = await fetch("/api/trading/config")
      const data = await response.json()

      if (response.ok && data.config) {
        setTradingEnabled(data.config.enabled)
        setTestMode(data.config.testMode)
      }
    } catch (error) {
      console.error("Error fetching trading config:", error)
    }
  }

  // Auto-retry with fallback if there's an error
  useEffect(() => {
    if (error && retryCount === 0 && !useFallback) {
      setRetryCount(1)
      setUseFallback(true)
      // Wait a moment before retrying
      const timer = setTimeout(() => {
        executeTrade()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [error, useFallback, retryCount])

  useEffect(() => {
    fetchTradingConfig()
  }, [])

  return (
    <Card>
      <CardHeader className={isMobile ? "px-3 py-2" : undefined}>
        <CardTitle className="flex justify-between items-center text-base md:text-lg">
          <span>Trading Panel</span>
          <Badge variant="outline">{symbol}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className={isMobile ? "px-3 py-2" : undefined}>
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Switch id="use-fallback" checked={useFallback} onCheckedChange={setUseFallback} />
              <Label htmlFor="use-fallback" className="text-xs md:text-sm">
                Use Fallback Mode
              </Label>
            </div>
            {useFallback && (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                Using Fallback
              </Badge>
            )}
          </div>

          <Button onClick={executeTrade} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Run AI Analysis"
            )}
          </Button>

          {error && (
            <div className="p-3 bg-red-100 text-red-800 rounded-md flex items-center text-sm">
              <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          )}

          {modelResults && (
            <div className="space-y-4 mt-4">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">AI Analysis Results</h3>
                  {useFallbackMode && (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300">
                      Fallback Mode Active
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Decision</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div
                        className={cn(
                          "text-2xl font-bold",
                          modelResults.decision === "BUY"
                            ? "text-green-600"
                            : modelResults.decision === "SELL"
                              ? "text-red-600"
                              : "text-yellow-600",
                        )}
                      >
                        {modelResults.decision}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Risk Assessment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={modelResults.riskScore * 100}
                          className="h-2"
                          indicatorClassName={cn(
                            modelResults.riskScore < 0.3
                              ? "bg-green-500"
                              : modelResults.riskScore < 0.7
                                ? "bg-yellow-500"
                                : "bg-red-500",
                          )}
                        />
                        <span className="text-sm font-medium">{(modelResults.riskScore * 100).toFixed(0)}%</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Add model status indicators */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                  <Badge
                    variant={modelResults.tapasUsingFallback ? "outline" : "secondary"}
                    className={modelResults.tapasUsingFallback ? "bg-yellow-50 text-yellow-800" : ""}
                  >
                    Tapas: {modelResults.tapasUsingFallback ? "Fallback" : "Online"}
                  </Badge>
                  <Badge
                    variant={modelResults.sentimentUsingFallback ? "outline" : "secondary"}
                    className={modelResults.sentimentUsingFallback ? "bg-yellow-50 text-yellow-800" : ""}
                  >
                    Sentiment: {modelResults.sentimentUsingFallback ? "Fallback" : "Online"}
                  </Badge>
                  <Badge
                    variant={modelResults.decisionUsingFallback ? "outline" : "secondary"}
                    className={modelResults.decisionUsingFallback ? "bg-yellow-50 text-yellow-800" : ""}
                  >
                    Decision: {modelResults.decisionUsingFallback ? "Fallback" : "Online"}
                  </Badge>
                  <Badge
                    variant={modelResults.summaryUsingFallback ? "outline" : "secondary"}
                    className={modelResults.summaryUsingFallback ? "bg-yellow-50 text-yellow-800" : ""}
                  >
                    Summary: {modelResults.summaryUsingFallback ? "Fallback" : "Online"}
                  </Badge>
                </div>

                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="reasoning">
                    <AccordionTrigger>View Model Reasoning</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 text-sm">
                        {modelResults.tapasReasoning && (
                          <div>
                            <h4 className="font-medium mb-1">
                              Table Analysis{modelResults.tapasUsingFallback && " (Fallback)"}
                            </h4>
                            <div className="bg-gray-50 p-3 rounded-md whitespace-pre-wrap">
                              {modelResults.tapasReasoning}
                            </div>
                          </div>
                        )}

                        {modelResults.sentimentReasoning && (
                          <div>
                            <h4 className="font-medium mb-1">
                              Sentiment Analysis{modelResults.sentimentUsingFallback && " (Fallback)"}
                            </h4>
                            <div className="bg-gray-50 p-3 rounded-md whitespace-pre-wrap">
                              {modelResults.sentimentReasoning}
                            </div>
                          </div>
                        )}

                        {modelResults.decisionReasoning && (
                          <div>
                            <h4 className="font-medium mb-1">
                              Decision Making{modelResults.decisionUsingFallback && " (Fallback)"}
                            </h4>
                            <div className="bg-gray-50 p-3 rounded-md whitespace-pre-wrap">
                              {modelResults.decisionReasoning}
                            </div>
                          </div>
                        )}

                        {modelResults.summaryReasoning && (
                          <div>
                            <h4 className="font-medium mb-1">
                              Summary{modelResults.summaryUsingFallback && " (Fallback)"}
                            </h4>
                            <div className="bg-gray-50 p-3 rounded-md whitespace-pre-wrap">
                              {modelResults.summaryReasoning}
                            </div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
          )}

          {action && !modelResults && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center p-3 border rounded-md">
                <span className="text-xs md:text-sm font-medium mb-1">Decision</span>
                <Badge className={getActionColor()}>
                  {action === "BUY" ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : action === "SELL" ? (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  ) : null}
                  {action}
                </Badge>
              </div>

              <div className="flex flex-col items-center p-3 border rounded-md">
                <span className="text-xs md:text-sm font-medium mb-1">Risk Level</span>
                <Badge className={getRiskColor()}>{(risk * 100).toFixed(0)}%</Badge>
              </div>
            </div>
          )}

          {reasoning && !modelResults && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="reasoning">
                <AccordionTrigger className="text-sm font-medium">View Analysis Reasoning</AccordionTrigger>
                <AccordionContent>
                  <div className="text-xs md:text-sm space-y-3 mt-2">
                    {reasoning.signal && (
                      <div className="p-2 bg-gray-50 rounded-md">
                        <div className="font-medium mb-1">Signal Analysis:</div>
                        <div className="whitespace-pre-wrap">{reasoning.signal}</div>
                      </div>
                    )}

                    {reasoning.risk && (
                      <div className="p-2 bg-gray-50 rounded-md">
                        <div className="font-medium mb-1">Risk Assessment:</div>
                        <div className="whitespace-pre-wrap">{reasoning.risk}</div>
                      </div>
                    )}

                    {reasoning.decision && (
                      <div className="p-2 bg-gray-50 rounded-md">
                        <div className="font-medium mb-1">Decision Making:</div>
                        <div className="whitespace-pre-wrap">{reasoning.decision}</div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {action && (
            <Button
              onClick={executeRealTrade}
              disabled={executing || !tradingEnabled || !action || action === "HOLD"}
              className="w-full"
              variant={action === "BUY" ? "default" : action === "SELL" ? "destructive" : "secondary"}
              size={isMobile ? "sm" : "default"}
            >
              {executing ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Executing...
                </>
              ) : (
                `Execute ${action} Trade`
              )}
            </Button>
          )}

          {!tradingEnabled && action && action !== "HOLD" && (
            <Alert variant="warning" className="text-xs md:text-sm">
              <AlertCircle className="h-3 w-3 mr-1" />
              <AlertDescription>Trading is disabled. Enable it in Settings.</AlertDescription>
            </Alert>
          )}

          {testMode && tradingEnabled && action && action !== "HOLD" && (
            <Alert className="text-xs md:text-sm">
              <AlertCircle className="h-3 w-3 mr-1" />
              <AlertDescription>Test mode active. No real trades will execute.</AlertDescription>
            </Alert>
          )}

          {tradeResult && (
            <div className="p-3 border rounded-md text-xs md:text-sm">
              <h3 className="font-medium mb-1">Trade Result</h3>
              {tradeResult.success ? (
                <div className="text-green-600">
                  Trade executed successfully!
                  {tradeResult.order && (
                    <div className="mt-2 text-xs">
                      <div>Order ID: {tradeResult.orderId}</div>
                      <div>Symbol: {tradeResult.order.symbol}</div>
                      <div>Type: {tradeResult.order.type}</div>
                      <div>Status: {tradeResult.order.status}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-red-600 break-words">Failed: {tradeResult.errorMessage}</div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
