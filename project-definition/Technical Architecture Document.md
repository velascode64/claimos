# ClaimOS — Technical Architecture Document

## 1. Technical Goal

Build an EVM-first MVP that can work in **two independent modes**:

1. **Standalone CLI / API mode**  
   ClaimOS can be executed directly by a developer or user without any AI agent.

2. **Agentic mode**  
   Any compatible agent can use ClaimOS through MCP / Bazantic recipes to autonomously discover, investigate, verify, and classify opportunities until the moment where the user must decide whether to participate.

The core product remains deterministic and usable without an agent.

### Core flow

```text
Discover Campaigns
    ↓
Understand Requirements
    ↓
Check Wallet Eligibility
    ↓
Verify Campaign Safety
    ↓
Recommend
    ↓
USER DECISION
    ↓
Prepare
    ↓
Simulate
    ↓
Approve
    ↓
Execute
    ↓
Monitor
```

The agent may autonomously operate up to **Recommend**.

Participation, signing, and execution remain **human-in-the-loop** in the MVP.

---

## 2. Architectural Principle

ClaimOS is divided into two layers:

```text
┌──────────────────────────────────────────┐
│              AGENTIC LAYER               │
│                                          │
│  OpenClaw / Claude / Codex / other agent │
│                  │                       │
│           Bazantic Recipe                │
│                  │                       │
│             MCP / CLI                    │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│          CLAIMOS DETERMINISTIC CORE       │
│                                          │
│ campaign discovery                       │
│ campaign requirements                    │
│ wallet eligibility                       │
│ campaign verification                    │
│ claim detection                          │
│ transaction preparation                  │
│ simulation / security                    │
│ execution                                │
└──────────────────────────────────────────┘
```

### Key rule

**The agent is optional.**

Everything exposed to an agent must also be executable directly from the ClaimOS CLI/API.

---

## 3. Main Technologies

| Technology / Component | Role | Main capability |
|---|---|---|
| **The Graph** | Wallet and protocol context | Subgraphs / standardized onchain data |
| **Merkl** | Rewards and campaign source | Rewards + campaign data |
| **Campaign Sources** | Campaign discovery | Official APIs, protocol feeds, supported quest platforms |
| **Claim Adapters** | Claims outside Merkl | Protocol/distributor-specific integrations |
| **RPC / viem** | Deterministic wallet checks | balances, contracts, events, state |
| **Alchemy** | Transaction simulation and security | simulation + asset changes |
| **Bazantic** | Agent workflow instructions | Recipe describing how agents use ClaimOS tools |
| **MCP** | Agent interface | Expose ClaimOS capabilities to external agents |
| **Privy** | Wallet UX | wallet connection + signing |
| **Ledger** | Human approval | secure final transaction approval |
| **Local Agent State** | Agent memory | optional files / local SQLite managed by the agent |
| **Supabase/Postgres** | Optional product persistence | not required for MVP core |

---

# PART I — CLAIMOS CORE

## 4. Standalone ClaimOS CLI

ClaimOS must work without OpenClaw, Claude, Codex, or any other agent.

Example:

```bash
claimos campaigns search
claimos campaigns requirements <campaign-id>
claimos eligibility check --wallet 0x...
claimos campaign verify <campaign-id>
claimos claims scan --wallet 0x...
claimos claim prepare <claim-id>
claimos claim verify <claim-id>
claimos claim execute <claim-id>
```

The CLI should return structured JSON so it can be consumed by:

- humans
- scripts
- CI
- MCP
- Bazantic
- AI agents

Example:

```json
{
  "campaignId": "merkl-morpho-base-usdc",
  "status": "almost_eligible",
  "missingRequirements": [
    {
      "action": "deposit",
      "protocol": "Morpho",
      "asset": "USDC",
      "minimum": "100"
    }
  ],
  "security": {
    "status": "verified"
  }
}
```

---

## 5. Missing Campaign Intelligence Tools

These are the new capabilities that ClaimOS still needs.

### 5.1 `search_campaigns()`

Find currently active reward / quest / incentive campaigns.

Sources may include:

- Merkl
- supported protocol APIs
- official campaign feeds
- selected quest platforms
- protocol-specific adapters

Output:

```ts
type Campaign = {
  id: string;
  protocol: string;
  chainId: number;
  source: string;
  sourceUrl?: string;
  startsAt?: string;
  endsAt?: string;
  status: "active" | "upcoming" | "ended";
};
```

CLI:

```bash
claimos campaigns search
```

MCP Tool:

```text
search_campaigns()
```

---

### 5.2 `get_campaign_requirements()`

Convert campaign metadata into deterministic, structured requirements.

Example source text:

```text
Deposit at least 100 USDC into Morpho on Base before September 30.
```

Normalized result:

```json
{
  "campaignId": "morpho-base-usdc",
  "requirements": [
    {
      "type": "deposit",
      "protocol": "Morpho",
      "chainId": 8453,
      "asset": "USDC",
      "minimumAmount": "100"
    }
  ]
}
```

Requirements can be derived from:

1. official structured API data
2. protocol adapter
3. trusted campaign metadata
4. LLM parsing only when necessary

The LLM may interpret text, but the final rule must be stored as structured data that can be checked deterministically.

CLI:

```bash
claimos campaigns requirements <campaign-id>
```

MCP Tool:

```text
get_campaign_requirements(campaign_id)
```

---

### 5.3 `check_wallet_eligibility()`

Compare a wallet against known campaign requirements.

Inputs:

```text
wallet
campaign_id
```

Data sources:

- The Graph
- RPC / viem
- Merkl
- protocol-specific APIs
- adapters

Possible status:

```text
ELIGIBLE
ALMOST_ELIGIBLE
NOT_ELIGIBLE
UNKNOWN
```

Example:

```json
{
  "wallet": "0x...",
  "campaignId": "morpho-base-usdc",
  "status": "almost_eligible",
  "completed": [
    "wallet_has_usdc_on_base"
  ],
  "missing": [
    "deposit_at_least_100_usdc"
  ]
}
```

CLI:

```bash
claimos eligibility check \
  --wallet 0x... \
  --campaign morpho-base-usdc
```

MCP Tool:

```text
check_wallet_eligibility(wallet, campaign_id)
```

---

### 5.4 `verify_campaign()`

Determine whether the campaign is safe enough to recommend.

Checks may include:

- trusted source
- official protocol/domain
- expected contract addresses
- chain
- distributor
- suspicious approvals
- malicious calls
- asset movement
- transaction simulation when applicable

Uses:

- ClaimOS deterministic rules
- RPC
- The Graph
- official protocol metadata
- Alchemy Simulation

Possible result:

```text
VERIFIED
UNVERIFIED
HIGH_RISK
BLOCKED
```

CLI:

```bash
claimos campaign verify <campaign-id>
```

MCP Tool:

```text
verify_campaign(campaign_id)
```

---

## 6. Existing Claim Flow

The original ClaimOS flow remains intact.

### `scan_claims(wallet)`

Find rewards already claimable.

Sources:

- Merkl
- Claim Adapters
- The Graph context

---

### `prepare_claim(claim_id)`

Build the official transaction required to claim.

---

### `verify_claim(claim_id)`

Simulate and inspect the transaction using Alchemy.

Return:

- asset changes
- approvals
- gas
- destination contracts
- risk flags

---

### `execute_claim(claim_id)`

Send the transaction to the connected wallet flow.

Requires user approval.

---

# PART II — AGENTIC LAYER

## 7. Agent Responsibility

An agent is not required to operate ClaimOS.

When present, its responsibility is to run the discovery and investigation loop autonomously.

The agent should:

```text
SEARCH
  ↓
UNDERSTAND
  ↓
VERIFY
  ↓
CHECK ELIGIBILITY
  ↓
RANK
  ↓
RECOMMEND
  ↓
STOP
```

The agent must stop before committing funds or signing a transaction unless the user explicitly approves.

---

## 8. Bazantic Responsibility

Bazantic does **not** replace ClaimOS.

Bazantic provides the Recipe that tells an external agent:

- when to call ClaimOS
- in what order
- how to interpret results
- when to stop
- what information to remember
- when to notify the user

ClaimOS provides the tools.

Bazantic provides the workflow.

The external agent provides the autonomy.

---

## 9. ClaimOS Bazantic Recipe

Suggested Recipe:

```text
RECIPE: ClaimOS Autonomous Opportunity Discovery

GOAL

Continuously investigate legitimate onchain reward opportunities
for the user's wallet without exposing the user to suspicious
campaigns or requiring the user to manually browse claim links.

INPUT

- wallet_address
- supported_chains
- optional risk preferences

LOOP

1. Call search_campaigns()

2. Compare results with the agent's previously analyzed campaigns.

3. For new or changed campaigns:
   call get_campaign_requirements(campaign_id)

4. Call verify_campaign(campaign_id)

5. If:
      HIGH_RISK
      BLOCKED
      UNVERIFIED
   then:
      reject the opportunity
      record the result
      do not ask the user to visit the campaign

6. For VERIFIED campaigns:
   call check_wallet_eligibility(wallet_address, campaign_id)

7. Classify:

   ELIGIBLE
      → tell the user the wallet already qualifies

   ALMOST_ELIGIBLE
      → explain exactly what requirement is missing

   NOT_ELIGIBLE
      → remember result and do not bother the user

   UNKNOWN
      → mark for further investigation

8. Rank relevant opportunities using:
   - eligibility status
   - campaign deadline
   - security confidence
   - estimated capital required
   - known reward value when available

9. Notify the user only when:
   - a new eligible opportunity exists
   - a meaningful almost-eligible opportunity exists
   - eligibility changed
   - a campaign previously considered legitimate becomes risky

10. STOP before participation.

The user must decide whether to continue.

If the user approves participation:
   prepare transaction
   simulate transaction
   show expected asset changes
   request wallet approval
```

---

## 10. Agent Local State

ClaimOS does not need to own the agent's memory.

The agent may maintain its own local state:

```text
.claimos/
 ├── campaigns.json
 ├── requirements.json
 ├── eligibility.json
 ├── security-checks.json
 └── agent-state.json
```

or:

```text
.claimos/state.sqlite
```

This state belongs to the agent/runtime.

Never store:

- seed phrases
- raw private keys
- wallet secrets

This means ClaimOS can remain mostly stateless.

---

## 11. Architecture

```text
                         USER
                          │
                       Wallet
                          │
                          │
               ┌──────────┴──────────┐
               │                     │
               │                     │
        STANDALONE MODE          AGENTIC MODE
               │                     │
               ▼                     ▼
          ClaimOS CLI          External Agent
                               OpenClaw /
                               Claude /
                               Codex /
                               others
                                     │
                                     ▼
                              Bazantic Recipe
                                     │
                                     ▼
                               ClaimOS MCP
                                     │
               ┌─────────────────────┘
               │
               ▼
        ┌─────────────────────┐
        │    CLAIMOS CORE     │
        └─────────────────────┘
               │
     ┌─────────┼──────────┬────────────┐
     │         │          │            │
     ▼         ▼          ▼            ▼
 Campaign   The Graph    Merkl      Adapters
 Sources
     │         │          │            │
     └─────────┴──────────┴────────────┘
               │
               ▼
       CAMPAIGN INTELLIGENCE
               │
     ┌─────────┼──────────────┐
     │         │              │
     ▼         ▼              ▼
requirements eligibility  verification
     │         │              │
     └─────────┼──────────────┘
               ▼
        OPPORTUNITY RESULT
               │
               ▼
         USER DECISION
               │
          approve / reject
               │
       ┌───────┴────────┐
       │                │
     reject           approve
                        │
                        ▼
                 CLAIM / ACTION
                        │
                        ▼
                     ALCHEMY
                  simulation
                        │
                        ▼
                      PRIVY
                        │
                        ▼
                     LEDGER
                  human approval
                        │
                        ▼
                OFFICIAL CONTRACT
                        │
                        ▼
                   USER WALLET
```

---

## 12. Backend Structure

Hackathon architecture:

**modular monolith**

```text
/src
 ├── campaigns/
 │    ├── discovery/
 │    ├── requirements/
 │    ├── sources/
 │    └── types/
 │
 ├── eligibility/
 │
 ├── graph/
 │
 ├── merkl/
 │
 ├── adapters/
 │
 ├── claims/
 │
 ├── security/
 │
 ├── simulation/
 │
 ├── workflows/
 │
 ├── mcp/
 │
 ├── cli/
 │
 ├── wallet/
 │
 └── ledger/
```

Agent-specific orchestration should **not** be mixed into the deterministic core.

Bazantic Recipe configuration can live separately:

```text
/recipes
 └── autonomous-opportunity-discovery.md
```

---

## 13. API Surface

### Campaign discovery

```text
GET /api/campaigns
```

Equivalent:

```text
search_campaigns()
```

---

### Campaign requirements

```text
GET /api/campaigns/:id/requirements
```

Equivalent:

```text
get_campaign_requirements(campaign_id)
```

---

### Wallet eligibility

```text
POST /api/campaigns/:id/eligibility
```

Input:

```json
{
  "wallet": "0x..."
}
```

Equivalent:

```text
check_wallet_eligibility(wallet, campaign_id)
```

---

### Campaign verification

```text
POST /api/campaigns/:id/verify
```

Equivalent:

```text
verify_campaign(campaign_id)
```

---

### Existing claim APIs

```text
POST /api/scan

GET  /api/claims/:id

POST /api/claims/:id/prepare

POST /api/claims/:id/verify

POST /api/claims/:id/execute
```

---

## 14. Core Types

### Campaign

```ts
type Campaign = {
  id: string;
  protocol: string;
  chainId: number;
  source: string;
  sourceUrl?: string;
  startsAt?: string;
  endsAt?: string;
  status: "active" | "upcoming" | "ended";
};
```

### CampaignRequirement

```ts
type CampaignRequirement = {
  type:
    | "deposit"
    | "swap"
    | "hold"
    | "stake"
    | "provide_liquidity"
    | "claim"
    | "other";

  protocol?: string;
  chainId: number;
  asset?: string;
  minimumAmount?: string;
  minimumDuration?: number;
  contract?: string;
};
```

### EligibilityResult

```ts
type EligibilityResult = {
  campaignId: string;
  wallet: string;

  status:
    | "eligible"
    | "almost_eligible"
    | "not_eligible"
    | "unknown";

  completedRequirements: string[];
  missingRequirements: string[];
  evidence: unknown[];
};
```

### CampaignVerification

```ts
type CampaignVerification = {
  campaignId: string;

  status:
    | "verified"
    | "unverified"
    | "high_risk"
    | "blocked";

  evidence: unknown[];
  warnings: string[];
};
```

### Claimable

```ts
type Claimable = {
  protocol: string;
  chainId: number;
  token: string;
  amount: string;
  usdValue: number;
  source: string;

  status:
    | "confirmed"
    | "potential"
    | "claimed";

  claimTransaction?: unknown;
};
```

---

## 15. Security Boundary

The autonomous agent is allowed to:

```text
✓ search campaigns
✓ read public information
✓ inspect wallet history
✓ understand campaign requirements
✓ verify campaign legitimacy
✓ check eligibility
✓ rank opportunities
✓ notify the user
✓ prepare a proposed action
```

Without explicit user approval it must NOT:

```text
✗ sign transactions
✗ move funds
✗ approve tokens
✗ deposit assets
✗ interact with campaign contracts
✗ create additional wallets
✗ perform Sybil behavior
```

---

## 16. MVP Restrictions

To avoid scope creep:

- **EVM only**
- No Solana
- Merkl + a small number of real campaign/adapters
- The Graph is used for wallet/context evidence
- Alchemy is used for transaction simulation
- Privy / existing wallets for signing
- No custom transaction simulator
- No custom wallet implementation
- No Sybil farming
- No fake activity generation
- No prediction of secret future airdrop criteria
- No attempt to support every campaign platform
- No autonomous transaction execution before user approval
- No requirement for a central ClaimOS database
- Agent local state is acceptable for the hackathon
- Only confirmed claims count toward `$X found`

Allowed:

- discover active campaigns
- interpret known public requirements
- identify `eligible`
- identify `almost_eligible`
- explain missing requirements
- verify campaign legitimacy
- recommend participation
- prepare the action after user approval

---

## 17. MVP Demo

### Demo A — CLI only

Proves ClaimOS works independently of AI.

```text
claimos campaigns search
        ↓
campaigns found
        ↓
claimos campaigns requirements
        ↓
claimos eligibility check
        ↓
claimos campaign verify
        ↓
result
```

Example:

```text
Campaign: Morpho USDC Rewards

Security      VERIFIED
Eligibility   ALMOST_ELIGIBLE

Missing:
Deposit 100 USDC on Base
```

---

### Demo B — Autonomous Agent

Proves the agentic layer.

```text
Agent starts
   ↓
loads previous local state
   ↓
search_campaigns()
   ↓
finds new campaign
   ↓
get_campaign_requirements()
   ↓
verify_campaign()
   ↓
check_wallet_eligibility()
   ↓
ALMOST_ELIGIBLE
   ↓
agent notifies user
```

Agent:

```text
I found a new verified campaign.

Protocol: Morpho
Network: Base
Status: Almost eligible

You already satisfy 2/3 requirements.

Missing:
Deposit at least 100 USDC.

The campaign source and contracts passed ClaimOS verification.

Would you like me to prepare the participation transaction?
```

### Critical demo moment

The autonomous loop ends here.

```text
             AUTONOMOUS
                 ↓
Discover → Verify → Eligibility → Recommend
                                   ↓
                            USER DECISION
                                   ↓
                              HUMAN-IN-LOOP
                                   ↓
                       Prepare → Simulate → Sign
```

That separation is intentional.

---

# 18. Product Architecture Summary

ClaimOS should not require an AI agent.

```text
ClaimOS CLI / API
       =
deterministic crypto intelligence
```

ClaimOS should also be consumable by any agent:

```text
Agent
  +
Bazantic Recipe
  +
ClaimOS MCP
       =
autonomous opportunity discovery
```

The value of the agentic layer is not that the model knows more crypto.

The value is that it can continuously:

```text
discover
understand
verify
check
remember
re-evaluate
notify
```

while ClaimOS provides the deterministic crypto tools and security boundaries necessary to make that autonomy safe.

**ClaimOS becomes the crypto opportunity and safety layer that an autonomous agent can trust.**
