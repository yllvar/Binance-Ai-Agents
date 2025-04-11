"use client"

import { useState, useEffect } from "react"
import { TradingChart } from "@/components/trading-chart"
import { TradingPanel } from "@/components/trading-panel"
import { TradingModeSelector } from "@/components/trading-mode-selector"
import { FuturesPositions } from "@/components/futures-positions"
import { FuturesSettings } from "@/components/futures-settings"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import type { TradingMode } from "@/lib/types/trading"

interface TradingDashboardProps {
  symbol: string
}

export function TradingDashboard({ symbol }: TradingDashboardProps) {
  const [tradingMode, setTradingMode] = useState<TradingMode>("spot")
  const [error, setError] = useState<string | null>(null)

  // Fetch current trading mode
  useEffect(() => {
    const fetchTradingMode = async () => {
      try {
        const response = await fetch("/api/trading/mode")
        if (response.ok) {
          const data = await response.json()
          if (data.mode) {
            setTradingMode(data.mode)
          }
        }
      } catch (error) {
        console.error("Error fetching trading mode:", error)
        setError("Failed to fetch trading mode. Please refresh the page.")
      }
    }

    fetchTradingMode()
  }, [])

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="md:col-span-2">
        <TradingChart symbol={symbol} initialMarketType={tradingMode} />
      </div>
      <div className="space-y-4">
        <TradingModeSelector />
        <TradingPanel symbol={symbol} />
        {tradingMode === "futures" && (
          <>
            <FuturesPositions symbol={symbol} />
            <FuturesSettings symbol={symbol} />
          </>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}
