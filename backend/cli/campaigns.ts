import { Command } from "commander"
import { addressSchema } from "@/backend/core/types"
import { getCampaignRequirements, searchCampaigns, verifyCampaign } from "@/backend/core/campaign-service"

const program = new Command()
program.name("claimos").description("ClaimOS campaign intelligence CLI").option("--json", "machine-readable JSON output")
const emit = (value: unknown) => program.opts().json ? console.log(JSON.stringify(value, null, 2)) : console.dir(value, { depth: 8, colors: true })
const campaigns = program.command("campaigns").description("Discover and inspect reward campaigns")
campaigns.command("search").description("Find active Merkl campaigns").option("--limit <number>", "maximum campaigns", "25").action(async (options) => emit(await searchCampaigns(Number(options.limit))))
campaigns.command("requirements <campaignId>").description("Normalize campaign requirements").action(async (id) => emit(await getCampaignRequirements(id)))
campaigns.command("verify <campaignId>").description("Verify campaign source and chain").action(async (id) => emit(await verifyCampaign(id)))
program.command("eligibility <wallet>").description("Check wallet eligibility").action(async (wallet) => { addressSchema.parse(wallet); emit({ wallet, status: "UNKNOWN", reason: "Eligibility adapters are not configured yet" }); process.exitCode = 2 })
program.parseAsync().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })
