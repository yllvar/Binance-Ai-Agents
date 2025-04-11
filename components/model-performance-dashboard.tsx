"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import type { ModelPerformanceMetrics, ConnectionStatus, ModelPrediction, ModelType } from "@/lib/types/model-tracking"

export function ModelPerformanceDashboard() {
  const [activeTab, setActiveTab] = useState<ModelType>("tapas")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [metrics, setMetrics] = useState<Record<ModelType, ModelPerformanceMetrics | null>>({
    tapas: null,
    distilbert: null,
    flant5: null,
    bart: null,
  })

  const [statuses, setStatuses] = useState<Record<ModelType, ConnectionStatus | null>>({
    tapas: null,
    distilbert: null,
    flant5: null,
    bart: null,
  })

  const [predictions, setPredictions] = useState<Record<ModelType, ModelPrediction[]>>({
    tapas: [],
    distilbert: [],
    flant5: [],
    bart: [],
  })

  const fetchData = async (modelType: ModelType) => {
    try {
      const response = await fetch(`/api/model-tracking?model=${modelType}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`)
      }

      const data = await response.json()

      setMetrics((prev) => ({
        ...prev,
        [modelType]: data.metrics,
      }))

      setStatuses((prev) => ({
        ...prev,
        [modelType]: data.status,
      }))

      setPredictions((prev) => ({
        ...prev,
        [modelType]: data.recentPredictions || [],
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    }
  }

  const refreshAllData = async () => {
    setRefreshing(true)
    setError(null)

    try {
      await Promise.all([fetchData("tapas"), fetchData("distilbert"), fetchData("flant5"), fetchData("bart")])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setRefreshing(false)
    }
  }

  const clearAllData = async () => {
    try {
      setRefreshing(true)
      const response = await fetch(`/api/model-tracking?action=clear`)

      if (!response.ok) {
        throw new Error(`Failed to clear data: ${response.statusText}`)
      }

      await refreshAllData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await refreshAllData()
      setLoading(false)
    }

    loadData()

    // Set up polling to refresh data every 30 seconds
    const interval = setInterval(refreshAllData, 30000)

    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status?: string) => {
    if (!status) return "bg-gray-500"
    switch (status) {
      case "connected":
        return "bg-green-500"
      case "degraded":
        return "bg-yellow-500"
      case "disconnected":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusIcon = (status?: string) => {
    if (!status) return <Loader2 className="h-4 w-4 animate-spin" />
    switch (status) {
      case "connected":
        return <CheckCircle2 className="h-4 w-4" />
      case "degraded":
        return <AlertTriangle className="h-4 w-4" />
      case "disconnected":
        return <XCircle className="h-4 w-4" />
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />
    }
  }

  const formatTime = (timestamp: number) => {
    if (!timestamp) return "Never"
    return new Date(timestamp).toLocaleString()
  }

  const formatDuration = (ms: number) => {
    if (!ms) return "N/A"
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatPercentage = (value?: number) => {
    if (value === undefined || value === null) return "N/A"
    return `${(value * 100).toFixed(1)}%`
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Model Performance Dashboard</CardTitle>
            <CardDescription>Track the performance of Hugging Face models over time</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refreshAllData} disabled={refreshing}>
              {refreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={clearAllData} disabled={refreshing}>
              Clear Data
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="p-4 text-red-500 text-center">{error}</div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-4 mb-6">
              {(["tapas", "distilbert", "flant5", "bart"] as ModelType[]).map((model) => (
                <Card key={model} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium capitalize">{model === "flant5" ? "DeepSeek v3" : model}</h3>
                    <Badge className={getStatusColor(statuses[model]?.status)}>
                      <span className="flex items-center">
                        {getStatusIcon(statuses[model]?.status)}
                        <span className="ml-1 capitalize">{statuses[model]?.status || "Unknown"}</span>
                      </span>
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500">
                    <div className="flex justify-between">
                      <span>Success Rate:</span>
                      <span className="font-medium">{formatPercentage(metrics[model]?.successRate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Accuracy:</span>
                      <span className="font-medium">{formatPercentage(metrics[model]?.accuracy)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg. Latency:</span>
                      <span className="font-medium">{formatDuration(metrics[model]?.averageLatency || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Used:</span>
                      <span className="font-medium">{formatTime(metrics[model]?.lastUsed || 0)}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Tabs defaultValue="tapas" value={activeTab} onValueChange={(value) => setActiveTab(value as ModelType)}>
              <TabsList className="mb-4">
                <TabsTrigger value="tapas">Tapas</TabsTrigger>
                <TabsTrigger value="distilbert">DistilBERT</TabsTrigger>
                <TabsTrigger value="flant5">DeepSeek v3</TabsTrigger>
                <TabsTrigger value="bart">BART</TabsTrigger>
              </TabsList>

              {(["tapas", "distilbert", "flant5", "bart"] as ModelType[]).map((model) => (
                <TabsContent key={model} value={model}>
                  <div>
                    <h3 className="font-medium mb-2">Recent Predictions</h3>
                    {predictions[model]?.length === 0 ? (
                      <div className="text-center text-gray-500 py-4">No predictions recorded yet</div>
                    ) : (
                      <div className="space-y-2">
                        {predictions[model]?.map((prediction) => (
                          <Card key={prediction.id} className="p-3">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-sm font-medium">
                                {new Date(prediction.timestamp).toLocaleString()}
                              </span>
                              <Badge className={prediction.success ? "bg-green-500" : "bg-red-500"}>
                                {prediction.success ? "Success" : "Failed"}
                              </Badge>
                            </div>
                            <div className="text-xs text-gray-600 mb-1">
                              <strong>Latency:</strong> {formatDuration(prediction.latency)}
                            </div>
                            <div className="text-xs bg-gray-100 p-2 rounded mb-1 max-h-20 overflow-auto">
                              <strong>Input:</strong>{" "}
                              {prediction.input.length > 100
                                ? `${prediction.input.substring(0, 100)}...`
                                : prediction.input}
                            </div>
                            <div className="text-xs bg-gray-100 p-2 rounded max-h-20 overflow-auto">
                              <strong>Output:</strong>{" "}
                              {prediction.output.length > 100
                                ? `${prediction.output.substring(0, 100)}...`
                                : prediction.output}
                            </div>
                            {prediction.error && (
                              <div className="text-xs bg-red-50 text-red-800 p-2 rounded mt-1 max-h-20 overflow-auto">
                                <strong>Error:</strong> {prediction.error}
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  )
}
