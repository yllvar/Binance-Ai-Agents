import { type NextRequest, NextResponse } from "next/server"
import { queryDistilBERT } from "@/lib/huggingface"

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }

    const result = await queryDistilBERT(text)

    return NextResponse.json({
      result: `Sentiment score: ${result.toFixed(4)} (${result > 0.5 ? "Positive" : result < 0.5 ? "Negative" : "Neutral"})`,
      raw: result,
    })
  } catch (error) {
    console.error("Error testing DistilBERT:", error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
