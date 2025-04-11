"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { useMobile } from "@/hooks/use-mobile"

export function EnvSetup() {
  const [hfApiKey, setHfApiKey] = useState("")
  const [status, setStatus] = useState<"idle" | "testing" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const isMobile = useMobile()

  const testConnection = async () => {
    if (!hfApiKey) {
      setStatus("error")
      setErrorMessage("Please enter a Hugging Face API key")
      return
    }

    try {
      setStatus("testing")
      setErrorMessage("")

      // Store the API key temporarily in localStorage for testing
      localStorage.setItem("temp_hf_api_key", hfApiKey)

      const response = await fetch("/api/debug/test-huggingface")
      const data = await response.json()

      // Remove the temporary API key
      localStorage.removeItem("temp_hf_api_key")

      if (data.success) {
        setStatus("success")
      } else {
        setStatus("error")
        setErrorMessage(data.error || "Connection test failed")
      }
    } catch (error) {
      setStatus("error")
      setErrorMessage(error instanceof Error ? error.message : "An unknown error occurred")
      localStorage.removeItem("temp_hf_api_key")
    }
  }

  return (
    <Card>
      <CardHeader className={isMobile ? "px-3 py-2" : undefined}>
        <CardTitle className="text-base md:text-lg">Environment Setup</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Configure your Hugging Face API key to enable AI trading features
        </CardDescription>
      </CardHeader>
      <CardContent className={isMobile ? "px-3 py-2" : undefined}>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="hf-api-key" className="text-xs md:text-sm font-medium">
              Hugging Face API Key
            </label>
            <Input
              id="hf-api-key"
              type="password"
              placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxx"
              value={hfApiKey}
              onChange={(e) => setHfApiKey(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Get your API key from the{" "}
              <a
                href="https://huggingface.co/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                Hugging Face settings page
              </a>
            </p>
          </div>

          <Button
            onClick={testConnection}
            disabled={status === "testing"}
            className="w-full"
            size={isMobile ? "sm" : "default"}
          >
            {status === "testing" ? "Testing Connection..." : "Test Connection"}
          </Button>

          {status === "success" && (
            <Alert className="bg-green-50 border-green-200 text-xs md:text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-700">Success!</AlertTitle>
              <AlertDescription className="text-green-600">
                Connection to Hugging Face API successful. You can now use the AI trading features.
              </AlertDescription>
            </Alert>
          )}

          {status === "error" && (
            <Alert variant="destructive" className="text-xs md:text-sm">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
