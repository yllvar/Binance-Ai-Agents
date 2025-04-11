"use client"

import { TradingViewWidget } from "@/components/trading-view-widget"

interface TradingViewProps {
  symbol: string
}

export function TradingView({ symbol }: TradingViewProps) {
  return <TradingViewWidget symbol={symbol} />
}
