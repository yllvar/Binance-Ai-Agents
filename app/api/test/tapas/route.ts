import { type NextRequest, NextResponse } from "next/server"
import { queryTapas } from "@/lib/huggingface"

export async function POST(request: NextRequest) {
  try {
    const { query, table } = await request.json()

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    if (!table || Object.keys(table).length === 0) {
      return NextResponse.json({ error: "Table is required" }, { status: 400 })
    }

    const result = await queryTapas(query, table)

    return NextResponse.json({
      result,
      raw: result,
    })
  } catch (error) {
    console.error("Error testing Tapas:", error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
