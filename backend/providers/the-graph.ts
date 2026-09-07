import type { AppConfig } from "@/backend/core/config"
import { requireConfig } from "@/backend/core/config"
import { fetchJson } from "@/backend/core/http"
import type { WalletActivity } from "@/backend/core/types"

type Transfer = { contract?: string; symbol?: string; network?: string }
type TransferResponse = { data?: Transfer[] }

export class TheGraphProvider {
  constructor(private readonly config: AppConfig) {}

  async getWalletActivity(wallet: `0x${string}`): Promise<WalletActivity> {
    const token = requireConfig(this.config.graphApiKey, "THE_GRAPH_API_KEY")
    const transfers = await Promise.all(
      this.config.graphNetworks.map(async (network) => {
        const params = new URLSearchParams({ network, address: wallet, limit: "25", page: "1" })
        const response = await fetchJson<TransferResponse>(
          "The Graph",
          `${this.config.graphApiUrl}/v1/evm/transfers?${params}`,
          { headers: { authorization: `Bearer ${token}` } },
        )
        return response.data ?? []
      }),
    )

    const flattened = transfers.flat()
    return {
      provider: "the-graph",
      networks: this.config.graphNetworks,
      transferCount: flattened.length,
      protocols: [...new Set(flattened.map((item) => item.symbol ?? item.contract).filter(Boolean) as string[])].slice(0, 12),
    }
  }
}
