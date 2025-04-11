import { type NextRequest, NextResponse } from "next/server"
import { queryBART } from "@/lib/huggingface"

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }

    const result = await queryBART(text)

    return NextResponse.json({
      result,
      raw: result,
    })
  } catch (error) {
    console.error("Error testing BART:", error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
