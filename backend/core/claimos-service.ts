import { createHash } from "node:crypto"
import { encodeFunctionData } from "viem"
import { prepareMerklClaim } from "@/backend/adapters/merkl-claim"
import { getConfig } from "@/backend/core/config"
import { demoScan, demoSecurityCheck } from "@/backend/core/demo"
import type { Claimable, ScanResult, SecurityCheck } from "@/backend/core/types"
import { AlchemyProvider } from "@/backend/providers/alchemy"
import { MerklProvider } from "@/backend/providers/merkl"
import { TheGraphProvider } from "@/backend/providers/the-graph"
import { claimStore } from "@/backend/store/claim-store"

export type RunMode = "demo" | "live"

export class ClaimosService {
  private readonly config = getConfig()
  private readonly graph = new TheGraphProvider(this.config)
  private readonly merkl = new MerklProvider(this.config)
  private readonly alchemy = new AlchemyProvider(this.config)

  async scan(wallet: `0x${string}`, mode: RunMode = "live"): Promise<ScanResult> {
    if (mode === "demo") return claimStore.saveScan(demoScan(wallet))

    const [activity, claims] = await Promise.all([
      this.graph.getWalletActivity(wallet),
      this.merkl.getClaims(wallet),
    ])
    const confirmedUsdValue = claims
      .filter((claim) => claim.status === "confirmed")
      .reduce((total, claim) => total + (claim.usdValue ?? 0), 0)
    const scanId = createHash("sha256").update(`${wallet}:${Date.now()}`).digest("hex").slice(0, 20)

    return claimStore.saveScan({ scanId, wallet, createdAt: new Date().toISOString(), activity, claims, confirmedUsdValue })
  }

  prepare(claimId: string, mode: RunMode = "live"): Claimable {
    const claim = this.requireClaim(claimId)
    const transaction = mode === "demo" ? prepareDemoClaim(claim) : prepareMerklClaim(claim)
    return claimStore.saveClaim({ ...claim, transaction })
  }

  async verify(claimId: string, mode: RunMode = "live"): Promise<SecurityCheck> {
    const claim = this.requireClaim(claimId)
    const check = mode === "demo" ? demoSecurityCheck(claim) : await this.alchemy.verify(claim)
    return claimStore.saveCheck(check)
  }

  getClaim(claimId: string) {
    return claimStore.getClaim(claimId)
  }

  requestApproval(claimId: string) {
    const claim = this.requireClaim(claimId)
    const check = claimStore.getCheck(claimId)
    if (!claim.transaction) throw new Error("Prepare the claim before requesting approval")
    if (!check?.safeToPresentForApproval) throw new Error("A successful security check is required before approval")

    return {
      claimId,
      status: "awaiting_human_approval" as const,
      signer: "privy-connected-wallet" as const,
      hardwareApproval: "ledger-supported" as const,
      transaction: claim.transaction,
      message: "Machine prepared and verified the transaction. The wallet owner must review and approve it.",
    }
  }

  private requireClaim(claimId: string) {
    const claim = claimStore.getClaim(claimId)
    if (!claim) throw new Error(`Claim ${claimId} was not found; scan the wallet first`)
    return claim
  }
}

const demoAbi = [{
  type: "function",
  name: "claim",
  stateMutability: "nonpayable",
  inputs: [{ name: "account", type: "address" }],
  outputs: [],
}] as const

function prepareDemoClaim(claim: Claimable) {
  if (!claim.distributor) throw new Error("Demo distributor is missing")
  return {
    chainId: claim.chainId,
    from: claim.wallet,
    to: claim.distributor,
    value: "0x0" as const,
    data: encodeFunctionData({ abi: demoAbi, functionName: "claim", args: [claim.wallet] }),
  }
}

export const claimosService = new ClaimosService()
