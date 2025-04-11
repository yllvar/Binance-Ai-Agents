"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import type { ModelType } from "@/lib/types/model-tracking"

export function ModelTestPanel() {
  const [activeTab, setActiveTab] = useState<ModelType>("tapas")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  // Inputs for different models
  const [distilbertInput, setDistilbertInput] = useState(
    "The market is showing bullish signals with increasing volume.",
  )
  const [flant5Input, setFlant5Input] = useState("Given RSI=65, MACD=0.5, should I buy, sell, or hold?")
  const [bartInput, setBartInput] = useState(
    "The trading strategy showed a win rate of 65% with a profit factor of 1.8. The maximum drawdown was 12% and the Sharpe ratio was 1.2. The strategy performed well in trending markets but struggled during sideways price action.",
  )

  // Tapas inputs
  const [tapasQuery, setTapasQuery] = useState("What is the highest price?")
  const [tapasTable, setTapasTable] = useState<Record<string, string[]>>({
    Date: ["2023-01-01", "2023-01-02", "2023-01-03"],
    Price: ["20000", "21000", "19500"],
    Volume: ["1000", "1200", "800"],
  })

  const testModel = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      let endpoint = ""
      let payload = {}

      switch (activeTab) {
        case "distilbert":
          endpoint = "/api/test/distilbert"
          payload = { text: distilbertInput }
          break
        case "flant5":
          endpoint = "/api/test/flant5"
          payload = { prompt: flant5Input }
          break
        case "bart":
          endpoint = "/api/test/bart"
          payload = { text: bartInput }
          break
        case "tapas":
          endpoint = "/api/test/tapas"
          payload = { query: tapasQuery, table: tapasTable }
          break
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`)
      }

      const data = await response.json()
      setResult(data.result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  const addTableColumn = () => {
    setTapasTable((prev) => {
      const newTable = { ...prev }
      newTable[`Column ${Object.keys(prev).length + 1}`] = ["", "", ""]
      return newTable
    })
  }

  const updateTableHeader = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return

    setTapasTable((prev) => {
      const newTable = { ...prev }
      newTable[newKey] = newTable[oldKey]
      delete newTable[oldKey]
      return newTable
    })
  }

  const updateTableCell = (column: string, rowIndex: number, value: string) => {
    setTapasTable((prev) => {
      const newTable = { ...prev }
      newTable[column][rowIndex] = value
      return newTable
    })
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Model Testing</CardTitle>
        <CardDescription>Test Hugging Face models with custom inputs</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="tapas" value={activeTab} onValueChange={(value) => setActiveTab(value as ModelType)}>
          <TabsList className="mb-4">
            <TabsTrigger value="tapas">Tapas</TabsTrigger>
            <TabsTrigger value="distilbert">DistilBERT</TabsTrigger>
            <TabsTrigger value="flant5">DeepSeek v3</TabsTrigger>
            <TabsTrigger value="bart">BART</TabsTrigger>
          </TabsList>

          <TabsContent value="tapas">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Query</label>
                <Input
                  value={tapasQuery}
                  onChange={(e) => setTapasQuery(e.target.value)}
                  placeholder="Enter a question about the table"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium">Table</label>
                  <Button variant="outline" size="sm" onClick={addTableColumn}>
                    Add Column
                  </Button>
                </div>

                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        {Object.keys(tapasTable).map((column, i) => (
                          <th key={i} className="border-b p-2">
                            <Input
                              value={column}
                              onChange={(e) => updateTableHeader(column, e.target.value)}
                              className="text-center font-medium"
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 1, 2].map((rowIndex) => (
                        <tr key={rowIndex}>
                          {Object.entries(tapasTable).map(([column, values], i) => (
                            <td key={i} className="border-b p-2">
                              <Input
                                value={values[rowIndex] || ""}
                                onChange={(e) => updateTableCell(column, rowIndex, e.target.value)}
                                className="text-center"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="distilbert">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Text for Sentiment Analysis</label>
                <Textarea
                  value={distilbertInput}
                  onChange={(e) => setDistilbertInput(e.target.value)}
                  placeholder="Enter text for sentiment analysis"
                  rows={4}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="flant5">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Prompt for DeepSeek v3 Decision Model</label>
                <Textarea
                  value={flant5Input}
                  onChange={(e) => setFlant5Input(e.target.value)}
                  placeholder="Enter a prompt for DeepSeek v3"
                  rows={4}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bart">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Text for Summarization</label>
                <Textarea
                  value={bartInput}
                  onChange={(e) => setBartInput(e.target.value)}
                  placeholder="Enter text to summarize"
                  rows={6}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 space-y-4">
          <Button onClick={testModel} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              "Test Model"
            )}
          </Button>

          {error && <div className="p-3 bg-red-50 text-red-800 rounded-md">{error}</div>}

          {result && (
            <div className="p-4 border rounded-md">
              <h3 className="font-medium mb-2">Result:</h3>
              <div className="bg-gray-100 p-3 rounded-md whitespace-pre-wrap">{result}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
