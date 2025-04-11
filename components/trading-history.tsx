"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, TrendingUp, TrendingDown } from "lucide-react"
import { useMobile } from "@/hooks/use-mobile"

interface TradingHistoryProps {
  symbol: string
}

interface Trade {
  id: string
  symbol: string
  action: "BUY" | "SELL"
  price: number
  timestamp: number
  risk: number
  profit?: number
}

export function TradingHistory({ symbol }: TradingHistoryProps) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMobile = useMobile()

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/trade-history?symbol=${symbol}`)

        if (!response.ok) {
          throw new Error("Failed to fetch trade history")
        }

        const data = await response.json()
        setTrades(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchTrades()
  }, [symbol])

  return (
    <Card>
      <CardHeader className={isMobile ? "px-3 py-2" : undefined}>
        <CardTitle className="text-base md:text-lg">Trading History</CardTitle>
      </CardHeader>
      <CardContent className={isMobile ? "px-3 py-2" : undefined}>
        {loading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="p-4 text-red-500 text-center text-sm">{error}</div>
        ) : trades.length === 0 ? (
          <div className="p-4 text-gray-500 text-center text-sm">No trades found</div>
        ) : (
          <div className="space-y-3">
            {trades.map((trade) => (
              <div key={trade.id} className="p-2 border rounded-md">
                <div className="flex justify-between items-center mb-1">
                  <Badge className={trade.action === "BUY" ? "bg-green-500" : "bg-red-500"}>
                    {trade.action === "BUY" ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {trade.action}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {isMobile
                      ? new Date(trade.timestamp).toLocaleTimeString()
                      : new Date(trade.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs md:text-sm">
                  <span>Price: ${trade.price.toFixed(2)}</span>
                  <span>Risk: {(trade.risk * 100).toFixed(0)}%</span>
                  {trade.profit !== undefined && (
                    <span className={trade.profit >= 0 ? "text-green-600" : "text-red-600"}>
                      Profit: {trade.profit >= 0 ? "+" : ""}
                      {trade.profit.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
