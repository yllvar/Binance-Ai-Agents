import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Logger for debugging
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[MIDDLEWARE] ${message}`, data ? JSON.stringify(data) : "")
  },
  error: (message: string, error: any) => {
    console.error(`[MIDDLEWARE] ${message}`, error)
  },
}

export function middleware(request: NextRequest) {
  // Check for required environment variables
  const missingEnvVars = []

  if (!process.env.HUGGING_FACE_API_TOKEN) {
    missingEnvVars.push("HUGGING_FACE_API_TOKEN")
  }

  // Log request information for debugging
  logger.info(`Request: ${request.method} ${request.nextUrl.pathname}${request.nextUrl.search}`)

  // If API routes are being accessed but environment variables are missing
  if (request.nextUrl.pathname.startsWith("/api/") && missingEnvVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingEnvVars.join(", ")}`)

    // Only return an error for API routes
    return NextResponse.json(
      {
        error: `Missing required environment variables: ${missingEnvVars.join(", ")}`,
        message: "Server configuration error. Please set the required environment variables.",
      },
      { status: 500 },
    )
  }

  return NextResponse.next()
}

// Only run middleware on API routes
export const config = {
  matcher: "/api/:path*",
}
