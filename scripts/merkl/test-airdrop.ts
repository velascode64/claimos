import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { getAddress, isAddress } from "viem"

type RewardFile = {
  rewardToken: string
  rewards: Record<string, Record<string, { amount: string; timestamp: string }>>
}

const root = resolve(import.meta.dir, "../..")
const rewardsPath = resolve(root, "artifacts/merkl-test-airdrop/rewards.json")
const dataPath = resolve(root, "artifacts/merkl-test-airdrop/data.json")
const now = Math.floor(Date.now() / 1000)
const oneWeek = 7 * 24 * 60 * 60

const readJson = async <T>(path: string) => JSON.parse(await readFile(path, "utf8")) as T
const requireAddress = (name: string, value?: string) => {
  if (!value || !isAddress(value)) throw new Error(`${name} must be an EVM address`)
  return getAddress(value)
}
const requireUrl = (name: string, value?: string) => {
  if (!value) throw new Error(`${name} is required`)
  const url = new URL(value)
  if (url.protocol !== "https:") throw new Error(`${name} must be an https URL`)
  return url.toString()
}

const rewards = await readJson<RewardFile>(rewardsPath)
const rewardToken = requireAddress("rewardToken", rewards.rewardToken)
let total = 0n
for (const [recipient, reasons] of Object.entries(rewards.rewards)) {
  requireAddress("recipient", recipient)
  for (const reward of Object.values(reasons)) {
    total += BigInt(reward.amount)
    if (BigInt(reward.timestamp) < BigInt(now)) throw new Error("reward timestamp is in the past")
  }
}

const creator = requireAddress("MERKL_CREATOR_ADDRESS", process.env.MERKL_CREATOR_ADDRESS)
const rewardsUrl = requireUrl("MERKL_REWARDS_URL", process.env.MERKL_REWARDS_URL)
const dataUrl = process.env.MERKL_DATA_URL ? requireUrl("MERKL_DATA_URL", process.env.MERKL_DATA_URL) : undefined
const distributionChainId = Number(process.env.MERKL_DISTRIBUTION_CHAIN_ID ?? 10)
const startTimestamp = Number(process.env.MERKL_START_TIMESTAMP ?? now + 60 * 60)
const endTimestamp = Number(process.env.MERKL_END_TIMESTAMP ?? startTimestamp + oneWeek)

if (!Number.isInteger(distributionChainId) || distributionChainId <= 0) throw new Error("MERKL_DISTRIBUTION_CHAIN_ID must be a chain id")
if (endTimestamp <= startTimestamp) throw new Error("MERKL_END_TIMESTAMP must be after MERKL_START_TIMESTAMP")

await readJson(dataPath)

console.log(JSON.stringify({
  distributionChainId,
  amount: total.toString(),
  computeChainId: distributionChainId,
  creator,
  startTimestamp,
  rewardToken,
  campaignType: 27,
  endTimestamp,
  rewardsUrl,
  ...(dataUrl ? { dataUrl } : {}),
}, null, 2))

