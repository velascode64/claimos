import { NextResponse } from "next/server"
import { z } from "zod"
import { apiError } from "@/backend/core/api"
import { claimosService } from "@/backend/core/claimos-service"
import { addressSchema } from "@/backend/core/types"

const requestSchema = z.object({
  wallet: addressSchema,
  mode: z.enum(["demo", "live"]).default("live"),
})

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json())
    const scan = await claimosService.scan(input.wallet as `0x${string}`, input.mode)
    return NextResponse.json(scan, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}

