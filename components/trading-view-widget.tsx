"use client"

import { useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface TradingViewWidgetProps {
  symbol: string
  theme?: "light" | "dark"
}

declare global {
  interface Window {
    TradingView?: any
  }
}

export function TradingViewWidget({ symbol = "BTCUSDT", theme = "light" }: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return

    const script = document.createElement("script")
    script.src = "https://s3.tradingview.com/tv.js"
    script.async = true
    script.onload = () => {
      if (typeof window.TradingView !== "undefined") {
        new window.TradingView.widget({
          autosize: true,
          symbol: `BINANCE:${symbol}`,
          interval: "60",
          timezone: "Etc/UTC",
          theme: theme,
          style: "1",
          locale: "en",
          toolbar_bg: theme === "light" ? "#f1f3f6" : "#2a2e39",
          enable_publishing: false,
          allow_symbol_change: true,
          container_id: "tradingview_widget",
        })
      }
    }

    const container_element = container.current
    container_element.appendChild(script)

    return () => {
      while (container_element.firstChild) {
        container_element.removeChild(container_element.firstChild)
      }
    }
  }, [symbol, theme])

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle>TradingView Chart: {symbol}</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: "500px" }}>
          <div id="tradingview_widget" ref={container} style={{ height: "100%", width: "100%" }} />
        </div>
      </CardContent>
    </Card>
  )
}
