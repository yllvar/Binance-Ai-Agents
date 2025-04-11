"use client"

import { useEffect, useRef, useState } from "react"
import { createChart, ColorType, CrosshairMode } from "lightweight-charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, TrendingUp, TrendingDown, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { convertToChartData, formatPrice, determinePricePrecision, calculateChange } from "@/lib/utils/chart-data"
import type { MarketData } from "@/lib/types"
import type { TradingMode } from "@/lib/types/trading"

interface TradingChartProps {
  symbol: string
  initialMarketType?: "spot" | "futures"
}

export function TradingChart({ symbol, initialMarketType = "spot" }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<MarketData[]>([])
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState("1h")
  const [error, setError] = useState<string | null>(null)
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [priceChange, setPriceChange] = useState<number>(0)
  const [chartInstance, setChartInstance] = useState<any>(null)
  const [candlestickSeries, setCandlestickSeries] = useState<any>(null)
  const [volumeSeries, setVolumeSeries] = useState<any>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [useMockData, setUseMockData] = useState(false)
  const [marketType, setMarketType] = useState<"spot" | "futures">(initialMarketType)
  const [globalTradingMode, setGlobalTradingMode] = useState<TradingMode>("spot")
  const [syncWithGlobalMode, setSyncWithGlobalMode] = useState(true)
  const wsRef = useRef<WebSocket | null>(null)

  // Fetch global trading mode
  useEffect(() => {
    const fetchTradingMode = async () => {
      try {
        const response = await fetch("/api/trading/mode")
        if (response.ok) {
          const data = await response.json()
          if (data.mode) {
            setGlobalTradingMode(data.mode)
            if (syncWithGlobalMode) {
              setMarketType(data.mode)
            }
          }
        }
      } catch (error) {
        console.error("Error fetching trading mode:", error)
      }
    }

    fetchTradingMode()
    // Set up an interval to periodically check for trading mode changes
    const intervalId = setInterval(fetchTradingMode, 30000) // Check every 30 seconds

    return () => clearInterval(intervalId)
  }, [syncWithGlobalMode])

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    // Clear previous chart
    chartContainerRef.current.innerHTML = ""

    // Create main chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "white" },
        textColor: "#333",
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "#D1D4DC",
      },
      rightPriceScale: {
        borderColor: "#D1D4DC",
      },
      grid: {
        vertLines: {
          color: "#F0F3FA",
        },
        horzLines: {
          color: "#F0F3FA",
        },
      },
    })

    // Create candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    })
    setCandlestickSeries(candleSeries)

    // Create volume series
    const volSeries = chart.addHistogramSeries({
      color: "#26a69a",
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "volume",
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    })
    setVolumeSeries(volSeries)

    // Handle window resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }

    window.addEventListener("resize", handleResize)
    setChartInstance(chart)

    return () => {
      window.removeEventListener("resize", handleResize)
      chart.remove()
    }
  }, [])

  // Fetch data and set up WebSocket
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log(
        `Fetching ${marketType} market data for ${symbol} with timeframe ${timeframe}${useMockData ? " (mock)" : ""}`,
      )
      const response = await fetch(
        `/api/market-data?symbol=${symbol}&timeframe=${timeframe}&marketType=${marketType}${useMockData ? "&mock=true" : ""}`,
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch market data")
      }

      const marketData = await response.json()

      if (!Array.isArray(marketData)) {
        console.error("Invalid market data format:", marketData)
        throw new Error("Invalid market data format received")
      }

      console.log(`Received ${marketData.length} data points for ${marketType} market`)
      setData(marketData)

      // Update current price and price change
      if (marketData.length > 0) {
        const latestData = marketData[marketData.length - 1]
        const previousData = marketData[marketData.length - 2] || latestData
        setCurrentPrice(latestData.close)
        setPriceChange(calculateChange(latestData.close, previousData.close))
      }

      // Update chart with data
      if (candlestickSeries && volumeSeries) {
        const { ohlcData, volumeData } = convertToChartData(marketData)
        candlestickSeries.setData(ohlcData)
        volumeSeries.setData(volumeData)
      }
    } catch (err) {
      console.error("Error fetching market data:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  // Set up WebSocket connection
  const setupWebSocket = () => {
    // Don't set up WebSocket for mock data
    if (useMockData) {
      setWsConnected(false)
      return
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close()
      clearInterval(wsRef.current.pingInterval)
    }

    // Determine the appropriate WebSocket URL based on market type
    let wsUrl: string
    if (marketType === "futures") {
      wsUrl = `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@kline_${timeframe}`
    } else {
      wsUrl = `wss://stream.binance.com/ws/${symbol.toLowerCase()}@kline_${timeframe}`
    }

    console.log(`Connecting to WebSocket: ${wsUrl}`)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    // Set up ping interval to keep connection alive (every 3 minutes as per Binance docs)
    const pingInterval = setInterval(
      () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ method: "PING" }))
          console.log(`Sent ping to ${marketType} WebSocket`)
        }
      },
      3 * 60 * 1000,
    ) // 3 minutes

    // Store the interval on the ws object for cleanup
    ;(ws as any).pingInterval = pingInterval

    // Set up reconnection timeout (24 hours as per Binance docs)
    const reconnectTimeout = setTimeout(
      () => {
        console.log(`24-hour limit reached, reconnecting ${marketType} WebSocket`)
        if (ws.readyState === WebSocket.OPEN) {
          ws.close()
        }
        setupWebSocket() // Reconnect
      },
      23 * 60 * 60 * 1000,
    ) // 23 hours (slightly less than 24 to be safe)

    // Store the timeout on the ws object for cleanup
    ;(ws as any).reconnectTimeout = reconnectTimeout

    ws.onopen = () => {
      console.log(`WebSocket connected for ${symbol} ${timeframe} (${marketType})`)
      setWsConnected(true)
    }

    ws.onclose = (event) => {
      console.log(`WebSocket disconnected for ${symbol} ${timeframe} (${marketType})`, event.code, event.reason)
      setWsConnected(false)

      // Clear intervals and timeouts
      clearInterval(pingInterval)
      clearTimeout(reconnectTimeout)

      // Attempt to reconnect after a delay, unless it was intentionally closed
      if (event.code !== 1000) {
        setTimeout(() => {
          console.log(`Attempting to reconnect ${marketType} WebSocket...`)
          setupWebSocket()
        }, 5000) // 5 second delay before reconnecting
      }
    }

    ws.onerror = (error) => {
      console.error(`WebSocket error for ${marketType}:`, error)
      setWsConnected(false)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)

        // Handle pong response
        if (message.result === "pong") {
          console.log(`Received pong from ${marketType} WebSocket`)
          return
        }

        // Handle different message formats based on market type
        let kline

        if (marketType === "futures") {
          // Handle both regular kline and continuous_kline formats for futures
          if (message.e === "continuous_kline") {
            kline = message.k
          } else if (message.e === "kline") {
            kline = message.k
          } else if (message.k) {
            // Fallback for direct kline object
            kline = message.k
          } else {
            console.log(`Unknown futures message format:`, message)
            return
          }
        } else {
          // Spot market format
          if (message.k) {
            kline = message.k
          } else {
            console.log(`Unknown spot message format:`, message)
            return
          }
        }

        if (kline) {
          // Update the latest candle in real-time
          const updatedCandle = {
            time: kline.t / 1000,
            open: Number.parseFloat(kline.o),
            high: Number.parseFloat(kline.h),
            low: Number.parseFloat(kline.l),
            close: Number.parseFloat(kline.c),
          }

          const updatedVolume = {
            time: kline.t / 1000,
            value: Number.parseFloat(kline.v),
            color:
              Number.parseFloat(kline.c) >= Number.parseFloat(kline.o)
                ? "rgba(0, 150, 136, 0.5)"
                : "rgba(255, 82, 82, 0.5)",
          }

          if (candlestickSeries && volumeSeries) {
            candlestickSeries.update(updatedCandle)
            volumeSeries.update(updatedVolume)
          }

          // Update current price and price change
          const newPrice = Number.parseFloat(kline.c)
          setCurrentPrice((prevPrice) => {
            if (prevPrice !== null) {
              setPriceChange(calculateChange(newPrice, prevPrice))
            }
            return newPrice
          })
        }
      } catch (error) {
        console.error(`Error processing ${marketType} WebSocket message:`, error)
      }
    }
  }

  // Effect for fetching data and setting up WebSocket
  useEffect(() => {
    fetchData()
    setupWebSocket()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        // Clear any intervals or timeouts associated with the WebSocket
        if ((wsRef.current as any).pingInterval) {
          clearInterval((wsRef.current as any).pingInterval)
        }
        if ((wsRef.current as any).reconnectTimeout) {
          clearTimeout((wsRef.current as any).reconnectTimeout)
        }
      }
    }
  }, [symbol, timeframe, marketType, useMockData, candlestickSeries, volumeSeries])

  // Effect to sync with global trading mode when syncWithGlobalMode is true
  useEffect(() => {
    if (syncWithGlobalMode && globalTradingMode !== marketType) {
      setMarketType(globalTradingMode)
    }
  }, [globalTradingMode, syncWithGlobalMode])

  const handleTimeframeChange = (value: string) => {
    setTimeframe(value)
  }

  const handleMarketTypeChange = (value: "spot" | "futures") => {
    setMarketType(value)
    // If changing manually, disable sync with global mode
    setSyncWithGlobalMode(false)
  }

  const handleRefresh = () => {
    fetchData()
  }

  const toggleMockData = () => {
    setUseMockData(!useMockData)
  }

  const toggleSyncWithGlobalMode = () => {
    const newSyncValue = !syncWithGlobalMode
    setSyncWithGlobalMode(newSyncValue)

    // If enabling sync, immediately update to global mode
    if (newSyncValue && globalTradingMode !== marketType) {
      setMarketType(globalTradingMode)
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CardTitle>
              {marketType === "futures" ? "Futures" : "Spot"} Chart: {symbol}
            </CardTitle>
            {currentPrice !== null && (
              <div className="flex items-center">
                <span className="text-lg font-medium ml-2">
                  ${formatPrice(currentPrice, determinePricePrecision(currentPrice))}
                </span>
                <span
                  className={`text-sm ml-2 flex items-center ${priceChange >= 0 ? "text-green-600" : "text-red-600"}`}
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
            {!useMockData && (
              <div
                className={`w-2 h-2 rounded-full ml-2 ${wsConnected ? "bg-green-500" : "bg-red-500"}`}
                title={wsConnected ? "WebSocket connected" : "WebSocket disconnected"}
              />
            )}
            {useMockData && (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded ml-2">Mock Data</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-2 mr-2">
              <Switch id="mock-data" checked={useMockData} onCheckedChange={toggleMockData} />
              <Label htmlFor="mock-data" className="text-xs">
                Mock Data
              </Label>
            </div>
            <div className="flex items-center space-x-2 mr-2">
              <Switch id="sync-mode" checked={syncWithGlobalMode} onCheckedChange={toggleSyncWithGlobalMode} />
              <Label htmlFor="sync-mode" className="text-xs">
                Sync with Trading Mode
              </Label>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="mr-2">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Tabs
              defaultValue={marketType}
              onValueChange={(value) => handleMarketTypeChange(value as "spot" | "futures")}
            >
              <TabsList>
                <TabsTrigger value="spot">Spot</TabsTrigger>
                <TabsTrigger value="futures">Futures</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs defaultValue={timeframe} onValueChange={handleTimeframeChange}>
              <TabsList>
                <TabsTrigger value="1m">1m</TabsTrigger>
                <TabsTrigger value="5m">5m</TabsTrigger>
                <TabsTrigger value="15m">15m</TabsTrigger>
                <TabsTrigger value="1h">1h</TabsTrigger>
                <TabsTrigger value="4h">4h</TabsTrigger>
                <TabsTrigger value="1d">1d</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex items-center text-red-500 mb-4">
              <AlertCircle className="h-6 w-6 mr-2" />
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
        ) : (
          <div ref={chartContainerRef} className="h-[500px] w-full" />
        )}
      </CardContent>
    </Card>
  )
}
