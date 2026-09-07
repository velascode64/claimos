import { z } from "zod"

const envSchema = z.object({
  THE_GRAPH_API_KEY: z.string().min(1).optional(),
  ALCHEMY_API_KEY: z.string().min(1).optional(),
  MERKL_API_KEY: z.string().min(1).optional(),
  BAZANTIC_API_KEY: z.string().min(1).optional(),
  CLAIMOS_GRAPH_API_URL: z.string().url().default("https://token-api.thegraph.com"),
  CLAIMOS_GRAPH_NETWORKS: z.string().default("mainnet,base,arbitrum-one,optimism"),
})

export type AppConfig = ReturnType<typeof getConfig>

export function getConfig() {
  const env = envSchema.parse(process.env)

  return {
    graphApiKey: env.THE_GRAPH_API_KEY,
    alchemyApiKey: env.ALCHEMY_API_KEY,
    merklApiKey: env.MERKL_API_KEY,
    bazanticApiKey: env.BAZANTIC_API_KEY,
    graphApiUrl: env.CLAIMOS_GRAPH_API_URL.replace(/\/$/, ""),
    graphNetworks: env.CLAIMOS_GRAPH_NETWORKS.split(",").map((network) => network.trim()).filter(Boolean),
  }
}

export function requireConfig(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required for live mode`)
  return value
}
