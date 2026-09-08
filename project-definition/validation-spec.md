# ClaimOS — Validation Technical Plan

## 1. Goal

Validate the ClaimOS backend end-to-end before expanding product scope.

The validation must prove:

1. **Discovery works** — ClaimOS can read real onchain activity for a wallet.
2. **Eligibility / rewards work** — ClaimOS can detect a real claimable reward from a third-party source.
3. **Controlled execution works** — ClaimOS can test a safe and unsafe interaction in an isolated EVM environment.
4. **Risk detection works** — ClaimOS can identify dangerous approvals / unexpected outflows before exposing a real user wallet.
5. **Execution is reproducible** — the same transaction behaves as expected in Sepolia and in the local fork.

No real user funds may be used.

Core validation flow:

```text
REAL READ-ONLY DATA

Wallet
  ├── The Graph ──> wallet activity
  └── Merkl ──────> real reward / eligibility
                         │
                         ▼
                    ClaimOS normalize
                         │
                         ▼
CONTROLLED SECURITY TESTS
                         │
                Sepolia SafeClaim / UnsafeClaim
                         │
                         ▼
                    ALCHEMY RPC
                    source network
                         │
                         ▼
                       ANVIL
                 local EVM fork / sandbox
                         │
                         ▼
              execute + inspect behavior
                         │
                         ▼
                  ClaimOS risk result
                         │
                         ▼
               compare with Sepolia run
                         │
                         ▼
                 validation-report.json
```

---

## 2. Source of Truth

Before implementation, read:

- `project-definition/Product Brief.md`
- `project-definition/Technical Architecture Document.md`

These files define product scope and architecture.

Do not invent new product behavior, screens, or unsupported integrations while implementing this validation plan.

---

## 3. Simulation Architecture

The hackathon backend uses Alchemy RPC and Anvil for controlled validation. Do not add another hosted simulation vendor to this MVP.

### Simulation / sandbox stack

```text
Alchemy RPC
   ↓
Anvil
   ↓
Local fork / controlled execution
```

- **Alchemy** provides the RPC connection to Sepolia / EVM network state.
- **Anvil** provides the local disposable EVM environment where ClaimOS can fork state, impersonate addresses, execute transactions, inspect balances/allowances/events, and reset state.

### Provider abstraction

Use:

```ts
export interface ExecutionSandbox {
  start(): Promise<void>;
  reset(): Promise<void>;
  impersonate(address: `0x${string}`): Promise<void>;
  execute(tx: TransactionRequest): Promise<ExecutionResult>;
  getBalance(address: `0x${string}`, token?: `0x${string}`): Promise<bigint>;
  getAllowance?(
    token: `0x${string}`,
    owner: `0x${string}`,
    spender: `0x${string}`
  ): Promise<bigint>;
}
```

Initial implementation:

```text
AnvilForkSandbox
```

Keep vendor-specific behavior isolated behind the RPC and sandbox adapters defined in this plan.

---

## 4. Third Parties to Validate

| Provider | Role | Validation goal |
|---|---|---|
| **The Graph** | Wallet activity / context | Query real indexed activity and normalize it |
| **Merkl** | Real reward / eligibility source | Query a real wallet and calculate claimable amount |
| **Claim Adapters** | Claims outside Merkl | Produce normalized claim data and transaction requests |
| **Alchemy** | RPC provider | Provide Sepolia RPC access and fork source |
| **Anvil** | Controlled execution environment | Fork network state and execute safe/unsafe interactions locally |
| **Bazantic** | Workflow orchestration | Orchestrate existing ClaimOS tools after core validation passes |
| **Privy** | Wallet UX / signing | Connect real user wallet only after analysis |
| **Ledger** | Human-in-the-loop | Final human approval / rejection |

---

## 5. Required Fixtures

### Fixture A — Real Merkl wallet

Purpose:

Validate real discovery and eligibility using real third-party data without moving mainnet funds.

Environment:

```bash
# Optional overrides; the validator discovers a live fixture automatically when omitted.
MERKL_FIXTURE_ADDRESS=
MERKL_FIXTURE_CHAIN_IDS=
```

Requirements:

- public EVM wallet;
- at least one real Merkl reward;
- read-only;
- never execute the real mainnet claim.

Merkl endpoint:

```text
GET https://api.merkl.xyz/v4/users/{address}/rewards?chainId={chain_ids}
```

Validate:

```text
amount
claimed
pending
proofs
campaign metadata
```

Calculate:

```text
claimable = amount - claimed
```

Pass:

```text
at least one normalized Claimable with claimable > 0
```

Failure:

```text
MERKL_FIXTURE_EMPTY
```

Never fake a positive Merkl result.

---

### Fixture B — SafeClaim.sol on Sepolia

Deploy:

- `MockRewardToken.sol`
- `SafeClaim.sol`

Behavior:

```text
burner wallet
    │
    │ claim()
    ▼
SafeClaim
    │
    ▼
+100 TEST_REWARD
```

Rules:

- no approval required;
- no `transferFrom` against user assets;
- no unexpected ETH/token outflow;
- only gas leaves the burner;
- claim once per wallet.

Expected ClaimOS classification:

```text
SAFE
```

---

### Fixture C — UnsafeClaim.sol on Sepolia

Purpose:

Model a controlled drainer-style flow using test assets only.

Deploy:

- `MockVictimToken.sol`
- `MockRewardToken.sol`
- `UnsafeClaim.sol`

Fund burner:

```text
1000 TEST_USDC
```

Unsafe sequence:

```text
TX 1:
TEST_USDC.approve(UnsafeClaim, MAX_UINT256)

TX 2:
UnsafeClaim.claim()
```

`UnsafeClaim.claim()` should:

1. send a tiny fake reward;
2. use the existing approval;
3. call `transferFrom()` on the burner;
4. move only test tokens to `TEST_SINK_ADDRESS`.

Expected classification:

```text
HIGH_RISK
```

Expected evidence:

```text
UNLIMITED_TOKEN_APPROVAL
UNEXPECTED_ASSET_OUTFLOW
CLAIM_CAUSES_USER_ASSET_TRANSFER
```

Never use real assets with this fixture.

---

## 6. Validation Architecture

```text
                       bun run validate:e2e
                                │
                                ▼
                    ┌────────────────────┐
                    │ Validation Runner  │
                    └─────────┬──────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
    THE GRAPH              MERKL             SEPOLIA
    real wallet          real rewards      test contracts
          │                   │                   │
          └────────────┬──────┘                   │
                       ▼                          │
                 CLAIM ENGINE                    │
                  normalize                      │
                       │                          │
                       └──────────────┬───────────┘
                                      ▼
                                 ALCHEMY RPC
                                      │
                                      ▼
                                     ANVIL
                               fork / sandbox
                                      │
                           ┌──────────┴──────────┐
                           ▼                     ▼
                      Safe execution       Unsafe execution
                           │                     │
                           └──────────┬──────────┘
                                      ▼
                                 Risk Parser
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                       SAFE                    HIGH_RISK
                                      │
                                      ▼
                            Compare with Sepolia
                                      │
                                      ▼
                         validation-report.json
```

---

## 7. Required Code Structure

```text
/scripts/validation
  ├── 00-check-env.ts
  ├── 01-test-graph.ts
  ├── 02-test-merkl.ts
  ├── 03-deploy-sepolia-fixtures.ts
  ├── 04-start-anvil-fork.ts
  ├── 05-test-safe-on-anvil.ts
  ├── 06-test-unsafe-on-anvil.ts
  ├── 07-execute-safe-sepolia.ts
  ├── 08-execute-unsafe-sepolia.ts
  ├── 09-compare-results.ts
  └── validate-e2e.ts
```

Contracts:

```text
/contracts/validation
  ├── MockRewardToken.sol
  ├── MockVictimToken.sol
  ├── SafeClaim.sol
  └── UnsafeClaim.sol
```

Providers:

```text
/src/providers
  ├── graph/
  ├── merkl/
  └── sandbox/
       ├── ExecutionSandbox.ts
       └── AnvilForkSandbox.ts
```

---

## 8. Environment Variables

Required:

```bash
ALCHEMY_SEPOLIA_RPC_URL=
ANVIL_RPC_URL=http://127.0.0.1:8545

SEPOLIA_BURNER_PRIVATE_KEY=

THE_GRAPH_API_KEY=
THE_GRAPH_SUBGRAPH_IDS=

MERKL_FIXTURE_ADDRESS=
MERKL_FIXTURE_CHAIN_IDS=
# The validator searches campaigns/recipients read-only when these are empty.
```

Optional:

```bash
BAZANTIC_API_KEY=
PRIVY_APP_ID=
PRIVY_APP_SECRET=
```

Keep `.env.example` limited to the Alchemy RPC and Anvil configuration defined above.

Rules:

- never commit private keys;
- burner key must only be used for Sepolia;
- never use a mainnet user private key;
- never ask users for seed phrases.

---

## 9. Anvil Setup

Start fork:

```bash
anvil --fork-url $ALCHEMY_SEPOLIA_RPC_URL
```

Expected local RPC:

```text
http://127.0.0.1:8545
```

ClaimOS tests may use Anvil to:

- impersonate addresses;
- set ETH balance;
- snapshot state;
- revert state;
- execute multiple dependent transactions;
- inspect allowances / balances.

Lifecycle:

```text
start fork
   ↓
snapshot
   ↓
execute test
   ↓
inspect results
   ↓
revert
   ↓
next test
```

Do not persist unsafe state between fixtures.

---

## 10. Validation Sequence

### Step 1 — The Graph

Validate:

- live query works;
- wallet activity exists;
- normalization works.

Output:

```text
artifacts/validation/graph.json
```

### Step 2 — Merkl

Validate:

```text
amount
claimed
pending
proofs
```

Expected:

```text
>= 1 confirmed claimable reward
```

Outputs:

```text
artifacts/validation/merkl.json
artifacts/validation/merkl-normalized.json
```

### Step 3 — Deploy Sepolia fixtures

Deploy:

```text
MockRewardToken
MockVictimToken
SafeClaim
UnsafeClaim
```

Fund:

```text
SafeClaim     → TEST_REWARD
UnsafeClaim   → TEST_REWARD
Burner wallet → 1000 TEST_USDC
```

Output:

```text
artifacts/validation/sepolia-deployment.json
```

### Step 4 — Start Anvil fork

```bash
anvil --fork-url $ALCHEMY_SEPOLIA_RPC_URL
```

Output:

```text
artifacts/validation/anvil-session.json
```

### Step 5 — Safe test on Anvil

Execute:

```text
burner -> SafeClaim.claim()
```

Expected:

```text
+100 TEST_REWARD
no dangerous approval
no unexpected asset outflow
classification = SAFE
```

Output:

```text
artifacts/validation/safe-anvil.json
```

### Step 6 — Unsafe test on Anvil

Run:

```text
approve MAX_UINT256
        ↓
UnsafeClaim.claim()
```

Expected:

```text
unlimited approval
+
user asset outflow
+
small fake reward
classification = HIGH_RISK
```

Output:

```text
artifacts/validation/unsafe-anvil.json
```

### Step 7 — Execute Safe fixture on Sepolia

Expected:

```text
+100 TEST_REWARD
```

Output:

```text
artifacts/validation/safe-sepolia.json
```

### Step 8 — Execute Unsafe fixture on Sepolia

Expected:

```text
burner loses TEST_USDC
sink receives TEST_USDC
burner receives small TEST_REWARD
```

Output:

```text
artifacts/validation/unsafe-sepolia.json
```

### Step 9 — Compare Anvil vs Sepolia

Compare:

```text
success / revert
asset changes
allowance changes
event behavior
risk classification
```

Expected:

```json
{
  "safe": {
    "forkMatchedSepolia": true,
    "classificationCorrect": true
  },
  "unsafe": {
    "forkMatchedSepolia": true,
    "classificationCorrect": true
  }
}
```

Output:

```text
artifacts/validation/comparison.json
```

---

## 11. Bazantic Validation

Only after core validation passes.

Recipe:

```text
validateClaim
    ↓
get wallet context
    ↓
get eligibility / claim data
    ↓
prepare transaction
    ↓
run Anvil sandbox
    ↓
classify behavior
    ↓
return structured evidence
```

Bazantic orchestrates existing ClaimOS capabilities. Do not duplicate business logic inside Bazantic.

---

## 12. Privy Validation

Manual integration test:

```text
open ClaimOS
    ↓
paste wallet
    ↓
scan without connecting
    ↓
select verified claim
    ↓
only now connect wallet
    ↓
sign / reject
```

Pass:

- discovery does not require connection;
- user can reject;
- transaction shown to wallet matches the tested transaction.

---

## 13. Ledger Validation

Manual human-in-the-loop test.

Safe:

```text
ClaimOS = SAFE
↓
Ledger review
↓
human approves
```

Unsafe:

```text
ClaimOS = HIGH_RISK
↓
warning
↓
human rejects
```

A real-wallet action must never bypass human approval.

---

## 14. Master Command

Add:

```json
{
  "scripts": {
    "validate:e2e": "bun run scripts/validation/validate-e2e.ts"
  }
}
```

Run:

```bash
bun run validate:e2e
```

---

## 15. Required Artifacts

```text
artifacts/validation/
  ├── graph.json
  ├── merkl.json
  ├── merkl-normalized.json
  ├── sepolia-deployment.json
  ├── anvil-session.json
  ├── safe-anvil.json
  ├── unsafe-anvil.json
  ├── safe-sepolia.json
  ├── unsafe-sepolia.json
  ├── comparison.json
  └── validation-report.json
```

---

## 16. Final Validation Report

Example:

```json
{
  "environment": {
    "sandbox": "anvil",
    "sourceRpc": "alchemy",
    "executionNetwork": "sepolia"
  },
  "providers": {
    "theGraph": "PASS",
    "merkl": "PASS",
    "alchemyRpc": "PASS",
    "anvil": "PASS",
    "bazantic": "SKIPPED"
  },
  "fixtures": {
    "safeClaim": {
      "sandbox": "PASS",
      "sepolia": "PASS",
      "classification": "SAFE",
      "forkMatchedSepolia": true
    },
    "unsafeClaim": {
      "sandbox": "PASS",
      "sepolia": "PASS",
      "classification": "HIGH_RISK",
      "forkMatchedSepolia": true
    }
  },
  "overall": "PASS"
}
```

---

## 17. Failure Rules

Use explicit error codes:

```text
MERKL_FIXTURE_EMPTY
GRAPH_QUERY_FAILED
ALCHEMY_RPC_FAILED
ANVIL_START_FAILED
ANVIL_FORK_FAILED
SEPOLIA_INSUFFICIENT_TEST_ETH
SAFE_FIXTURE_CLASSIFIED_RISKY
UNSAFE_FIXTURE_NOT_DETECTED
FORK_SEPOLIA_MISMATCH
```

Never replace failed live calls with mocked success.

---

## 18. Restrictions — Do Not Expand Scope

### Do

- EVM only.
- Sepolia for controlled execution.
- Alchemy RPC as network source.
- Anvil as the local sandbox/fork engine.
- Real read-only Merkl/The Graph data.
- Test tokens only for unsafe flows.

### Do not

- Add another hosted simulation provider.
- Add credentials for another simulation vendor.
- Add Solana.
- Predict future airdrops.
- Build an airdrop farming engine.
- Build a new threat-intelligence engine.
- Build our own EVM fork implementation.
- Attempt universal claim support.
- Execute real user claims during automated validation.
- Use mainnet private keys.
- Treat AI output as deterministic proof of safety.
- Change Product Brief or UI while implementing validation.

---

## 19. Implementation Priority

```text
1. Align environment, configuration, and runtime with Bun + Alchemy RPC + Anvil
2. Environment validator
3. Merkl real fixture
4. The Graph real fixture
5. Sepolia fixture contracts
6. Alchemy RPC validation
7. AnvilForkSandbox
8. Safe Anvil execution
9. Unsafe Anvil execution
10. Safe Sepolia execution
11. Unsafe Sepolia execution
12. Fork vs Sepolia comparison
13. validation-report.json
14. Bazantic recipe
15. Privy manual test
16. Ledger manual test
```

Do not start Bazantic, Privy, or Ledger validation until the core backend validation passes.

---

## 20. Definition of Done

The core validation is done when:

```bash
bun run validate:e2e
```

demonstrates:

```text
real wallet activity
        +
real Merkl eligibility
        +
Alchemy-backed network state
        +
Anvil controlled execution
        +
safe claim
        +
unsafe claim
        +
real Sepolia comparison
        ↓
ClaimOS correctly distinguishes
SAFE from HIGH_RISK
```

Only after this passes should protocol coverage or UI expand.
