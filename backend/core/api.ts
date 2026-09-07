import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { ProviderError } from "@/backend/core/http"

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Invalid request", details: error.flatten() }, { status: 400 })
  }
  if (error instanceof ProviderError) {
    return NextResponse.json({ error: error.message, provider: error.provider }, { status: 502 })
  }
  const message = error instanceof Error ? error.message : "Unexpected error"
  const status = /not found/i.test(message) ? 404 : 400
  return NextResponse.json({ error: message }, { status })
}

