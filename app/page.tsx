"use client"

import { useState } from "react"
import { TradingPanel } from "@/components/trading-panel"
import { ApexChart } from "@/components/apex-chart"
import { TradingHistory } from "@/components/trading-history"
import { BacktestReport } from "@/components/backtest-report"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useMobile } from "@/hooks/use-mobile"
import { TradingPairs } from "@/components/trading-pairs"

export default function Home() {
  const [symbol, setSymbol] = useState("BTCUSDT")
  const [activeTab, setActiveTab] = useState("chart")
  const isMobile = useMobile()

  const handleSymbolChange = (newSymbol: string) => {
    setSymbol(newSymbol)
  }

  return (
    <main className="flex min-h-screen flex-col p-3 md:p-6 bg-gray-50">
      {/* Mobile Trading Pairs */}
      <div className="mb-4 md:hidden">
        <TradingPairs symbol={symbol} onSymbolChange={handleSymbolChange} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 w-full justify-start overflow-x-auto">
              <TabsTrigger value="chart">Chart</TabsTrigger>
              <TabsTrigger value="history">Trading History</TabsTrigger>
              <TabsTrigger value="backtest">Backtest</TabsTrigger>
            </TabsList>

            <TabsContent value="chart" className="m-0">
              <ApexChart symbol={symbol} />
            </TabsContent>

            <TabsContent value="history" className="m-0">
              <TradingHistory symbol={symbol} />
            </TabsContent>

            <TabsContent value="backtest" className="m-0">
              <BacktestReport symbol={symbol} />
            </TabsContent>
          </Tabs>
        </div>

        <div>
          {/* Desktop Trading Pairs */}
          <div className="hidden md:block mb-4">
            <TradingPairs symbol={symbol} onSymbolChange={handleSymbolChange} />
          </div>

          <TradingPanel symbol={symbol} />
        </div>
      </div>
    </main>
  )
}
