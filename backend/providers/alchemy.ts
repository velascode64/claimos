import type { AppConfig } from "@/backend/core/config"
import { requireConfig } from "@/backend/core/config"
import { fetchJson } from "@/backend/core/http"
import type { Claimable, SecurityCheck } from "@/backend/core/types"

const NETWORK_SLUGS: Record<number, string> = {
  1: "eth-mainnet",
  10: "opt-mainnet",
  8453: "base-mainnet",
  42161: "arb-mainnet",
}

type SimulationResponse = {
  result?: { changes?: unknown[]; gasUsed?: string; error?: { message?: string } }
  error?: { message?: string }
}

export class AlchemyProvider {
  constructor(private readonly config: AppConfig) {}

  async verify(claim: Claimable): Promise<SecurityCheck> {
    if (!claim.transaction) throw new Error("Prepare the claim before simulation")
    const apiKey = requireConfig(this.config.alchemyApiKey, "ALCHEMY_API_KEY")
    const network = NETWORK_SLUGS[claim.chainId]
    if (!network) throw new Error(`Alchemy simulation is not configured for chain ${claim.chainId}`)

    const response = await fetchJson<SimulationResponse>(
      "Alchemy",
      `https://${network}.g.alchemy.com/v2/${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "alchemy_simulateAssetChanges",
          params: [{
            from: claim.transaction.from,
            to: claim.transaction.to,
            data: claim.transaction.data,
            value: claim.transaction.value,
          }],
        }),
      },
    )

    const simulationError = response.error?.message ?? response.result?.error?.message
    const recipientMatches = claim.transaction.from.toLowerCase() === claim.wallet.toLowerCase()
    const contractMatches = claim.transaction.to.toLowerCase() === claim.distributor?.toLowerCase()
    const warnings = simulationError ? [simulationError] : []

    return {
      claimId: claim.id,
      provider: "alchemy",
      safeToPresentForApproval: !simulationError && recipientMatches && contractMatches,
      risk: simulationError || !recipientMatches || !contractMatches ? "high" : "low",
      checks: [
        { label: "Official claim contract", passed: contractMatches },
        { label: "Claim recipient is the scanned wallet", passed: recipientMatches },
        { label: "Simulation completed without a revert", passed: !simulationError, detail: simulationError },
        { label: "No native value is sent", passed: claim.transaction.value === "0x0" },
      ],
      assetChanges: response.result?.changes ?? [],
      gasEstimate: response.result?.gasUsed,
      warnings,
    }
  }
}

