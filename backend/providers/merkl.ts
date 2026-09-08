import { createHash } from "node:crypto"
import type { AppConfig } from "@/backend/core/config"
import { fetchJson } from "@/backend/core/http"
import type { Claimable } from "@/backend/core/types"

type MerklToken = { address?: string; symbol?: string; decimals?: number; price?: number }
type MerklReward = {
  amount?: string
  claimed?: string
  pending?: string
  proofs?: string[]
  token?: MerklToken
  breakdowns?: Array<{ campaignId?: string; reason?: string }>
}
type MerklChainRewards = {
  chain?: { id?: number; name?: string }
  rewards?: MerklReward[]
}

const DISTRIBUTORS: Record<number, `0x${string}`> = {
  1: "0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae",
  10: "0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae",
  8453: "0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae",
  42161: "0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae",
}

function safeBigInt(value?: string) {
  try { return BigInt(value ?? "0") } catch { return 0n }
}

export class MerklProvider {
  constructor(private readonly config: AppConfig) {}

  async getClaims(wallet: `0x${string}`, chainIds = [1, 10, 8453, 42161]): Promise<Claimable[]> {
    const params = new URLSearchParams({ chainId: chainIds.join(",") })
    const headers = this.config.merklApiKey ? { "x-api-key": this.config.merklApiKey } : undefined
    const response = await fetchJson<MerklChainRewards[]>(
      "Merkl",
      `https://api.merkl.xyz/v4/users/${wallet}/rewards?${params}`,
      { headers },
    )

    return response.flatMap((chain) => (chain.rewards ?? []).map((reward) => {
      const chainId = chain.chain?.id ?? 1
      const amount = safeBigInt(reward.amount)
      const claimed = safeBigInt(reward.claimed)
      const claimable = amount > claimed ? amount - claimed : 0n
      const decimals = reward.token?.decimals ?? 18
      const numericAmount = Number(claimable) / 10 ** decimals
      const status = claimable > 0n && reward.proofs?.length ? "confirmed" : claimable > 0n ? "potential" : "claimed"
      const tokenAddress = (reward.token?.address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`
      const id = createHash("sha256").update(`${wallet}:${chainId}:${tokenAddress}`).digest("hex").slice(0, 20)

      return {
        id,
        wallet,
        protocol: "Merkl",
        chainId,
        token: { address: tokenAddress, symbol: reward.token?.symbol ?? "UNKNOWN", decimals },
        amount: amount.toString(),
        claimed: claimed.toString(),
        claimableAmount: claimable.toString(),
        pendingAmount: safeBigInt(reward.pending).toString(),
        usdValue: typeof reward.token?.price === "number" ? numericAmount * reward.token.price : null,
        source: "merkl" as const,
        status,
        evidence: [
          "Returned by Merkl's user rewards API",
          ...(reward.proofs?.length ? ["Cryptographic claim proof is available"] : []),
          ...((reward.breakdowns ?? []).slice(0, 2).map((item) => item.reason ?? `Campaign ${item.campaignId ?? "unknown"}`)),
        ],
        proof: reward.proofs as `0x${string}`[] | undefined,
        distributor: DISTRIBUTORS[chainId],
      }
    }))
  }
}

