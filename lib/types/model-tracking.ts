// Types for model performance tracking

export type ModelType = "tapas" | "distilbert" | "flant5" | "bart"
// Note: "flant5" is now used for DeepSeek v3 model

export interface ModelPrediction {
  id: string
  timestamp: number
  modelType: ModelType
  input: string
  output: string
  latency: number
  success: boolean
  error?: string
}

export interface ModelOutcome {
  predictionId: string
  timestamp: number
  correct: boolean
  actualOutcome: string
  notes?: string
}

export interface ModelPerformanceMetrics {
  modelType: ModelType
  totalPredictions: number
  successRate: number
  averageLatency: number
  accuracy?: number
  lastUsed: number
  errorRate: number
}

export interface ConnectionStatus {
  modelType: ModelType
  status: "connected" | "disconnected" | "degraded" | "unknown"
  lastChecked: number
  responseTime: number
  errorMessage?: string
}

export interface ModelPerformanceData {
  predictions: ModelPrediction[]
  outcomes: ModelOutcome[]
  metrics: ModelPerformanceMetrics[]
  connectionStatus: ConnectionStatus[]
}
