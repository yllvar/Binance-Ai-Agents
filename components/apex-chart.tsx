"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Loader2, TrendingUp, TrendingDown, AlertCircle, RefreshCw } from "lucide-react"
import { generateMockMarketData } from "@/lib/utils/mock-data"
import type { MarketData } from "@/lib/types"
import dynamic from "next/dynamic"
import { useMobile } from "@/hooks/use-mobile"

// Import ApexCharts on client side only
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false })

interface ApexChartProps {
  symbol: string
}

export function ApexChart({ symbol }: ApexChartProps) {
  const [data, setData] = useState<MarketData[]>([])
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState("1h")
  const [error, setError] = useState<string | null>(null)
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [priceChange, setPriceChange] = useState<number>(0)
  const [useMockData, setUseMockData] = useState(true) // Default to mock data for reliability
  const [chartReady, setChartReady] = useState(false)
  const isMobile = useMobile()

  // Calculate percentage change
  const calculateChange = (currentPrice: number, previousPrice: number): number => {
    if (isNaN(currentPrice) || isNaN(previousPrice) || previousPrice === 0) return 0
    return ((currentPrice - previousPrice) / previousPrice) * 100
  }

  // Format price with appropriate precision
  const formatPrice = (price: number): string => {
    if (isNaN(price)) return "N/A"
    if (price < 0.1) return price.toFixed(6)
    if (price < 1) return price.toFixed(4)
    if (price < 10) return price.toFixed(3)
    if (price < 1000) return price.toFixed(2)
    return price.toFixed(1)
  }

  // Check if window is available (client-side)
  useEffect(() => {
    setChartReady(typeof window !== "undefined")
  }, [])

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      let marketData: MarketData[]

      if (useMockData) {
        // Use mock data
        console.log(`Generating mock data for ${symbol} with timeframe ${timeframe}`)
        marketData = generateMockMarketData(symbol, timeframe, 100)
      } else {
        // Fetch from API
        console.log(`Fetching market data for ${symbol} with timeframe ${timeframe}`)
        const response = await fetch(`/api/market-data?symbol=${symbol}&timeframe=${timeframe}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch market data: ${response.statusText}`)
        }

        marketData = await response.json()

        if (!Array.isArray(marketData)) {
          console.error("Invalid market data format:", marketData)
          throw new Error("Invalid market data format received")
        }
      }

      console.log(`Received ${marketData.length} data points`)
      setData(marketData)

      // Update current price and price change
      if (marketData.length > 0) {
        const latestData = marketData[marketData.length - 1]
        const previousData = marketData[marketData.length - 2] || latestData
        setCurrentPrice(latestData.close)
        setPriceChange(calculateChange(latestData.close, previousData.close))
      }
    } catch (err) {
      console.error("Error fetching market data:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  // Effect for fetching data when parameters change
  useEffect(() => {
    fetchData()
  }, [symbol, timeframe, useMockData])

  const handleTimeframeChange = (value: string) => {
    setTimeframe(value)
  }

  const handleRefresh = () => {
    fetchData()
  }

  const toggleMockData = () => {
    setUseMockData(!useMockData)
  }

  // Prepare data for ApexCharts
  const candlestickData = data.map((item) => ({
    x: new Date(item.timestamp),
    y: [item.open, item.high, item.low, item.close],
  }))

  const options = {
    chart: {
      type: "candlestick",
      height: isMobile ? 300 : 400,
      id: "candles",
      toolbar: {
        autoSelected: "pan",
        show: true,
        tools: {
          download: false,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
        },
      },
      zoom: {
        enabled: true,
      },
    },
    title: {
      text: isMobile ? undefined : `${symbol} Chart`,
      align: "left",
    },
    xaxis: {
      type: "datetime",
      labels: {
        datetimeUTC: false,
        style: {
          fontSize: isMobile ? "10px" : "12px",
        },
      },
    },
    yaxis: {
      tooltip: {
        enabled: true,
      },
      labels: {
        style: {
          fontSize: isMobile ? "10px" : "12px",
        },
      },
    },
    plotOptions: {
      candlestick: {
        wick: {
          useFillColor: true,
        },
      },
    },
  }

  return (
    <Card className="h-full">
      <CardHeader className={`pb-2 ${isMobile ? "px-3 py-2" : ""}`}>
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base md:text-lg">{isMobile ? symbol : `Market Chart: ${symbol}`}</CardTitle>
            {currentPrice !== null && (
              <div className="flex items-center">
                <span className="text-sm md:text-lg font-medium ml-1 md:ml-2">${formatPrice(currentPrice)}</span>
                <span
                  className={`text-xs md:text-sm ml-1 md:ml-2 flex items-center ${priceChange >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {priceChange >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {priceChange >= 0 ? "+" : ""}
                  {priceChange.toFixed(2)}%
                </span>
              </div>
            )}
            {useMockData && (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded ml-1">Mock</span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2 md:mt-0">
            {!isMobile && (
              <div className="flex items-center space-x-2 mr-2">
                <Switch id="mock-data" checked={useMockData} onCheckedChange={toggleMockData} />
                <Label htmlFor="mock-data" className="text-xs">
                  Mock Data
                </Label>
              </div>
            )}

            <Button variant="outline" size="icon" onClick={handleRefresh} className="h-8 w-8">
              <RefreshCw className="h-4 w-4" />
            </Button>

            <Tabs defaultValue={timeframe} onValueChange={handleTimeframeChange}>
              <TabsList className="h-8">
                {isMobile ? (
                  <>
                    <TabsTrigger value="5m" className="text-xs px-2">
                      5m
                    </TabsTrigger>
                    <TabsTrigger value="15m" className="text-xs px-2">
                      15m
                    </TabsTrigger>
                    <TabsTrigger value="1h" className="text-xs px-2">
                      1h
                    </TabsTrigger>
                    <TabsTrigger value="1d" className="text-xs px-2">
                      1d
                    </TabsTrigger>
                  </>
                ) : (
                  <>
                    <TabsTrigger value="1m">1m</TabsTrigger>
                    <TabsTrigger value="5m">5m</TabsTrigger>
                    <TabsTrigger value="15m">15m</TabsTrigger>
                    <TabsTrigger value="1h">1h</TabsTrigger>
                    <TabsTrigger value="4h">4h</TabsTrigger>
                    <TabsTrigger value="1d">1d</TabsTrigger>
                  </>
                )}
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent className={`relative ${isMobile ? "px-2 py-2" : ""}`}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-90 z-10">
            <div className="flex items-center text-red-500 mb-4 text-sm">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>{error}</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleRefresh} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              {!useMockData && (
                <Button onClick={toggleMockData} variant="outline" size="sm">
                  Use Mock Data
                </Button>
              )}
            </div>
          </div>
        )}
        <div className="h-[300px] md:h-[400px] w-full">
          {chartReady && !loading && data.length > 0 && (
            <Chart
              options={options as any}
              series={[{ data: candlestickData }]}
              type="candlestick"
              height={isMobile ? 300 : 400}
            />
          )}
        </div>

        {/* Mobile-only mock data toggle */}
        {isMobile && (
          <div className="flex items-center justify-end mt-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="mobile-mock-data"
                checked={useMockData}
                onCheckedChange={toggleMockData}
                className="scale-75"
              />
              <Label htmlFor="mobile-mock-data" className="text-xs">
                Mock Data
              </Label>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
