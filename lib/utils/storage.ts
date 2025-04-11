// Utility functions for browser storage

// Keys for storage
const STORAGE_KEYS = {
  BINANCE_API_KEY: "binance_api_key",
  BINANCE_API_SECRET: "binance_api_secret",
  TRADING_CONFIG: "trading_config",
}

// Simple encryption/decryption for sensitive data
// Note: This is not highly secure but provides basic obfuscation
function encrypt(text: string): string {
  // Basic encoding - not truly secure but better than plaintext
  return btoa(text)
}

function decrypt(text: string): string {
  try {
    return atob(text)
  } catch (e) {
    return ""
  }
}

// Save API credentials to localStorage
export function saveApiCredentials(apiKey: string, apiSecret: string): void {
  if (typeof window === "undefined") return

  localStorage.setItem(STORAGE_KEYS.BINANCE_API_KEY, encrypt(apiKey))
  localStorage.setItem(STORAGE_KEYS.BINANCE_API_SECRET, encrypt(apiSecret))
}

// Get API credentials from localStorage
export function getApiCredentials(): { apiKey: string; apiSecret: string } {
  if (typeof window === "undefined") {
    return { apiKey: "", apiSecret: "" }
  }

  const encryptedApiKey = localStorage.getItem(STORAGE_KEYS.BINANCE_API_KEY) || ""
  const encryptedApiSecret = localStorage.getItem(STORAGE_KEYS.BINANCE_API_SECRET) || ""

  return {
    apiKey: decrypt(encryptedApiKey),
    apiSecret: decrypt(encryptedApiSecret),
  }
}

// Clear API credentials from localStorage
export function clearApiCredentials(): void {
  if (typeof window === "undefined") return

  localStorage.removeItem(STORAGE_KEYS.BINANCE_API_KEY)
  localStorage.removeItem(STORAGE_KEYS.BINANCE_API_SECRET)
}

// Save trading config to localStorage
export function saveTradingConfig(config: any): void {
  if (typeof window === "undefined") return

  localStorage.setItem(STORAGE_KEYS.TRADING_CONFIG, JSON.stringify(config))
}

// Get trading config from localStorage
export function getTradingConfig(): any {
  if (typeof window === "undefined") {
    return null
  }

  const configStr = localStorage.getItem(STORAGE_KEYS.TRADING_CONFIG)
  if (!configStr) return null

  try {
    return JSON.parse(configStr)
  } catch (e) {
    return null
  }
}

// Check if API credentials are stored
export function hasApiCredentials(): boolean {
  if (typeof window === "undefined") return false

  const { apiKey, apiSecret } = getApiCredentials()
  return Boolean(apiKey && apiSecret)
}
