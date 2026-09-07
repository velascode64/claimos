import { z } from "zod"

export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Expected an EVM address")

export const flowStageSchema = z.enum([
  "discover",
  "confirm",
  "verify",
  "approve",
  "claim",
])

export type FlowStage = z.infer<typeof flowStageSchema>

export type WalletActivity = {
  provider: "the-graph"
  networks: string[]
  transferCount: number
  protocols: string[]
}

export type ClaimTransaction = {
  chainId: number
  from: `0x${string}`
  to: `0x${string}`
  data: `0x${string}`
  value: `0x${string}`
}

export type Claimable = {
  id: string
  wallet: `0x${string}`
  protocol: string
  chainId: number
  token: {
    address: `0x${string}`
    symbol: string
    decimals: number
  }
  amount: string
  claimed: string
  claimableAmount: string
  pendingAmount: string
  usdValue: number | null
  source: "merkl" | "demo"
  status: "confirmed" | "potential" | "claimed"
  evidence: string[]
  proof?: `0x${string}`[]
  distributor?: `0x${string}`
  transaction?: ClaimTransaction
}

export type ScanResult = {
  scanId: string
  wallet: `0x${string}`
  createdAt: string
  activity: WalletActivity
  claims: Claimable[]
  confirmedUsdValue: number
}

export type Campaign = { id: string; protocol: string; chainId: number; source: string; sourceUrl?: string; startsAt?: string; endsAt?: string; status: "active" | "upcoming" | "ended" }
export type CampaignRequirement = { type: string; protocol: string; chainId: number; asset?: string; minimumAmount?: string; campaignId: string }

export type SecurityCheck = {
  claimId: string
  provider: "alchemy" | "demo"
  safeToPresentForApproval: boolean
  risk: "low" | "medium" | "high" | "unknown"
  checks: Array<{ label: string; passed: boolean; detail?: string }>
  assetChanges: unknown[]
  gasEstimate?: string
  warnings: string[]
}

export type FlowEvent = {
  stage: FlowStage
  status: "started" | "completed" | "waiting" | "skipped" | "failed"
  message: string
  data?: unknown
}
