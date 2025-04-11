"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface DebugPanelProps {
  symbol: string
}

export function DebugPanel({ symbol }: DebugPanelProps) {
  const [logs, setLogs] = useState<DebugLog[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [serviceStatus, setServiceStatus] = useState<"unknown" | "available" | "unavailable">("unknown")

  interface DebugLog {
    id: string
    timestamp: number
    type: "info" | "error" | "warning"
    message: string
    data?: any
  }

  const addLog = (type: "info" | "error" | "warning", message: string, data?: any) => {
    const newLog: DebugLog = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      type,
      message,
      data,
    }

    setLogs((prevLogs) => [newLog, ...prevLogs])
  }

  const testHuggingFaceConnection = async () => {
    try {
      setLoading(true)
      addLog("info", "Testing Hugging Face connection...")

      const response = await fetch(`/api/debug/test-huggingface?symbol=${symbol}`)
      const data = await response.json()

      if (response.ok) {
        // Check if any models are working
        if (data.success) {
          addLog("info", "Hugging Face connection partially successful", data)
          setServiceStatus("available")
        } else {
          addLog("warning", "Hugging Face service appears to be unavailable", data)
          setServiceStatus("unavailable")
        }

        // Log individual model results
        if (data.results) {
          if (data.results.distilbert) {
            addLog("info", "DistilBERT test successful", data.results.distilbert)
          } else {
            addLog("warning", "DistilBERT test failed")
          }

          if (data.results.flant5) {
            addLog("info", "FLAN-T5 test successful", data.results.flant5)
          } else {
            addLog("warning", "FLAN-T5 test failed")
          }

          if (data.results.bart) {
            addLog("info", "BART test successful", data.results.bart)
          } else {
            addLog("warning", "BART test failed")
          }

          if (data.results.tapas) {
            addLog("info", "Tapas test successful", data.results.tapas)
          } else {
            addLog("warning", "Tapas test failed")
          }
        }

        // Log any errors
        if (data.results?.errors && data.results.errors.length > 0) {
          data.results.errors.forEach((error: string) => {
            addLog("error", error)
          })
        }
      } else {
        addLog("error", "Hugging Face connection test failed", data)
        setServiceStatus("unavailable")
      }
    } catch (error) {
      addLog("error", "Error testing Hugging Face connection", error)
      setServiceStatus("unavailable")
    } finally {
      setLoading(false)
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  return (
    <Card className={expanded ? "h-[500px]" : "h-auto"}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm font-medium">Debug Panel</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Collapse" : "Expand"}
            </Button>
            <Button variant="outline" size="sm" onClick={clearLogs}>
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className={expanded ? "h-[calc(500px-60px)] overflow-auto" : "max-h-[200px] overflow-auto"}>
        {serviceStatus === "unavailable" && (
          <Alert variant="warning" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Hugging Face service appears to be unavailable. The application will use fallback mechanisms for AI
              features.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2 mb-4">
          <Button size="sm" onClick={testHuggingFaceConnection} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Testing...
              </>
            ) : (
              "Test Hugging Face Connection"
            )}
          </Button>
        </div>

        {logs.length === 0 ? (
          <div className="text-center text-gray-500 py-4">No logs yet</div>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {logs.map((log) => (
              <AccordionItem key={log.id} value={log.id} className="border p-2 rounded-md">
                <AccordionTrigger className="py-1 hover:no-underline">
                  <div className="flex items-center gap-2 text-left">
                    <Badge
                      className={
                        log.type === "error" ? "bg-red-500" : log.type === "warning" ? "bg-yellow-500" : "bg-blue-500"
                      }
                    >
                      {log.type.toUpperCase()}
                    </Badge>
                    <span className="text-sm truncate max-w-[300px]">{log.message}</span>
                    <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {log.data ? (
                    <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-[200px]">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  ) : (
                    <div className="text-sm text-gray-500 italic">No additional data</div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  )
}
