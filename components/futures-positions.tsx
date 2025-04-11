"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, TrendingUp, TrendingDown, RefreshCw } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Position } from "@/lib/types/trading"

interface FuturesPositionsProps {
  symbol?: string
}

export function FuturesPositions({ symbol }: FuturesPositionsProps) {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leverage, setLeverage] = useState(3)
  const [marginType, setMarginType] = useState<"ISOLATED" | "CROSSED">("ISOLATED")
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)

  const fetchPositions = async () => {
    try {
      setLoading(true)
      setError(null)

      const url = symbol ? `/api/trading/positions?symbol=${symbol}` : "/api/trading/positions"
      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch positions")
      }

      const data = await response.json()
      setPositions(data.positions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  const refreshPositions = async () => {
    setRefreshing(true)
    await fetchPositions()
    setRefreshing(false)
  }

  const changeLeverage = async () => {
    if (!selectedSymbol) return

    try {
      setRefreshing(true)
      setError(null)

      const response = await fetch("/api/trading/leverage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symbol: selectedSymbol,
          leverage,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to change leverage")
      }

      await refreshPositions()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setRefreshing(false)
    }
  }

  const changeMarginType = async () => {
    if (!selectedSymbol) return

    try {
      setRefreshing(true)
      setError(null)

      const response = await fetch("/api/trading/margin-type", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symbol: selectedSymbol,
          marginType,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to change margin type")
      }

      await refreshPositions()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setRefreshing(false)
    }
  }

  const closePosition = async (position: Position) => {
    try {
      setRefreshing(true)
      setError(null)

      const response = await fetch("/api/trading/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symbol: position.symbol,
          action: position.positionSide === "LONG" || position.positionSide === "BOTH" ? "SELL" : "BUY",
          confidence: 1,
          reduceOnly: true,
          quantity: position.quantity,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to close position")
      }

      await refreshPositions()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchPositions()
  }, [symbol])

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Futures Positions</CardTitle>
          <Button variant="outline" size="sm" onClick={refreshPositions} disabled={refreshing}>
            {refreshing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : positions.length === 0 ? (
          <div className="text-center text-gray-500 py-4">No open positions</div>
        ) : (
          <div className="space-y-4">
            {positions.map((position) => (
              <div key={`${position.symbol}-${position.positionSide}`} className="border rounded-md p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-medium">{position.symbol}</span>
                    <Badge
                      className={
                        position.positionSide === "LONG" || (position.positionSide === "BOTH" && position.quantity > 0)
                          ? "bg-green-500 ml-2"
                          : "bg-red-500 ml-2"
                      }
                    >
                      {position.positionSide === "LONG" ||
                      (position.positionSide === "BOTH" && position.quantity > 0) ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      {position.positionSide}
                    </Badge>
                  </div>
                  <Badge className={position.marginType === "ISOLATED" ? "bg-blue-500" : "bg-purple-500"}>
                    {position.marginType}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                  <div>
                    <span className="text-gray-500">Size:</span> {position.quantity.toFixed(4)}
                  </div>
                  <div>
                    <span className="text-gray-500">Entry Price:</span> ${position.entryPrice.toFixed(2)}
                  </div>
                  <div>
                    <span className="text-gray-500">Mark Price:</span> ${position.markPrice.toFixed(2)}
                  </div>
                  <div>
                    <span className="text-gray-500">Leverage:</span> {position.leverage}x
                  </div>
                  <div>
                    <span className="text-gray-500">Liquidation:</span> ${position.liquidationPrice.toFixed(2)}
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">PnL:</span>{" "}
                    <span className={position.pnl >= 0 ? "text-green-600" : "text-red-600"}>
                      ${position.pnl.toFixed(2)} ({position.pnlPercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>

                <div className="flex justify-between mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedSymbol(position.symbol)
                      setLeverage(position.leverage)
                      setMarginType(position.marginType)
                    }}
                  >
                    Edit Settings
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => closePosition(position)}>
                    Close Position
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedSymbol && (
          <div className="mt-6 border rounded-md p-4">
            <h3 className="font-medium mb-3">Position Settings: {selectedSymbol}</h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="leverage">Leverage: {leverage}x</Label>
                </div>
                <Slider
                  id="leverage"
                  min={1}
                  max={20}
                  step={1}
                  value={[leverage]}
                  onValueChange={(value) => setLeverage(value[0])}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="margin-type">Isolated Margin</Label>
                <Switch
                  id="margin-type"
                  checked={marginType === "ISOLATED"}
                  onCheckedChange={(checked) => setMarginType(checked ? "ISOLATED" : "CROSSED")}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedSymbol(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={changeLeverage}>
                  Update Leverage
                </Button>
                <Button size="sm" onClick={changeMarginType}>
                  Update Margin Type
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
