import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"

const outDir = resolve(import.meta.dir, "../../artifacts/validation")
await mkdir(outDir, { recursive: true })
const maxCampaignPages = Number(process.env.MERKL_DISCOVERY_MAX_CAMPAIGN_PAGES ?? 10)
const maxRecipientPages = Number(process.env.MERKL_DISCOVERY_MAX_RECIPIENT_PAGES ?? 10)
const maxCandidates = Number(process.env.MERKL_DISCOVERY_MAX_CANDIDATES ?? 2000)
const get = async (url: string) => { const r = await fetch(url); const text = await r.text(); if (!r.ok) throw new Error(`MERKL_HTTP ${r.status}: ${text.slice(0, 200)}`); return JSON.parse(text) }
const list = (x: any) => Array.isArray(x) ? x : (x.data ?? x.rewards ?? x.campaigns ?? x.items ?? [])
const stats = { campaignPages: 0, campaigns: 0, recipientPages: 0, candidates: 0, rewardQueries: 0, chains: new Set<number>(), walletsWithRewards: 0, amountGtClaimed: 0, proofsUsable: 0, apiErrors: 0 }
console.log("\n  Merkl live-fixture discovery (read-only)")
console.log("  Buscando campañas, recipients y rewards verificables...\n")
const candidates = new Map<string, Set<number>>()
const add = (a: any, chain: number) => { const s = String(a ?? "").toLowerCase(); if (/^0x[0-9a-f]{40}$/.test(s) && candidates.size < maxCandidates) { if (!candidates.has(s)) candidates.set(s, new Set()); candidates.get(s)!.add(chain) } }
const override = process.env.MERKL_FIXTURE_ADDRESS
if (override) for (const chain of (process.env.MERKL_FIXTURE_CHAIN_IDS ?? "1").split(",")) add(override, Number(chain))
else for (let page = 0; page < maxCampaignPages && candidates.size < maxCandidates; page++) { const campaigns = list(await get(`https://api.merkl.xyz/v4/campaigns/?page=${page + 1}&items=100`)); stats.campaignPages++; stats.campaigns += campaigns.length; if (!campaigns.length) break; for (const c of campaigns) { const chain = Number(c.distributionChainId ?? c.chainId ?? c.chain?.id); const id = c.campaignId ?? c.id; if (!chain || !id) continue; stats.chains.add(chain); for (let rp = 0; rp < maxRecipientPages && candidates.size < maxCandidates; rp++) { const rows = list(await get(`https://api.merkl.xyz/v4/rewards/?chainId=${chain}&campaignId=${encodeURIComponent(id)}&items=100&page=${rp + 1}`)); stats.recipientPages++; if (!rows.length) break; for (const row of rows) add(row.address ?? row.user ?? row.recipient ?? row.account, chain) } } }
for (const [wallet, chains] of candidates) { for (const chain of chains) { stats.rewardQueries++; const rows = list(await get(`https://api.merkl.xyz/v4/users/${wallet}/rewards?chainId=${chain}`)); if (rows.length) stats.walletsWithRewards++; for (const group of rows) for (const reward of (group.rewards ?? [group])) { const amount = BigInt(reward.amount ?? 0), claimed = BigInt(reward.claimed ?? 0); if (amount > claimed) stats.amountGtClaimed++; if (amount > claimed && Array.isArray(reward.proofs) && reward.proofs.length) { stats.proofsUsable++; const fixture = { address: wallet, chainId: Number(group.chain?.id ?? chain), campaignId: reward.campaignId ?? reward.campaign?.id, token: reward.token?.address ?? reward.tokenAddress, amount: amount.toString(), claimed: claimed.toString(), claimable: (amount - claimed).toString(), proofs: reward.proofs, discoveredAt: new Date().toISOString() }; await Bun.write(resolve(outDir, "merkl-fixture.json"), JSON.stringify(fixture, null, 2)); console.log(`fixture selected: ${wallet}\nchain: ${fixture.chainId}`); process.exit(0) } } } }
console.log(`Merkl fixture discovery\ncampaign pages scanned: ${stats.campaignPages}\ncampaigns scanned: ${stats.campaigns}\nrecipient pages scanned: ${stats.recipientPages}\nunique wallet candidates: ${candidates.size}\nwallet reward queries: ${stats.rewardQueries}\nchains checked: ${[...stats.chains].join(",")}`)
console.error("MERKL_NO_LIVE_FIXTURE"); process.exitCode = 1
