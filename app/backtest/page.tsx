"use client"

import { useState } from "react"
import { BacktestReport } from "@/components/backtest-report"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function BacktestPage() {
  const [symbol, setSymbol] = useState("BTCUSDT")

  const handleSymbolChange = (newSymbol: string) => {
    setSymbol(newSymbol)
  }

  return (
    <main className="flex min-h-screen flex-col p-6 bg-gray-50">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Backtest</h1>
        <p className="text-gray-500">Run and analyze backtests for your trading strategies</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <BacktestReport symbol={symbol} />
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Trading Pairs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {["BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "DOGEUSDT"].map((pair) => (
                  <button
                    key={pair}
                    onClick={() => handleSymbolChange(pair)}
                    className={`px-3 py-2 text-sm rounded-md ${
                      symbol === pair ? "bg-blue-500 text-white" : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    {pair.replace("USDT", "")}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
