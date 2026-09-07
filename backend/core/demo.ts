import type { Claimable, ScanResult, SecurityCheck } from "@/backend/core/types"

export const DEMO_WALLET = "0x4F2BF7469Bc38d1aE779b1F4affC588f35E60973" as const

export function demoScan(wallet: `0x${string}`): ScanResult {
  const claim: Claimable = {
    id: "demo-merkl-usdc",
    wallet,
    protocol: "Merkl",
    chainId: 1,
    token: {
      address: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      symbol: "USDC",
      decimals: 6,
    },
    amount: "83200000",
    claimed: "0",
    claimableAmount: "83200000",
    pendingAmount: "1250000",
    usdValue: 83.2,
    source: "demo",
    status: "confirmed",
    evidence: [
      "Wallet has qualifying onchain activity",
      "Wallet appears in the Merkl distribution",
      "Cryptographic claim proof is available",
    ],
    proof: [`0x${"11".repeat(32)}`],
    distributor: "0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae",
  }

  return {
    scanId: "demo-scan",
    wallet,
    createdAt: new Date().toISOString(),
    activity: {
      provider: "the-graph",
      networks: ["mainnet", "base", "arbitrum-one", "optimism"],
      transferCount: 25,
      protocols: ["USDC", "WETH", "GRT"],
    },
    claims: [claim],
    confirmedUsdValue: 83.2,
  }
}

export function demoSecurityCheck(claim: Claimable): SecurityCheck {
  return {
    claimId: claim.id,
    provider: "demo",
    safeToPresentForApproval: true,
    risk: "low",
    checks: [
      { label: "Official claim contract", passed: true },
      { label: "Claim recipient is the scanned wallet", passed: true },
      { label: "Simulation completed without a revert", passed: true },
      { label: "No native value is sent", passed: true },
    ],
    assetChanges: [{ direction: "receive", symbol: "USDC", amount: "83.2", recipient: claim.wallet }],
    gasEstimate: "126000",
    warnings: [],
  }
}

