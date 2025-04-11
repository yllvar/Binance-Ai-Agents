"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useMobile } from "@/hooks/use-mobile"

interface BacktestReportProps {
  symbol: string
}

interface BacktestData {
  totalTrades: number
  winRate: number
  profitFactor: number
  sharpeRatio: number
  maxDrawdown: number
  netProfit: number
  summary: string
}

export function BacktestReport({ symbol }: BacktestReportProps) {
  const [backtest, setBacktest] = useState<BacktestData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isMobile = useMobile()

  const runBacktest = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/backtest?symbol=${symbol}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to run backtest: ${response.statusText}`)
      }

      const data = await response.json()
      setBacktest(data)
    } catch (err) {
      console.error("Backtest error:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className={isMobile ? "px-3 py-2" : undefined}>
        <CardTitle className="text-base md:text-lg">Backtest Report: {symbol}</CardTitle>
      </CardHeader>
      <CardContent className={isMobile ? "px-3 py-2" : undefined}>
        <Button onClick={runBacktest} disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Backtest...
            </>
          ) : (
            "Run Backtest"
          )}
        </Button>

        {error && (
          <Alert variant="destructive" className="mb-4 mt-4 text-xs md:text-sm">
            <AlertCircle className="h-4 w-4 mr-2" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {backtest && (
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 border rounded-md">
                <div className="text-xs md:text-sm text-gray-500">Win Rate</div>
                <div className="text-sm md:text-lg font-semibold">{(backtest.winRate * 100).toFixed(1)}%</div>
              </div>
              <div className="p-2 border rounded-md">
                <div className="text-xs md:text-sm text-gray-500">Profit Factor</div>
                <div className="text-sm md:text-lg font-semibold">{backtest.profitFactor.toFixed(2)}</div>
              </div>
              <div className="p-2 border rounded-md">
                <div className="text-xs md:text-sm text-gray-500">Sharpe Ratio</div>
                <div className="text-sm md:text-lg font-semibold">{backtest.sharpeRatio.toFixed(2)}</div>
              </div>
              <div className="p-2 border rounded-md">
                <div className="text-xs md:text-sm text-gray-500">Max Drawdown</div>
                <div className="text-sm md:text-lg font-semibold">{(backtest.maxDrawdown * 100).toFixed(1)}%</div>
              </div>
              <div className="p-2 border rounded-md col-span-2">
                <div className="text-xs md:text-sm text-gray-500">Net Profit</div>
                <div className="text-sm md:text-lg font-semibold">
                  {backtest.netProfit > 0 ? "+" : ""}
                  {backtest.netProfit.toFixed(2)}%
                </div>
              </div>
            </div>

            <div className="p-3 bg-gray-100 rounded-md">
              <div className="text-xs md:text-sm font-medium mb-1">AI Summary</div>
              <div className="text-xs md:text-sm">{backtest.summary}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
