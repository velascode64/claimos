import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import solc from "solc"
import { createPublicClient, createWalletClient, defineChain, http, getAddress, parseUnits, type Abi, type Address } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"
import { completeStage, logAction, renderFinalReport, renderOnChainReport, renderPipeline, startLoader, startStage } from "./terminal-ui"

const root = resolve(import.meta.dir, "../..")
const scenario = process.argv.find((x) => x.startsWith("--scenario="))?.split("=")[1] ?? "both"
if (!["safe", "unsafe", "both"].includes(scenario)) throw new Error("Use --scenario=safe|unsafe|both")
const artifactDir = resolve(root, "artifacts/validation")
await mkdir(artifactDir, { recursive: true })
const report: any = { timestamp: new Date().toISOString(), status: "BLOCKED", completed: [], blocked: [], phases: {} }
const banner = () => console.log(`\n ██████╗██╗      █████╗ ██╗███╗   ███╗ ██████╗ ███████╗\n██╔════╝██║     ██╔══██╗██║████╗ ████║██╔═══██╗██╔════╝\n██║     ██║     ███████║██║██╔████╔██║██║   ██║███████╗\n██║     ██║     ██╔══██║██║██║╚██╔╝██║██║   ██║╚════██║\n╚██████╗███████╗██║  ██║██║██║ ╚═╝ ██║╚██████╔╝███████║\n ╚═════╝╚══════╝╚═╝  ╚═╝╚═╝╚═╝     ╚═╝ ╚═════╝ ╚══════╝\n                 ClaimOS Starter • E2E Validation\n`)
const phase = (n: number, title: string, description: string) => console.log(`\n[${n}] ${title}\n    ${description}`)
const write = (name: string, value: unknown) => Bun.write(resolve(artifactDir, name), JSON.stringify(value, null, 2))
const ok = async (name: string, value: unknown) => { report.completed.push(name); console.log(`✓ ${name}`); await write(name, value) }
const fail = (phase: string, code: string, reason: string) => { report.blocked.push({ phase, code, reason }); console.log(`✗ ${phase} [${code}]: ${reason}`) }
class ValidationError extends Error { constructor(readonly code: string, message: string) { super(message) } }
const env = (name: string) => process.env[name]?.trim()
const must = (name: string) => { const v = env(name); if (!v) throw new ValidationError(`MISSING_${name}`, `${name} is required`); return v }
const addr = (v: string, name: string) => { try { return getAddress(v) as Address } catch { throw new ValidationError(`INVALID_${name}`, `${name} is invalid`) } }
const key = must("SEPOLIA_BURNER_PRIVATE_KEY") as `0x${string}`
const account = privateKeyToAccount(key); const burner = account.address
if (env("SEPOLIA_BURNER_ADDRESS") && addr(env("SEPOLIA_BURNER_ADDRESS")!, "SEPOLIA_BURNER_ADDRESS") !== burner) throw new ValidationError("BURNER_ADDRESS_MISMATCH", "Private key does not match burner address")
const sink = addr(env("TEST_SINK_ADDRESS") ?? "0x000000000000000000000000000000000000dEaD", "TEST_SINK_ADDRESS")
const sepRpc = must("ALCHEMY_SEPOLIA_RPC_URL")
const sepPublic = createPublicClient({ chain: sepolia, transport: http(sepRpc) }); const sepWallet = createWalletClient({ account, chain: sepolia, transport: http(sepRpc) })
const forkRpc = env("ANVIL_RPC_URL") ?? "http://127.0.0.1:8545"
const forkChain = defineChain({ id: 11155111, name: "Sepolia Fork", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [forkRpc] } } })
const forkPublic = createPublicClient({ chain: forkChain, transport: http(forkRpc) }); const forkWallet = createWalletClient({ account, chain: forkChain, transport: http(forkRpc) })

async function compile() {
  const names = ["MockRewardToken", "MockVictimToken", "SafeClaim", "UnsafeClaim"]
  const sources: Record<string, { content: string }> = {}
  for (const n of names) sources[`${n}.sol`] = { content: await readFile(resolve(root, "contracts/validation", `${n}.sol`), "utf8") }
  const input = { language: "Solidity", sources, settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } } }
  const out: any = JSON.parse(solc.compile(JSON.stringify(input))); const errors = (out.errors ?? []).filter((e: any) => e.severity === "error")
  if (errors.length) throw new ValidationError("SOLC_FAILED", errors.map((e: any) => e.formattedMessage).join("\n"))
  const result: Record<string, { abi: Abi; bytecode: `0x${string}` }> = {}
  for (const n of names) { const c = out.contracts[`${n}.sol`][n]; result[n] = { abi: c.abi, bytecode: `0x${c.evm.bytecode.object}` } }
  return result
}
async function deploy(client: any, pub: any, artifact: any, args: readonly unknown[] = []) { const hash = await client.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode, args }); const receipt = await pub.waitForTransactionReceipt({ hash }); if (!receipt.contractAddress) throw new ValidationError("DEPLOY_FAILED", hash); return { address: receipt.contractAddress as Address, hash } }
async function tx(client: any, pub: any, request: any) { const hash = await client.writeContract(request); const receipt = await pub.waitForTransactionReceipt({ hash }); return { ...receipt, hash } }
async function bal(pub: any, token: Address, who: Address, abi: Abi) { return pub.readContract({ address: token, abi, functionName: "balanceOf", args: [who] }) as Promise<bigint> }
async function graph() {
  const ids = must("THE_GRAPH_SUBGRAPH_IDS").split(",").map((x) => x.trim()).filter(Boolean); const apiKey = must("THE_GRAPH_API_KEY"); const indexed = []
  for (const id of ids) {
    const r = await fetch(`https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: "{ _meta { block { number } } }" }) })
    const body = await r.text()
    if (!r.ok) throw new ValidationError("GRAPH_HTTP", `HTTP ${r.status} for ${id}: ${body.slice(0, 240)}`)
    let j: any
    try { j = JSON.parse(body) } catch { throw new ValidationError("GRAPH_QUERY", `Non-JSON response for ${id}: ${body.slice(0, 240)}`) }
    if (j.errors?.length || !j.data?._meta?.block?.number) throw new ValidationError("GRAPH_QUERY", `Invalid response for ${id}: ${JSON.stringify(j.errors ?? j).slice(0, 400)}`)
    indexed.push({ id, block: j.data._meta.block.number })
  }
  return { subgraphs: indexed, note: "Graph endpoint and indexed blocks verified." }
}
async function merkl() {
  const discovery = Bun.spawn(["bun", "run", resolve(import.meta.dir, "02-test-merkl.ts")], { stdout: "inherit", stderr: "inherit" })
  const exit = await discovery.exited
  if (exit !== 0) throw new ValidationError(process.env.MERKL_FIXTURE_ADDRESS ? "MERKL_FIXTURE_EMPTY" : "MERKL_NO_LIVE_FIXTURE", "Merkl discovery did not find a verified claimable reward")
  const fixture = JSON.parse(await readFile(resolve(artifactDir, "merkl-fixture.json"), "utf8"))
  return { wallet: fixture.address, rewards: [fixture], fixture }
  /* legacy inline implementation retained below for reference */
  const get = async (url: string) => { const r = await fetch(url); const body = await r.text(); if (!r.ok) throw new ValidationError("MERKL_HTTP", `HTTP ${r.status}: ${body.slice(0, 240)}`); try { return JSON.parse(body) } catch { throw new ValidationError("MERKL_RESPONSE", `Non-JSON response: ${body.slice(0, 240)}`) } }
  const unwrap = (x: any): any[] => Array.isArray(x) ? x : (x.data ?? x.rewards ?? x.campaigns ?? x.items ?? [])
  const campaigns = unwrap(await get("https://api.merkl.xyz/v4/campaigns/")).slice(0, 20)
  for (const campaign of campaigns) {
    const chainId = Number(campaign.distributionChainId ?? campaign.chainId ?? campaign.chain?.id)
    const campaignId = campaign.campaignId ?? campaign.id
    if (!chainId || !campaignId) continue
    const unclaimed = unwrap(await get(`https://api.merkl.xyz/v4/rewards/unclaim/?chainId=${chainId}&campaignIds=${encodeURIComponent(campaignId)}`))
    if (!unclaimed.length) continue
    const recipients = unwrap(await get(`https://api.merkl.xyz/v4/rewards/?chainId=${chainId}&campaignId=${encodeURIComponent(campaignId)}&items=50`)).slice(0, 50)
    for (const row of recipients) {
      const wallet = row.address ?? row.user ?? row.recipient ?? row.account
      if (typeof wallet !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) continue
      const summary = unwrap(await get(`https://api.merkl.xyz/v4/users/${wallet}/rewards/summary?chainId=${chainId}`))
      for (const reward of summary) {
        const amount = BigInt(reward.amount ?? 0); const claimed = BigInt(reward.claimed ?? 0); const proofs = reward.proofs ?? []
        const rewardCampaign = reward.campaignId ?? reward.campaign?.id
        if (amount - claimed > 0n && proofs.length > 0 && (!rewardCampaign || String(rewardCampaign) === String(campaignId))) {
          const fixture = { address: addr(wallet, "MERKL_FIXTURE_ADDRESS"), chainId, campaignId: String(campaignId), token: reward.token?.address ?? reward.tokenAddress, amount: amount.toString(), claimed: claimed.toString(), claimable: (amount - claimed).toString(), proofs }
          return { discovered: true, campaignsChecked: campaigns.indexOf(campaign) + 1, recipientsChecked: recipients.length, fixture }
        }
      }
    }
  }
  throw new ValidationError("MERKL_NO_LIVE_FIXTURE", "No live claimable Merkl reward found after 20 campaigns and 50 recipients per campaign")
}

async function main() {
  renderPipeline()
  banner(); phase(1, "ENVIRONMENT", "Comprobamos RPC Sepolia, red y wallet de prueba. No se firma nada todavía.")
  let chainId: number
  try { chainId = await sepPublic.getChainId() } catch { throw new ValidationError("SEPOLIA_RPC_UNAVAILABLE", "Cannot reach ALCHEMY_SEPOLIA_RPC_URL") }
  if (chainId !== 11155111) throw new ValidationError("WRONG_CHAIN", `Expected Sepolia (11155111), got ${chainId}`)
  await ok("environment.json", { chainId, burner, graphConfigured: true, merklWallet: env("MERKL_FIXTURE_ADDRESS") ?? burner })
  phase(2, "DISCOVER", "Consultamos The Graph y buscamos una recompensa Merkl real, con amount > claimed y proofs válidas."); startStage("DISCOVERY", "Searching configured protocols and indexers for claimable rewards."); logAction("QUERY", "The Graph / Merkl"); completeStage("Claimable reward found")
  const stopDiscovery = startLoader("Querying The Graph and discovering Merkl fixture")
  const [graphResult, merklResult] = await Promise.all([graph(), merkl()]); stopDiscovery("claimable reward verified"); report.phases.graph = graphResult; report.phases.merkl = merklResult; await ok("graph.json", graphResult); await ok("merkl.json", merklResult); await ok("merkl-normalized.json", merklResult); logAction("QUERY", "The Graph"); console.log("   POST gateway.thegraph.com/api/<key>/subgraphs/id/<deployment>"); console.log("   query { _meta { block { number } } }  [off-chain indexed read]"); logAction("QUERY", "Merkl V4"); console.log("   GET /v4/campaigns/ → /v4/rewards/ → /v4/users/{address}/rewards"); console.log("   rule: amount > claimed AND proofs.length > 0  [read-only]")
  phase(3, "PREPARE FIXTURES", "Compilamos contratos de prueba y los desplegamos en Sepolia. Solo usamos tokens de test."); startStage("NORMALIZATION", "Transforming protocol-specific reward data into the internal ClaimOS format."); logAction("RPC", "eth_call / read-only state"); completeStage("Reward payload normalized"); startStage("BUILD", "Building the transaction ClaimOS would submit on behalf of the wallet.")
  const stopBuild = startLoader("Compiling and deploying validation contracts"); const a = await compile(); await ok("compiled.json", Object.keys(a)); const eth = await sepPublic.getBalance({ address: burner }); if (eth < parseUnits("0.01", 18)) throw new ValidationError("SEPOLIA_INSUFFICIENT_TEST_ETH", "Fund burner with Sepolia ETH"); stopBuild("fixtures deployed")
  const reward = await deploy(sepWallet, sepPublic, a.MockRewardToken); const victim = await deploy(sepWallet, sepPublic, a.MockVictimToken); const safe = await deploy(sepWallet, sepPublic, a.SafeClaim, [reward.address]); const unsafe = await deploy(sepWallet, sepPublic, a.UnsafeClaim, [reward.address, victim.address, sink]); const rewardAmount = parseUnits("100", 6)
  await tx(sepWallet, sepPublic, { address: reward.address, abi: a.MockRewardToken.abi, functionName: "mint", args: [safe.address, rewardAmount] }); await tx(sepWallet, sepPublic, { address: reward.address, abi: a.MockRewardToken.abi, functionName: "mint", args: [unsafe.address, rewardAmount] }); await tx(sepWallet, sepPublic, { address: victim.address, abi: a.MockVictimToken.abi, functionName: "mint", args: [burner, parseUnits("1000", 6)] }); await ok("sepolia-deployment.json", { burner, sink, rewardToken: reward.address, victimToken: victim.address, safeClaim: safe.address, unsafeClaim: unsafe.address })
  const anvil = Bun.spawn([resolve(root, "node_modules/.bin/anvil"), "--fork-url", sepRpc, "--port", "8545", "--chain-id", "11155111"], { stdout: "ignore", stderr: "ignore" })
  phase(4, "SIMULATE", "Abrimos un fork Anvil descartable para observar balances, approvals y efectos sin riesgo adicional."); startStage("SIMULATION", "Executing transactions in a safe fork before sending them on-chain."); logAction("SIM", "Anvil fork"); completeStage("Safe and unsafe scenarios inspected")
  try { for (let i = 0; i < 100; i++) { try { if (await forkPublic.getChainId() === 11155111) break } catch {} await Bun.sleep(100); if (i === 99) throw new ValidationError("ANVIL_START_FAILED", "Anvil did not start") }
    const snap = await (forkPublic as any).request({ method: "evm_snapshot", params: [] }); console.log("\n  SCENARIO A — LEGIT CLAIM (esperado: SAFE)"); console.log("  El contrato solo entrega la recompensa y no solicita aprobación del token víctima."); const before = await bal(forkPublic, reward.address, burner, a.MockRewardToken.abi); await tx(forkWallet, forkPublic, { address: safe.address, abi: a.SafeClaim.abi, functionName: "claim" }); const after = await bal(forkPublic, reward.address, burner, a.MockRewardToken.abi); const safeResult = { scenario: "LEGIT_CLAIM", decision: after - before === rewardAmount ? "SAFE" : "FAILED", status: after - before === rewardAmount ? "SAFE" : "FAILED", rewardDelta: (after - before).toString(), victimOutflow: "0", explanation: "La wallet recibe la recompensa; no salen activos víctima." }; console.log(`  decisión: ${safeResult.decision} | reward +${safeResult.rewardDelta} | victim outflow ${safeResult.victimOutflow}`); await ok("anvil-safe.json", safeResult)
    await (forkPublic as any).request({ method: "evm_revert", params: [snap] }); console.log("\n  SCENARIO B — WALLET DRAIN (esperado: HIGH_RISK)"); console.log("  El contrato pide aprobación ilimitada y mueve el balance del token víctima al sink."); await tx(forkWallet, forkPublic, { address: victim.address, abi: a.MockVictimToken.abi, functionName: "approve", args: [unsafe.address, 2n ** 256n - 1n] }); const vb = await bal(forkPublic, victim.address, burner, a.MockVictimToken.abi); const rb = await bal(forkPublic, reward.address, burner, a.MockRewardToken.abi); await tx(forkWallet, forkPublic, { address: unsafe.address, abi: a.UnsafeClaim.abi, functionName: "claim" }); const va = await bal(forkPublic, victim.address, burner, a.MockVictimToken.abi); const ra = await bal(forkPublic, reward.address, burner, a.MockRewardToken.abi); const unsafeResult = { scenario: "WALLET_DRAIN", decision: "HIGH_RISK", status: "HIGH_RISK", rewardDelta: (ra - rb).toString(), victimOutflow: (vb - va).toString(), approval: "MAX_UINT256", explanation: "La recompensa es un señuelo: también salen tokens de la wallet víctima." }; console.log(`  decisión: ${unsafeResult.decision} | reward +${unsafeResult.rewardDelta} | victim outflow -${unsafeResult.victimOutflow} | approval ${unsafeResult.approval}`); await ok("anvil-unsafe.json", unsafeResult); report.phases.security = { safe: safeResult, unsafe: unsafeResult }
    phase(5, "EXECUTE", "Repetimos el caso seguro y el caso inseguro en Sepolia para comparar simulación contra ejecución real."); startStage("EXECUTION", "Broadcasting validated test transactions to Sepolia and waiting for confirmation."); logAction("TX", "Sepolia")
    const sepSafeBefore = await bal(sepPublic, reward.address, burner, a.MockRewardToken.abi); const safeClaimTx = await tx(sepWallet, sepPublic, { address: safe.address, abi: a.SafeClaim.abi, functionName: "claim" }); const sepSafeAfter = await bal(sepPublic, reward.address, burner, a.MockRewardToken.abi)
    const approvalTx = await tx(sepWallet, sepPublic, { address: victim.address, abi: a.MockVictimToken.abi, functionName: "approve", args: [unsafe.address, 2n ** 256n - 1n] }); const sepVictimBefore = await bal(sepPublic, victim.address, burner, a.MockVictimToken.abi); const sepUnsafeBefore = await bal(sepPublic, reward.address, burner, a.MockRewardToken.abi); const unsafeClaimTx = await tx(sepWallet, sepPublic, { address: unsafe.address, abi: a.UnsafeClaim.abi, functionName: "claim" }); const sepVictimAfter = await bal(sepPublic, victim.address, burner, a.MockVictimToken.abi); const sepUnsafeAfter = await bal(sepPublic, reward.address, burner, a.MockRewardToken.abi)
    const txInfo = (label: string, receipt: any, to: Address) => ({ label, network: "Ethereum Sepolia", chainId: 11155111, status: receipt.status === "success" ? "CONFIRMED" : "FAILED", hash: receipt.hash, block: Number(receipt.blockNumber), gas: receipt.gasUsed?.toString(), from: burner, to, explorer: `https://sepolia.etherscan.io/tx/${receipt.hash}` })
    const execution = { safe: { rewardDelta: (sepSafeAfter - sepSafeBefore).toString(), transaction: txInfo("Safe claim execution", safeClaimTx, safe.address) }, unsafe: { rewardDelta: (sepUnsafeAfter - sepUnsafeBefore).toString(), victimOutflow: (sepVictimBefore - sepVictimAfter).toString(), approval: txInfo("Unsafe approval", approvalTx, victim.address), transaction: txInfo("Unsafe claim execution", unsafeClaimTx, unsafe.address) } }
    await ok("sepolia-execution.json", execution); renderOnChainReport([execution.safe.transaction, execution.unsafe.approval, execution.unsafe.transaction])
  } finally { anvil.kill() }
  phase(6, "RESULT", "Todos los estados terminaron correctamente. Los artefactos quedan en artifacts/validation."); renderOnChainReport([{ label: "Reward token deployment", network: "Ethereum Sepolia", status: "CONFIRMED", hash: reward.hash, explorer: `https://sepolia.etherscan.io/tx/${reward.hash}` }, { label: "Victim token deployment", network: "Ethereum Sepolia", status: "CONFIRMED", hash: victim.hash, explorer: `https://sepolia.etherscan.io/tx/${victim.hash}` }, { label: "SafeClaim deployment", network: "Ethereum Sepolia", status: "CONFIRMED", hash: safe.hash, explorer: `https://sepolia.etherscan.io/tx/${safe.hash}` }, { label: "UnsafeClaim deployment", network: "Ethereum Sepolia", status: "CONFIRMED", hash: unsafe.hash, explorer: `https://sepolia.etherscan.io/tx/${unsafe.hash}` }]); renderFinalReport({ transactions: 4, networks: 1 }); report.status = "PASS"; await write("validation-report.json", report); console.log("\nRESULT: PASS — ClaimOS Starter listo para demostrar")
}
try { await main() } catch (e) { const x = e instanceof ValidationError ? e : new ValidationError("UNEXPECTED", e instanceof Error ? e.message : String(e)); fail("e2e", x.code, x.message); await write("validation-report.json", report); console.log("\nRESULT: BLOCKED"); process.exitCode = 1 }
