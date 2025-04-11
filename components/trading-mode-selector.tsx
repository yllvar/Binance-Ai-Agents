"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { TradingMode } from "@/lib/types/trading"

export function TradingModeSelector() {
  const [mode, setMode] = useState<TradingMode>("spot")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Fetch current trading mode
  useEffect(() => {
    const fetchMode = async () => {
      try {
        const response = await fetch("/api/trading/mode")

        if (response.ok) {
          const data = await response.json()
          if (data.mode) {
            setMode(data.mode)
          }
        }
      } catch (error) {
        console.error("Error fetching trading mode:", error)
      }
    }

    fetchMode()
  }, [])

  // Switch trading mode
  const switchMode = async (newMode: TradingMode) => {
    if (newMode === mode) return

    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      const response = await fetch("/api/trading/mode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: newMode }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Failed to switch to ${newMode} mode`)
      }

      setMode(newMode)
      setSuccess(`Successfully switched to ${newMode} trading mode`)

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (error) {
      setError(error instanceof Error ? error.message : "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trading Mode</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={mode} onValueChange={(value) => switchMode(value as TradingMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="spot" disabled={loading}>
              Spot Trading
            </TabsTrigger>
            <TabsTrigger value="futures" disabled={loading}>
              Futures Trading
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {loading && (
          <div className="flex items-center justify-center mt-4">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span>Switching trading mode...</span>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mt-4 bg-green-50 border-green-200">
            <AlertDescription className="text-green-600">{success}</AlertDescription>
          </Alert>
        )}

        <div className="mt-4 text-sm">
          <p className="font-medium">Current Mode: {mode === "spot" ? "Spot Trading" : "Futures Trading"}</p>
          <p className="text-gray-500 mt-1">
            {mode === "spot"
              ? "Spot trading involves buying and selling actual cryptocurrencies."
              : "Futures trading involves trading contracts with leverage."}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
