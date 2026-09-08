import { NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({ service: "claimos-api", status: "ok", timestamp: new Date().toISOString() })
}

