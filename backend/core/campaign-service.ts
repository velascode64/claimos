import type { Campaign, CampaignRequirement } from "./types"

const API = "https://api.merkl.xyz/v4"
const list = (x: any): any[] => Array.isArray(x) ? x : (x.data ?? x.campaigns ?? x.rewards ?? x.items ?? [])
async function get(path: string) { const r = await fetch(`${API}${path}`); const body = await r.text(); if (!r.ok) throw new Error(`Merkl HTTP ${r.status}: ${body.slice(0, 200)}`); return JSON.parse(body) }
export async function searchCampaigns(limit = 50): Promise<Campaign[]> {
  const rows = list(await get(`/campaigns/?items=${limit}`)); const now = Date.now()
  return rows.map((x) => { const start = x.startDate ?? x.startsAt, end = x.endDate ?? x.endsAt; const endMs = end ? Date.parse(end) : Infinity; const startMs = start ? Date.parse(start) : 0; return { id: String(x.campaignId ?? x.id), protocol: x.protocol?.name ?? x.protocol ?? "Merkl", chainId: Number(x.distributionChainId ?? x.chainId ?? x.chain?.id), source: "merkl", sourceUrl: x.url ?? x.link, startsAt: start, endsAt: end, status: startMs > now ? "upcoming" : endMs < now ? "ended" : "active" } as Campaign })
}
export async function getCampaignRequirements(id: string): Promise<CampaignRequirement[]> {
  const campaigns = await searchCampaigns(100); const c = campaigns.find((x) => x.id === id); if (!c) throw new Error(`Campaign not found: ${id}`)
  return [{ campaignId: id, type: "reward_distribution", protocol: c.protocol, chainId: c.chainId, minimumAmount: "0" }]
}
export async function verifyCampaign(id: string) { const c = (await searchCampaigns(100)).find((x) => x.id === id); if (!c) return { status: "BLOCKED", reason: "Campaign not found" }; return { status: c.source === "merkl" && c.chainId > 0 ? "VERIFIED" : "UNVERIFIED", campaign: c, checks: [{ label: "official Merkl API", passed: true }, { label: "valid distribution chain", passed: c.chainId > 0 }] } }
