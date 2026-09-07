import { addressSchema, type FlowEvent } from "@/backend/core/types"
import { claimosService, type RunMode } from "@/backend/core/claimos-service"
import { DEMO_WALLET } from "@/backend/core/demo"

function argument(name: string) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const mode: RunMode = process.argv.includes("--live") ? "live" : "demo"
const wallet = addressSchema.parse(argument("--wallet") ?? DEMO_WALLET) as `0x${string}`
const json = process.argv.includes("--json")

function emit(event: FlowEvent) {
  if (json) return console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...event }))
  const icon = event.status === "completed" ? "✓" : event.status === "waiting" ? "◆" : event.status === "failed" ? "✗" : "→"
  console.log(`\n${icon} [${event.stage.toUpperCase()}] ${event.message}`)
  if (event.data !== undefined) console.dir(event.data, { depth: 6, colors: true })
}

async function main() {
  emit({ stage: "discover", status: "started", message: `${mode === "live" ? "Calling" : "Replaying"} The Graph wallet activity and Merkl rewards`, data: { wallet, mode } })
  const scan = await claimosService.scan(wallet, mode)
  emit({ stage: "discover", status: "completed", message: `Found ${scan.activity.transferCount} recent transfers and ${scan.claims.length} reward entries`, data: scan.activity })

  const confirmed = scan.claims.filter((claim) => claim.status === "confirmed")
  emit({ stage: "confirm", status: "completed", message: `${confirmed.length} confirmed claim(s); only confirmed value is counted`, data: { confirmedUsdValue: scan.confirmedUsdValue, claims: scan.claims } })

  if (!confirmed.length) {
    emit({ stage: "verify", status: "skipped", message: "No confirmed claims are available to prepare or simulate" })
    return
  }

  const prepared = claimosService.prepare(confirmed[0].id, mode)
  emit({ stage: "verify", status: "started", message: "Prepared official claim transaction", data: prepared.transaction })
  const check = await claimosService.verify(prepared.id, mode)
  emit({ stage: "verify", status: "completed", message: `Security simulation completed with ${check.risk.toUpperCase()} risk`, data: check })

  if (!check.safeToPresentForApproval) {
    emit({ stage: "approve", status: "failed", message: "Transaction is blocked from approval because security checks failed" })
    process.exitCode = 2
    return
  }

  emit({
    stage: "approve",
    status: "waiting",
    message: "Human approval required in Privy/Ledger; the backend will not sign automatically",
    data: prepared.transaction,
  })
  claimosService.requestApproval(prepared.id)
  emit({ stage: "claim", status: "skipped", message: "Broadcast intentionally skipped until a connected wallet approves" })
}

main().catch((error) => {
  emit({ stage: "discover", status: "failed", message: error instanceof Error ? error.message : String(error) })
  process.exitCode = 1
})
