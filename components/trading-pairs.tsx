"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useMobile } from "@/hooks/use-mobile"

interface TradingPairsProps {
  symbol: string
  onSymbolChange: (symbol: string) => void
}

export function TradingPairs({ symbol, onSymbolChange }: TradingPairsProps) {
  const isMobile = useMobile()
  const pairs = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "DOGEUSDT"]

  if (isMobile) {
    return (
      <div className="flex overflow-x-auto gap-2 pb-1">
        {pairs.map((pair) => (
          <button
            key={pair}
            onClick={() => onSymbolChange(pair)}
            className={`px-3 py-2 text-sm rounded-md whitespace-nowrap flex-shrink-0 ${
              symbol === pair ? "bg-blue-500 text-white" : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            {pair.replace("USDT", "")}
          </button>
        ))}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trading Pairs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {pairs.map((pair) => (
            <button
              key={pair}
              onClick={() => onSymbolChange(pair)}
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
  )
}
