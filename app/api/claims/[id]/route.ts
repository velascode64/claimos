import { NextResponse } from "next/server"
import { apiError } from "@/backend/core/api"
import { claimosService } from "@/backend/core/claimos-service"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const claim = claimosService.getClaim(id)
    if (!claim) throw new Error(`Claim ${id} was not found`)
    return NextResponse.json(claim)
  } catch (error) {
    return apiError(error)
  }
}

