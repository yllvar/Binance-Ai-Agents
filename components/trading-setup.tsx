"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, AlertCircle, CheckCircle2, Trash2 } from "lucide-react"
import type { TradingConfig } from "@/lib/types/trading"
import { saveApiCredentials, getApiCredentials, clearApiCredentials, hasApiCredentials } from "@/lib/utils/storage"

export function TradingSetup() {
  const [apiKey, setApiKey] = useState("")
  const [apiSecret, setApiSecret] = useState("")
  const [testMode, setTestMode] = useState(true)
  const [status, setStatus] = useState<"idle" | "initializing" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [config, setConfig] = useState<TradingConfig | null>(null)
  const [hasCredentials, setHasCredentials] = useState(false)

  // Load saved credentials on component mount
  useEffect(() => {
    const checkCredentials = () => {
      const hasStoredCredentials = hasApiCredentials()
      setHasCredentials(hasStoredCredentials)

      if (hasStoredCredentials) {
        const { apiKey, apiSecret } = getApiCredentials()
        setApiKey(apiKey)
        setApiSecret(apiSecret)
      }
    }

    checkCredentials()
    fetchConfig()
  }, [])

  const initializeTrading = async () => {
    if (!apiKey || !apiSecret) {
      setStatus("error")
      setErrorMessage("API key and secret are required")
      return
    }

    try {
      setStatus("initializing")
      setErrorMessage("")

      // Save credentials to browser storage
      saveApiCredentials(apiKey, apiSecret)
      setHasCredentials(true)

      const response = await fetch("/api/trading/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey,
          apiSecret,
          testMode,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to initialize trading service")
      }

      setConfig(data.config)
      setStatus("success")
    } catch (error) {
      setStatus("error")
      setErrorMessage(error instanceof Error ? error.message : "An unknown error occurred")
    }
  }

  const clearCredentials = () => {
    clearApiCredentials()
    setApiKey("")
    setApiSecret("")
    setHasCredentials(false)
    setStatus("idle")
  }

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/trading/config")
      const data = await response.json()

      if (response.ok && data.config) {
        setConfig(data.config)
        setTestMode(data.config.testMode)
      }
    } catch (error) {
      console.error("Error fetching trading config:", error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trading Setup</CardTitle>
        <CardDescription>Configure your Binance API credentials to enable trading</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="api-key">Binance API Key</Label>
              {hasCredentials && (
                <Button variant="ghost" size="sm" onClick={clearCredentials}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear Credentials
                </Button>
              )}
            </div>
            <Input
              id="api-key"
              type="password"
              placeholder="Enter your Binance API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Your API key will be stored securely in your browser's local storage.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-secret">Binance API Secret</Label>
            <Input
              id="api-secret"
              type="password"
              placeholder="Enter your Binance API secret"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Your API secret will be stored securely in your browser's local storage.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="test-mode" checked={testMode} onCheckedChange={setTestMode} />
            <Label htmlFor="test-mode">Test Mode (No real trades will be executed)</Label>
          </div>

          <Alert variant="warning">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Security Notice</AlertTitle>
            <AlertDescription>
              Your API credentials will be stored in your browser's local storage. For security, use API keys with
              trading permissions only (no withdrawal access) and don't use this on shared computers.
            </AlertDescription>
          </Alert>

          <Button onClick={initializeTrading} disabled={status === "initializing"} className="w-full">
            {status === "initializing" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Initializing...
              </>
            ) : hasCredentials ? (
              "Reconnect Trading Service"
            ) : (
              "Initialize Trading"
            )}
          </Button>

          {status === "success" && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-700">Success!</AlertTitle>
              <AlertDescription className="text-green-600">
                Trading service initialized successfully.
                {config?.testMode && " Running in test mode - no real trades will be executed."}
              </AlertDescription>
            </Alert>
          )}

          {status === "error" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {config && (
            <div className="mt-4 p-4 border rounded-md">
              <h3 className="font-medium mb-2">Current Configuration</h3>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Trading Enabled:</span>
                  <span>{config.enabled ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Test Mode:</span>
                  <span>{config.testMode ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Max Position Size:</span>
                  <span>${config.riskParameters.maxPositionSize} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span>Stop Loss:</span>
                  <span>{config.riskParameters.stopLossPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Take Profit:</span>
                  <span>{config.riskParameters.takeProfitPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Max Daily Loss:</span>
                  <span>${config.riskParameters.maxDailyLoss} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span>Max Drawdown:</span>
                  <span>{config.riskParameters.maxDrawdownPercent}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
