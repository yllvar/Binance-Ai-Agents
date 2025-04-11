import { type NextRequest, NextResponse } from "next/server"
import { queryFLANT5 } from "@/lib/huggingface"

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    const result = await queryFLANT5(prompt)

    return NextResponse.json({
      result,
      raw: result,
    })
  } catch (error) {
    console.error("Error testing FLAN-T5:", error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
