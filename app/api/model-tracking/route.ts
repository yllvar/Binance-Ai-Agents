import { type NextRequest, NextResponse } from "next/server"
import {
  getModelPerformanceData,
  getModelMetrics,
  getConnectionStatus,
  getRecentPredictions,
  clearAllData,
} from "@/lib/services/model-tracking"
import type { ModelType } from "@/lib/types/model-tracking"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const modelType = searchParams.get("model") as ModelType | null
    const action = searchParams.get("action")

    // Handle clear action
    if (action === "clear") {
      clearAllData()
      return NextResponse.json({ success: true, message: "All tracking data cleared" })
    }

    // If model type is specified, return data for that model
    if (modelType) {
      const metrics = getModelMetrics(modelType)
      const status = getConnectionStatus(modelType)
      const recentPredictions = getRecentPredictions(modelType, 10)

      return NextResponse.json({
        metrics,
        status,
        recentPredictions,
      })
    }

    // Otherwise return all data
    const data = getModelPerformanceData()

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching model tracking data:", error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
