import { NextResponse } from "next/server"
import { z } from "zod"
import { apiError } from "@/backend/core/api"
import { claimosService } from "@/backend/core/claimos-service"

const requestSchema = z.object({ mode: z.enum(["demo", "live"]).default("live") })

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, input] = await Promise.all([context.params, request.json().then((body) => requestSchema.parse(body))])
    return NextResponse.json(await claimosService.verify(id, input.mode))
  } catch (error) {
    return apiError(error)
  }
}

