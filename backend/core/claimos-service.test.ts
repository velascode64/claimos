import { describe, expect, test } from "bun:test"
import { ClaimosService } from "@/backend/core/claimos-service"
import { DEMO_WALLET } from "@/backend/core/demo"

describe("Claimos console flow", () => {
  test("discovers, confirms, prepares and verifies a demo claim", async () => {
    const service = new ClaimosService()
    const scan = await service.scan(DEMO_WALLET, "demo")

    expect(scan.claims).toHaveLength(1)
    expect(scan.claims[0].status).toBe("confirmed")
    expect(scan.confirmedUsdValue).toBe(83.2)

    const prepared = service.prepare(scan.claims[0].id, "demo")
    expect(prepared.transaction?.from).toBe(DEMO_WALLET)
    expect(prepared.transaction?.value).toBe("0x0")

    const security = await service.verify(prepared.id, "demo")
    expect(security.safeToPresentForApproval).toBe(true)
    expect(security.risk).toBe("low")

    const approval = service.requestApproval(prepared.id)
    expect(approval.status).toBe("awaiting_human_approval")
  })
})
