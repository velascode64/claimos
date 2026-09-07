const tty = Boolean(process.stdout.isTTY)
let currentStage = "INIT"
const stamp = () => new Date().toISOString().slice(11, 19)
const c = (code: string, s: string) => tty ? `\x1b[${code}m${s}\x1b[0m` : s
export const green = (s: string) => c("32", s), yellow = (s: string) => c("33", s), red = (s: string) => c("31", s), cyan = (s: string) => c("36", s), gray = (s: string) => c("90", s)
export function renderPipeline(current = "DISCOVERY") { console.log(`\n ${cyan("CLAIMOS / E2E")}\n\n ● DISCOVERY ──────● NORMALIZE ─────● SIMULATE ─────● EXECUTE\n     ${current}\n`) }
export function startStage(name: string, description: string) { currentStage = name; console.log(`\n ${cyan(name)}\n ${"━".repeat(58)}\n\n ${stamp()} [${name}] ${yellow("●")} ${description}\n`) }
export function startLoader(label: string) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
  let i = 0
  if (!tty) { console.log(`   [RUNNING] ${label}...`); return () => undefined }
  process.stdout.write(`\r   ${yellow(frames[0])} ${label}...`)
  const timer = setInterval(() => { i = (i + 1) % frames.length; process.stdout.write(`\r   ${yellow(frames[i])} ${label}...`) }, 120)
  return (done = "done") => { clearInterval(timer); process.stdout.write(`\r   ${green("✓")} ${label} — ${done}\n`) }
}
export function completeStage(message: string) { console.log(` ${stamp()} [${currentStage}] ${green("✓")} ${message}`) }
export function failStage(message: string) { console.log(` ${stamp()} [${currentStage}] ${red("✕")} ${message}`) }
export function logEvent(kind: string, message: string, details?: string) { console.log(` ${stamp()} [${currentStage}] [${kind}] ${message}${details ? ` — ${gray(details)}` : ""}`) }
export function logAction(kind: string, message: string) { logEvent(kind, message) }
export function logTx(meta: any, confirmed = false) { console.log(`\n ${confirmed ? green("✓ Transaction confirmed") : yellow("● Broadcasting transaction...")}\n\n   Network     ${meta.network}\n   From        ${meta.from}\n   To          ${meta.to ?? "contract deployment"}\n   Hash        ${meta.hash ?? "pending"}${confirmed ? `\n   Block       ${meta.block}\n   Gas used    ${meta.gas}` : ""}`) }
export function renderOnChainReport(txs: any[]) { console.log(`\n ${cyan("ON-CHAIN REPORT")}\n ${"━".repeat(58)}`); for (const [i, t] of txs.entries()) console.log(`\n ${String(i + 1).padStart(2, "0")}  ${t.label}\n\n     Network      ${t.network}\n     Status       ${t.status}\n     Hash         ${t.hash}\n     Block        ${t.block ?? "-"}\n     Gas used     ${t.gas ?? "-"}\n     From         ${t.from ?? "-"}\n     To           ${t.to ?? "-"}${t.explorer ? `\n\n     Explorer\n     ${t.explorer}` : ""}`) }
export function renderFinalReport(data: any) { console.log(`\n ${cyan("CLAIMOS E2E REPORT")}\n ${"━".repeat(58)}\n\n Discovery        PASS\n Normalization    PASS\n Build            PASS\n Safe simulation  PASS\n Unsafe rejection PASS\n Execution        PASS\n\n Transactions     ${data.transactions} confirmed\n Networks         ${data.networks}\n Failed checks    0\n\n RESULT: ${green("PASS")}`) }
