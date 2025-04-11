"use client"

import { useEffect, useState } from "react"
import { hasApiCredentials, getApiCredentials } from "@/lib/utils/storage"

export function TradingInitializer() {
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const initializeTrading = async () => {
      if (!hasApiCredentials()) return

      try {
        const { apiKey, apiSecret } = getApiCredentials()

        const response = await fetch("/api/trading/initialize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apiKey,
            apiSecret,
            testMode: true, // Default to test mode for safety
          }),
        })

        if (response.ok) {
          setInitialized(true)
          console.log("Trading service initialized automatically")
        }
      } catch (error) {
        console.error("Failed to initialize trading service:", error)
      }
    }

    initializeTrading()
  }, [])

  // This component doesn't render anything
  return null
}
