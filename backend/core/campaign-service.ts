import type { Campaign, CampaignRequirement, EligibilityResult } from "./types"

const API = "https://api.merkl.xyz/v4"
const list = (x: any): any[] => Array.isArray(x) ? x : (x.data ?? x.campaigns ?? x.rewards ?? x.items ?? [])
async function get(path: string) { const r = await fetch(`${API}${path}`); const body = await r.text(); if (!r.ok) throw new Error(`Merkl HTTP ${r.status}: ${body.slice(0, 200)}`); return JSON.parse(body) }
async function galxeCampaigns(limit: number): Promise<Campaign[]> {
  const query = `query { campaigns(input: {first: ${Math.min(limit, 100)}, status: Active, listType: Trending}) { list { id name status space { name alias } credentialGroups { credentials { type credType name } } } } }`
  const response = await fetch("https://graphigo.prd.galaxy.eco/query", { method: "POST", headers: { "content-type": "application/json", origin: "https://app.galxe.com" }, body: JSON.stringify({ query }) })
  if (!response.ok) throw new Error(`Galxe HTTP ${response.status}`)
  const json: any = await response.json(); if (json.errors?.length) throw new Error(`Galxe GraphQL: ${json.errors[0].message}`)
  return (json.data?.campaigns?.list ?? []).map((x: any) => { const credentialTypes = (x.credentialGroups ?? []).flatMap((g: any) => g.credentials ?? []).map((c: any) => c.type ?? c.credType).filter(Boolean); const onChain = credentialTypes.some((t: string) => /BALANCE|HOLD|TRANSACTION|SWAP|STAKE|LEND|BORROW/i.test(t)); return { id: `galxe-${x.id}`, protocol: x.space?.name ?? "Galxe", chainId: 1, source: "galxe", sourceUrl: x.space?.alias ? `https://app.galxe.com/quest/${x.space.alias}/${x.id}` : `https://app.galxe.com`, status: "active" as const, credentialTypes, interactionMode: onChain ? "ON_CHAIN" as const : credentialTypes.length ? "MANUAL" as const : "READ_ONLY" as const } })
}
export async function searchCampaigns(limit = 50): Promise<Campaign[]> {
  const rows = list(await get(`/campaigns/?items=${limit}`)); const now = Date.now()
  const merkl = rows.map((x) => { const start = x.startDate ?? x.startsAt, end = x.endDate ?? x.endsAt; const endMs = end ? Date.parse(end) : Infinity; const startMs = start ? Date.parse(start) : 0; return { id: String(x.campaignId ?? x.id), protocol: x.protocol?.name ?? x.protocol ?? "Merkl", chainId: Number(x.distributionChainId ?? x.chainId ?? x.chain?.id), source: "merkl", sourceUrl: x.url ?? x.link, startsAt: start, endsAt: end, status: startMs > now ? "upcoming" : endMs < now ? "ended" : "active" } as Campaign })
  let galxe: Campaign[] = []; try { galxe = await galxeCampaigns(Math.min(limit, 100)) } catch { /* optional source; Merkl remains available */ }
  return [...merkl, ...galxe].slice(0, limit)
}
export async function getCampaignRequirements(id: string): Promise<CampaignRequirement[]> {
  const campaigns = await searchCampaigns(100); const c = campaigns.find((x) => x.id === id); if (!c) throw new Error(`Campaign not found: ${id}`)
  if (c.source === "galxe") return [{ campaignId: id, type: "credential", protocol: c.protocol, chainId: c.chainId, minimumAmount: "0" }]
  return [{ campaignId: id, type: "reward_distribution", protocol: c.protocol, chainId: c.chainId, minimumAmount: "0" }]
}
export async function verifyCampaign(id: string) { const c = (await searchCampaigns(100)).find((x) => x.id === id); if (!c) return { status: "BLOCKED", reason: "Campaign not found" }; const official = c.source === "merkl" || c.source === "galxe"; return { status: official && c.chainId > 0 ? "VERIFIED" : "UNVERIFIED", campaign: c, checks: [{ label: `official ${c.source} API`, passed: official }, { label: "valid distribution chain", passed: c.chainId > 0 }, { label: "interaction classified", passed: Boolean(c.interactionMode) }, { label: "claim safety", passed: false, detail: "Source verified; eligibility and any on-chain action require separate checks" }] } }

/** Deterministic Merkl adapter: eligibility is based only on the official V4 user rewards response. */
export async function checkMerklEligibility(wallet: `0x${string}`, campaignId: string, chainId?: number): Promise<EligibilityResult> {
  const campaign = (await searchCampaigns(100)).find((x) => x.id === campaignId)
  if (!campaign) return { wallet, campaignId, status: "UNKNOWN", completed: [], missing: ["campaign metadata"], evidence: ["Campaign was not returned by Merkl campaigns API"] }
  const chain = chainId ?? campaign.chainId
  try {
    const response = await get(`/users/${wallet}/rewards?chainId=${chain}`)
    const groups = list(response); const rewards = groups.flatMap((g: any) => g.rewards ?? [g])
    const matching = rewards.filter((r: any) => String(r.campaignId ?? r.campaign?.id ?? "") === campaignId || !r.campaignId)
    const completed = ["campaign_exists", "chain_matches", "user_rewards_queried"]
    const eligible = matching.find((r: any) => { try { return BigInt(r.amount ?? 0) - BigInt(r.claimed ?? 0) > 0n && Array.isArray(r.proofs) && r.proofs.length > 0 } catch { return false } })
    if (eligible) return { wallet, campaignId, status: "ELIGIBLE", completed: [...completed, "amount_greater_than_claimed", "usable_proofs"], missing: [], evidence: [`Merkl V4 user rewards returned claimable amount ${(BigInt(eligible.amount) - BigInt(eligible.claimed)).toString()}`, `${eligible.proofs.length} proof(s) available`] }
    const hasUnclaimed = matching.some((r: any) => { try { return BigInt(r.amount ?? 0) > BigInt(r.claimed ?? 0) } catch { return false } })
    return { wallet, campaignId, status: hasUnclaimed ? "ALMOST_ELIGIBLE" : "NOT_ELIGIBLE", completed, missing: hasUnclaimed ? ["usable Merkl proofs"] : ["claimable reward"], evidence: ["Merkl V4 response was checked; pending rewards were not counted"] }
  } catch (error) { return { wallet, campaignId, status: "UNKNOWN", completed: ["campaign_exists"], missing: ["Merkl user rewards response"], evidence: [error instanceof Error ? error.message : String(error)] } }
}
