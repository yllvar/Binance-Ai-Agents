import { TradingDashboard } from "@/components/trading-dashboard"
import { TradingPairs } from "@/components/trading-pairs"
import { TradingHistory } from "@/components/trading-history"
import { TradingInitializer } from "@/components/trading-initializer"

export const metadata = {
  title: "Trading Dashboard",
  description: "AI-powered trading dashboard for cryptocurrency markets",
}

export default function TradingPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  // Get the symbol from the URL query parameters, default to BTCUSDT
  const symbol = typeof searchParams.symbol === "string" ? searchParams.symbol : "BTCUSDT"

  return (
    <div className="container mx-auto py-4 space-y-4">
      <TradingInitializer />
      <TradingPairs activeSymbol={symbol} />
      <TradingDashboard symbol={symbol} />
      <TradingHistory symbol={symbol} />
    </div>
  )
}
