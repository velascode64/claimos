import { NextResponse } from "next/server"
import { apiError } from "@/backend/core/api"
import { claimosService } from "@/backend/core/claimos-service"

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    return NextResponse.json(claimosService.requestApproval(id), { status: 202 })
  } catch (error) {
    return apiError(error)
  }
}

