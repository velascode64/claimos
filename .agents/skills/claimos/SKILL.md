---
name: claimos
description: Operate and extend ClaimOS EVM reward discovery and claim verification across Merkl and Galxe. Use for campaign discovery, eligibility, claim preparation, simulation, security classification, and the local E2E flow.
---

# ClaimOS Agent Skill

ClaimOS is an EVM reward-safety layer. The deterministic backend is the source of truth; an agent may investigate and recommend, but must stop before signing or executing a user-funded transaction.

## Local commands

Run from the repository root with Bun:

```bash
claimos --help
claimos --json campaigns search
claimos --json campaigns requirements <campaign-id>
claimos --json campaigns verify <campaign-id>
claimos --json eligibility <wallet> <campaign-id>
# Fallback when the local bin is not linked:
bun run campaigns --json campaigns search
bun run validate:e2e
```

Use `--json` when consuming output programmatically. Treat non-zero exit codes as failures, not as empty results.

## Autonomous discovery loop

1. Search campaigns from official sources (Merkl V4 and Galxe GraphQL; add adapters only for trusted sources).
2. Normalize requirements into structured rules.
3. Verify campaign source, chain, contracts and risk.
4. Check wallet eligibility with deterministic evidence from Merkl, The Graph or RPC.
5. Rank only verified, relevant opportunities.
6. Recommend with requirements, evidence, value and risks.
7. Stop and wait for explicit user approval.

Never sign, send, approve, or claim on behalf of a user. Never request a private key. A `HIGH_RISK`, `BLOCKED`, `UNVERIFIED`, or `UNKNOWN` result must not be presented as safe.

## Galxe rules

Galxe is a discovery and credential source, not an automatic execution target. Use its public GraphQL endpoint read-only to list active/trending campaigns and normalize them as `source: "galxe"`. Treat social, Discord, quiz, form and on-chain credentials as requirements to explain, not tasks to automate. Do not perform SIWE login, follow, like, join or claim actions without an explicit, separate user request and an approval-safe implementation.

## Merkl rules

The authoritative eligibility query is:

```text
GET https://api.merkl.xyz/v4/users/{address}/rewards?chainId={chainId}
```

A reward is claimable only when:

```ts
BigInt(reward.amount) > BigInt(reward.claimed)
&& Array.isArray(reward.proofs)
&& reward.proofs.length > 0
```

Do not count `pending`, participation, or `amount > 0` as eligibility. Preserve chain ID, campaign ID, token, amounts, proofs and API evidence.

## Claim safety

Before approval, run `prepare` then `verify`. Inspect recipient, calldata, approvals, asset changes, value and gas. Unlimited approvals, unexpected token outflows, or a reward used as a lure are high risk. The unsafe/drainer scenario is only for the local Anvil fixture and must never target a real wallet or asset.

## Reporting

Explain each operation as one of `[QUERY]`, `[RPC]`, `[SIM]`, or `[TX]`. Distinguish read-only calls and simulations from real blockchain writes. Include complete transaction hashes, chain, block, gas and explorer links when available.

For every The Graph operation, print a concise trace that a human can follow:

```text
[QUERY] The Graph
  endpoint: gateway.thegraph.com/.../<deployment>
  operation: wallet activity / indexed metadata
  networks: mainnet, base, arbitrum-one, optimism
  result: <count> records, indexed block <number>
```

Never describe The Graph, Merkl or Galxe reads as transactions. State whether the operation is `off-chain indexed read`, `read-only RPC`, `simulation`, or `real on-chain transaction`. If a provider is unavailable, print the provider, endpoint class and failure reason; do not silently continue with fabricated data.

Read the project definition before changing behavior:

- `project-definition/Product Brief.md`
- `project-definition/Technical Architecture Document.md`
- `project-definition/validation-spec.md` for E2E validation only.
