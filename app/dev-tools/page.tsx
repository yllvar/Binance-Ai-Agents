"use client"

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ModelPerformanceDashboard } from "@/components/model-performance-dashboard"
import { ModelTestPanel } from "@/components/model-test-panel"
import { DebugPanel } from "@/components/debug-panel"

export default function DevToolsPage() {
  const [symbol] = useState("BTCUSDT")

  return (
    <main className="flex min-h-screen flex-col p-6 bg-gray-50">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">AI Trading Agent Dev Tools</h1>
        <p className="text-gray-500">Monitor and test Hugging Face models</p>
      </div>

      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="performance">Model Performance</TabsTrigger>
          <TabsTrigger value="test">Test Models</TabsTrigger>
          <TabsTrigger value="debug">Debug</TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <ModelPerformanceDashboard />
        </TabsContent>

        <TabsContent value="test">
          <ModelTestPanel />
        </TabsContent>

        <TabsContent value="debug">
          <DebugPanel symbol={symbol} />
        </TabsContent>
      </Tabs>
    </main>
  )
}
