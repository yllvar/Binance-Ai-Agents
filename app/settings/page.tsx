"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, Save, RefreshCw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { hasApiCredentials, getTradingConfig, saveTradingConfig } from "@/lib/utils/storage"
import type { TradingConfig, RiskParameters } from "@/lib/types/trading"
import { EnvSetup } from "@/components/env-setup"
import { DebugPanel } from "@/components/debug-panel"
import { TradingModeSelector } from "@/components/trading-mode-selector"
import { FuturesSettings } from "@/components/futures-settings"
import { useMobile } from "@/hooks/use-mobile"

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [hasCredentials, setHasCredentials] = useState(false)
  const [showEnvSetup, setShowEnvSetup] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [symbol, setSymbol] = useState("BTCUSDT")
  const [tradingMode, setTradingMode] = useState<"spot" | "futures">("spot")
  const isMobile = useMobile()

  // Trading settings
  const [tradingEnabled, setTradingEnabled] = useState(false)
  const [testMode, setTestMode] = useState(true)

  // Risk parameters
  const [maxPositionSize, setMaxPositionSize] = useState(100)
  const [stopLossPercent, setStopLossPercent] = useState(2)
  const [takeProfitPercent, setTakeProfitPercent] = useState(4)
  const [maxDailyLoss, setMaxDailyLoss] = useState(200)
  const [maxDrawdownPercent, setMaxDrawdownPercent] = useState(10)

  // Futures settings
  const [futuresConfig, setFuturesConfig] = useState<any>({
    hedgeMode: false,
    marginType: "ISOLATED",
    defaultLeverage: 3,
  })

  // Allowed symbols
  const [allowedSymbols, setAllowedSymbols] = useState<string[]>([
    "BTCUSDT",
    "ETHUSDT",
    "BNBUSDT",
    "ADAUSDT",
    "DOGEUSDT",
  ])
  const [newSymbol, setNewSymbol] = useState("")

  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true)
      setError(null)

      try {
        // Check if credentials exist
        const credentialsExist = hasApiCredentials()
        setHasCredentials(credentialsExist)

        // Fetch trading config from API if credentials exist
        if (credentialsExist) {
          const response = await fetch("/api/trading/config")
          const data = await response.json()

          if (response.ok && data.config) {
            const config = data.config

            // Set trading settings
            setTradingEnabled(config.enabled)
            setTestMode(config.testMode)
            setTradingMode(config.tradingMode || "spot")

            // Set risk parameters
            setMaxPositionSize(config.riskParameters.maxPositionSize)
            setStopLossPercent(config.riskParameters.stopLossPercent)
            setTakeProfitPercent(config.riskParameters.takeProfitPercent)
            setMaxDailyLoss(config.riskParameters.maxDailyLoss)
            setMaxDrawdownPercent(config.riskParameters.maxDrawdownPercent)

            // Set futures config if available
            if (config.futuresConfig) {
              setFuturesConfig(config.futuresConfig)
            }

            // Set allowed symbols
            setAllowedSymbols(config.allowedSymbols)
          }
        } else {
          // Load from local storage if available
          const storedConfig = getTradingConfig()
          if (storedConfig) {
            setTradingEnabled(storedConfig.enabled)
            setTestMode(storedConfig.testMode)
            setTradingMode(storedConfig.tradingMode || "spot")

            setMaxPositionSize(storedConfig.riskParameters.maxPositionSize)
            setStopLossPercent(storedConfig.riskParameters.stopLossPercent)
            setTakeProfitPercent(storedConfig.riskParameters.takeProfitPercent)
            setMaxDailyLoss(storedConfig.riskParameters.maxDailyLoss)
            setMaxDrawdownPercent(storedConfig.riskParameters.maxDrawdownPercent)

            if (storedConfig.futuresConfig) {
              setFuturesConfig(storedConfig.futuresConfig)
            }

            setAllowedSymbols(storedConfig.allowedSymbols)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings")
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const saveSettings = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const riskParameters: RiskParameters = {
        maxPositionSize,
        maxLeverage: tradingMode === "futures" ? futuresConfig.defaultLeverage : 1,
        stopLossPercent,
        takeProfitPercent,
        maxDailyLoss,
        maxDrawdownPercent,
      }

      const config: TradingConfig = {
        enabled: tradingEnabled,
        testMode,
        tradingMode,
        riskParameters,
        allowedSymbols,
        futuresConfig,
      }

      // Save to local storage
      saveTradingConfig(config)

      // If credentials exist, also update via API
      if (hasCredentials) {
        const response = await fetch("/api/trading/config", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to save settings")
        }
      }

      setSuccess(true)

      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccess(false)
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const addSymbol = () => {
    if (!newSymbol) return

    // Convert to uppercase and ensure it ends with USDT
    let symbol = newSymbol.toUpperCase()
    if (!symbol.endsWith("USDT")) {
      symbol = `${symbol}USDT`
    }

    // Don't add duplicates
    if (!allowedSymbols.includes(symbol)) {
      setAllowedSymbols([...allowedSymbols, symbol])
    }

    setNewSymbol("")
  }

  const removeSymbol = (symbol: string) => {
    setAllowedSymbols(allowedSymbols.filter((s) => s !== symbol))
  }

  const handleFuturesConfigChange = (key: string, value: any) => {
    setFuturesConfig((prev: any) => {
      const newConfig = { ...prev }

      // Handle nested keys like "futuresSpecific.hedgeMode"
      if (key.includes(".")) {
        const [parent, child] = key.split(".")
        newConfig[parent] = { ...newConfig[parent], [child]: value }
      } else {
        newConfig[key] = value
      }

      return newConfig
    })
  }

  return (
    <main className="flex min-h-screen flex-col p-3 md:p-6 bg-gray-50">
      <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:justify-between md:items-center gap-2">
        <h1 className="text-xl md:text-3xl font-bold">Settings</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size={isMobile ? "sm" : "default"} onClick={() => setShowEnvSetup(!showEnvSetup)}>
            {showEnvSetup ? "Hide Environment Setup" : "Environment Setup"}
          </Button>
          <Button variant="outline" size={isMobile ? "sm" : "default"} onClick={() => setShowDebug(!showDebug)}>
            {showDebug ? "Hide Debug" : "Show Debug"}
          </Button>
        </div>
      </div>

      {showEnvSetup && (
        <div className="mb-4 md:mb-6">
          <EnvSetup />
        </div>
      )}

      {showDebug && (
        <div className="mb-4 md:mb-6">
          <DebugPanel symbol={symbol} />
        </div>
      )}

      <div className="mb-6">
        <TradingModeSelector />
      </div>

      <Tabs defaultValue="trading" className="w-full max-w-4xl mx-auto">
        <TabsList className="mb-4 md:mb-6 w-full justify-start overflow-x-auto">
          <TabsTrigger value="trading">Trading</TabsTrigger>
          <TabsTrigger value="risk">Risk Management</TabsTrigger>
          {tradingMode === "futures" && <TabsTrigger value="futures">Futures Settings</TabsTrigger>}
          <TabsTrigger value="symbols">Trading Pairs</TabsTrigger>
        </TabsList>

        <TabsContent value="trading">
          <Card>
            <CardHeader className={isMobile ? "px-3 py-2" : undefined}>
              <CardTitle className="text-base md:text-lg">Trading Settings</CardTitle>
            </CardHeader>
            <CardContent className={`space-y-4 md:space-y-6 ${isMobile ? "px-3 py-2" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="trading-enabled">Enable Trading</Label>
                  <p className="text-xs md:text-sm text-gray-500">Allow the AI agent to execute trades</p>
                </div>
                <Switch id="trading-enabled" checked={tradingEnabled} onCheckedChange={setTradingEnabled} />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="test-mode">Test Mode</Label>
                  <p className="text-xs md:text-sm text-gray-500">Simulate trades without using real funds</p>
                </div>
                <Switch id="test-mode" checked={testMode} onCheckedChange={setTestMode} />
              </div>

              {!hasCredentials && (
                <Alert className="mt-4 text-xs md:text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You haven't set up your Binance API credentials yet. Go to the Trading page to set them up.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk">
          <Card>
            <CardHeader className={isMobile ? "px-3 py-2" : undefined}>
              <CardTitle className="text-base md:text-lg">Risk Management</CardTitle>
            </CardHeader>
            <CardContent className={`space-y-4 md:space-y-6 ${isMobile ? "px-3 py-2" : ""}`}>
              <div className="space-y-2 md:space-y-3">
                <div className="flex justify-between">
                  <Label htmlFor="max-position" className="text-xs md:text-sm">
                    Maximum Position Size (USDT)
                  </Label>
                  <span className="text-xs md:text-sm font-medium">${maxPositionSize}</span>
                </div>
                <Slider
                  id="max-position"
                  min={10}
                  max={1000}
                  step={10}
                  value={[maxPositionSize]}
                  onValueChange={(value) => setMaxPositionSize(value[0])}
                />
                <p className="text-xs text-gray-500">Maximum amount of USDT to use per trade</p>
              </div>

              <Separator />

              <div className="space-y-2 md:space-y-3">
                <div className="flex justify-between">
                  <Label htmlFor="stop-loss" className="text-xs md:text-sm">
                    Stop Loss (%)
                  </Label>
                  <span className="text-xs md:text-sm font-medium">{stopLossPercent}%</span>
                </div>
                <Slider
                  id="stop-loss"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={[stopLossPercent]}
                  onValueChange={(value) => setStopLossPercent(value[0])}
                />
                <p className="text-xs text-gray-500">Default stop loss percentage for trades</p>
              </div>

              <div className="space-y-2 md:space-y-3">
                <div className="flex justify-between">
                  <Label htmlFor="take-profit" className="text-xs md:text-sm">
                    Take Profit (%)
                  </Label>
                  <span className="text-xs md:text-sm font-medium">{takeProfitPercent}%</span>
                </div>
                <Slider
                  id="take-profit"
                  min={1}
                  max={20}
                  step={0.5}
                  value={[takeProfitPercent]}
                  onValueChange={(value) => setTakeProfitPercent(value[0])}
                />
                <p className="text-xs text-gray-500">Default take profit percentage for trades</p>
              </div>

              <Separator />

              <div className="space-y-2 md:space-y-3">
                <div className="flex justify-between">
                  <Label htmlFor="max-daily-loss" className="text-xs md:text-sm">
                    Maximum Daily Loss (USDT)
                  </Label>
                  <span className="text-xs md:text-sm font-medium">${maxDailyLoss}</span>
                </div>
                <Slider
                  id="max-daily-loss"
                  min={10}
                  max={1000}
                  step={10}
                  value={[maxDailyLoss]}
                  onValueChange={(value) => setMaxDailyLoss(value[0])}
                />
                <p className="text-xs text-gray-500">Stop trading if daily losses exceed this amount</p>
              </div>

              <div className="space-y-2 md:space-y-3">
                <div className="flex justify-between">
                  <Label htmlFor="max-drawdown" className="text-xs md:text-sm">
                    Maximum Drawdown (%)
                  </Label>
                  <span className="text-xs md:text-sm font-medium">{maxDrawdownPercent}%</span>
                </div>
                <Slider
                  id="max-drawdown"
                  min={5}
                  max={50}
                  step={5}
                  value={[maxDrawdownPercent]}
                  onValueChange={(value) => setMaxDrawdownPercent(value[0])}
                />
                <p className="text-xs text-gray-500">Stop trading if account drawdown exceeds this percentage</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {tradingMode === "futures" && (
          <TabsContent value="futures">
            <FuturesSettings config={futuresConfig} onChange={handleFuturesConfigChange} />
          </TabsContent>
        )}

        <TabsContent value="symbols">
          <Card>
            <CardHeader className={isMobile ? "px-3 py-2" : undefined}>
              <CardTitle className="text-base md:text-lg">Trading Pairs</CardTitle>
            </CardHeader>
            <CardContent className={`space-y-4 md:space-y-6 ${isMobile ? "px-3 py-2" : ""}`}>
              <div className="flex gap-2">
                <Input
                  placeholder="Add symbol (e.g. BTC)"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={addSymbol} size={isMobile ? "sm" : "default"}>
                  Add
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {allowedSymbols.map((symbol) => (
                  <div key={symbol} className="flex items-center bg-gray-100 rounded-md px-2 py-1">
                    <span className="mr-2 text-xs md:text-sm">{symbol}</span>
                    <button onClick={() => removeSymbol(symbol)} className="text-gray-500 hover:text-red-500">
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-500">These are the trading pairs the AI agent is allowed to trade</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex flex-col md:flex-row md:justify-end mt-4 md:mt-6 max-w-4xl mx-auto w-full gap-2">
        {error && (
          <Alert variant="destructive" className="md:mr-4 flex-1 text-xs md:text-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="md:mr-4 flex-1 bg-green-50 border-green-200 text-xs md:text-sm">
            <AlertDescription className="text-green-600">Settings saved successfully</AlertDescription>
          </Alert>
        )}

        <Button onClick={saveSettings} disabled={saving} className={isMobile ? "w-full" : ""}>
          {saving ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </main>
  )
}
