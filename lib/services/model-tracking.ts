import type {
  ModelType,
  ModelPrediction,
  ModelOutcome,
  ModelPerformanceMetrics,
  ConnectionStatus,
  ModelPerformanceData,
} from "../types/model-tracking"

// In a real app, this would use a database
// For this demo, we'll use localStorage in the browser
// and a simple in-memory store on the server
let serverStore: ModelPerformanceData = {
  predictions: [],
  outcomes: [],
  metrics: [],
  connectionStatus: [],
}

// Initialize connection status for all models
const initializeConnectionStatus = (): ConnectionStatus[] => {
  const models: ModelType[] = ["tapas", "distilbert", "flant5", "bart"]
  return models.map((model) => ({
    modelType: model,
    status: "unknown",
    lastChecked: 0,
    responseTime: 0,
  }))
}

// Initialize metrics for all models
const initializeMetrics = (): ModelPerformanceMetrics[] => {
  const models: ModelType[] = ["tapas", "distilbert", "flant5", "bart"]
  return models.map((model) => ({
    modelType: model,
    totalPredictions: 0,
    successRate: 0,
    averageLatency: 0,
    lastUsed: 0,
    errorRate: 0,
  }))
}

// Initialize the store if it's empty
const initializeStore = () => {
  if (serverStore.connectionStatus.length === 0) {
    serverStore.connectionStatus = initializeConnectionStatus()
  }

  if (serverStore.metrics.length === 0) {
    serverStore.metrics = initializeMetrics()
  }
}

// Record a model prediction
export const recordPrediction = (prediction: Omit<ModelPrediction, "id">): string => {
  initializeStore()

  const id = `pred_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const newPrediction: ModelPrediction = {
    ...prediction,
    id,
  }

  serverStore.predictions.push(newPrediction)

  // Update metrics
  const metricIndex = serverStore.metrics.findIndex((m) => m.modelType === prediction.modelType)
  if (metricIndex >= 0) {
    const metric = serverStore.metrics[metricIndex]
    const totalPredictions = metric.totalPredictions + 1
    const successCount = metric.successRate * metric.totalPredictions + (prediction.success ? 1 : 0)
    const totalLatency = metric.averageLatency * metric.totalPredictions + prediction.latency

    serverStore.metrics[metricIndex] = {
      ...metric,
      totalPredictions,
      successRate: successCount / totalPredictions,
      averageLatency: totalLatency / totalPredictions,
      lastUsed: prediction.timestamp,
      errorRate: (totalPredictions - successCount) / totalPredictions,
    }
  }

  // Limit the size of the predictions array to prevent memory issues
  if (serverStore.predictions.length > 1000) {
    serverStore.predictions = serverStore.predictions.slice(-1000)
  }

  return id
}

// Record a model outcome
export const recordOutcome = (outcome: ModelOutcome): void => {
  initializeStore()

  serverStore.outcomes.push(outcome)

  // Update accuracy metrics
  const prediction = serverStore.predictions.find((p) => p.id === outcome.predictionId)
  if (prediction) {
    const metricIndex = serverStore.metrics.findIndex((m) => m.modelType === prediction.modelType)
    if (metricIndex >= 0) {
      const metric = serverStore.metrics[metricIndex]
      const outcomes = serverStore.outcomes.filter((o) =>
        serverStore.predictions.some((p) => p.id === o.predictionId && p.modelType === prediction.modelType),
      )

      const correctOutcomes = outcomes.filter((o) => o.correct).length

      serverStore.metrics[metricIndex] = {
        ...metric,
        accuracy: outcomes.length > 0 ? correctOutcomes / outcomes.length : undefined,
      }
    }
  }

  // Limit the size of the outcomes array
  if (serverStore.outcomes.length > 1000) {
    serverStore.outcomes = serverStore.outcomes.slice(-1000)
  }
}

// Update connection status
export const updateConnectionStatus = (status: Omit<ConnectionStatus, "lastChecked">): void => {
  initializeStore()

  const index = serverStore.connectionStatus.findIndex((s) => s.modelType === status.modelType)
  if (index >= 0) {
    serverStore.connectionStatus[index] = {
      ...status,
      lastChecked: Date.now(),
    }
  }
}

// Get all model performance data
export const getModelPerformanceData = (): ModelPerformanceData => {
  initializeStore()
  return { ...serverStore }
}

// Get metrics for a specific model
export const getModelMetrics = (modelType: ModelType): ModelPerformanceMetrics | undefined => {
  initializeStore()
  return serverStore.metrics.find((m) => m.modelType === modelType)
}

// Get connection status for a specific model
export const getConnectionStatus = (modelType: ModelType): ConnectionStatus | undefined => {
  initializeStore()
  return serverStore.connectionStatus.find((s) => s.modelType === modelType)
}

// Get recent predictions for a model
export const getRecentPredictions = (modelType: ModelType, limit = 10): ModelPrediction[] => {
  initializeStore()
  return serverStore.predictions
    .filter((p) => p.modelType === modelType)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
}

// Clear all data (for testing)
export const clearAllData = (): void => {
  serverStore = {
    predictions: [],
    outcomes: [],
    metrics: initializeMetrics(),
    connectionStatus: initializeConnectionStatus(),
  }
}
