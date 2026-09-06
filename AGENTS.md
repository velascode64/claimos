# AGENTS.md

## 1. Project Goal

This repository is being built for an **ETHOnline hackathon MVP**.

The goal is to build an EVM product that lets a user:

1. Enter a wallet address / ENS.
2. Discover real claimable rewards / airdrops across supported sources.
3. Verify eligibility.
4. Prepare the official claim transaction.
5. Run a security analysis before signing.
6. Let the user approve and execute the claim.

Core product flow:

**Discover → Confirm → Verify → Approve → Claim**

This is a hackathon MVP. Optimize for a working end-to-end demo, not for broad protocol coverage or production-scale infrastructure.

### Bounties we are pursuing

#### 1. The Graph — Standardized / Composable Graph Products
**Why:** The Graph is the main discovery layer for understanding what a wallet has done onchain across protocols.

Use it to:
- reconstruct wallet activity;
- identify relevant protocols / interactions;
- use reusable or standardized query patterns where possible.

The Graph must be a meaningful, load-bearing part of the product, not a decorative integration.

#### 2. Privy — Best Financial Flow
**Why:** Privy supports the wallet / transaction UX after value has been discovered.

Use it to:
- connect the user's wallet;
- manage the financial-flow UX;
- reduce unnecessary Web3 friction around signing / execution.

Do not require wallet connection for the initial discovery scan unless technically necessary.

#### 3. Ledger — AI Agents × Ledger
**Why:** Ledger provides the human-in-the-loop approval layer for an irreversible financial action.

Use it so that:
- the system can discover, prepare, and verify a claim;
- the human still reviews and approves the final action.

Principle:

**Machine prepares. Human approves.**

#### 4. Bazantic — Sponsor APIs Recipe / Workflow
**Why:** The product depends on multiple APIs and services that must operate as one workflow.

Use Bazantic to orchestrate the relevant sequence across services such as:
- The Graph;
- Merkl / claim adapters;
- Alchemy Simulation API;
- claim preparation / verification.

Bazantic should help turn fragmented integrations into a clear reusable workflow.

---

## 2. Project Definition Is the Source of Truth

Before implementing or modifying product behavior, read:

- `project-definition/Product Brief.md`
- `project-definition/Technical Architecture Document.md`

These documents define:
- the user problem;
- product value proposition;
- MVP scope;
- screen-by-screen flow;
- backend architecture;
- technical constraints;
- technologies selected for the hackathon.

Treat these documents as the source of truth.

### Important

Do **not** invent:
- new product flows;
- new screens;
- new features;
- new claims about eligibility;
- additional scope;
- alternative architecture;

unless the existing project definition explicitly requires it or the user asks for a change.

If implementation details are ambiguous, prefer the smallest interpretation that preserves the documented MVP.

---

## 3. Frontend Rules — CRITICAL

The frontend project has already been downloaded, configured, and is working.

**Do not redesign it.**

The existing frontend is intentionally being used to save hackathon time and already contains the visual language we want.

### Before creating any UI

Always inspect the existing codebase first for:
- components;
- layouts;
- cards;
- buttons;
- navigation;
- inputs;
- modals / sheets;
- typography;
- spacing;
- icons;
- loading states;
- empty states;
- success states;
- animations;
- color tokens;
- theme variables.

### Reuse before creating

If an existing component can represent the required screen or interaction, **reuse it**.

Do not create a new visual component just because it is faster to write from scratch.

Prefer, in order:

1. Existing component with no changes.
2. Existing component with small prop / content changes.
3. Composition of existing components.
4. A new component only when the required UI genuinely does not exist in the project.

### Preserve the existing design system

Do not invent:
- new colors;
- new gradients;
- new typography;
- new spacing systems;
- new button styles;
- new card styles;
- new shadows;
- new visual patterns.

Use the existing:
- theme;
- color palette;
- typography;
- spacing;
- component styling;
- responsive behavior.

The goal is for every new screen to look like it was part of the original frontend project.

### Screen behavior

Follow the screen definitions in:

`project-definition/Product Brief.md`

Implement those screens and flows as written.

Do not add extra screens or reinterpret the UX unless required by the existing frontend structure or explicitly requested.

When mapping the Product Brief to the existing frontend:

- adapt the existing components to the documented screen purpose;
- preserve existing visual hierarchy;
- preserve mobile / responsive behavior already present;
- avoid moving or restructuring large parts of the UI unnecessarily.

Think like a frontend engineer integrating product requirements into an existing design system, **not like a designer inventing a new interface**.

---

## 4. MVP Technical Constraints

Keep the implementation constrained to the documented hackathon scope.

### Do

- EVM only.
- Use The Graph for wallet activity / context.
- Use Merkl and a small number of deterministic claim adapters for real claimable rewards.
- Use Alchemy (Simulation API / Asset Changes) for transaction simulation and security analysis.
- Use Bazantic for workflow orchestration where useful for the bounty.
- Use Privy for wallet / transaction UX.
- Use Ledger for human approval where applicable.
- Keep the backend modular but simple.
- Prefer a working end-to-end flow over broad protocol support.
- Only include **confirmed** claimable value in the total amount shown to the user.

### Do not

- Add Solana.
- Build a new wallet.
- Build a new scam-detection engine.
- Build a new transaction simulator.
- Attempt to support every airdrop or protocol.
- Predict future airdrops.
- Build a farming / points optimization product.
- Build portfolio management.
- Add swaps / cash-out unless the core MVP is already complete.
- Add unrelated sponsor integrations simply to chase prizes.
- Let AI be the final authority on transaction safety.

---

## 5. Implementation Principle

The MVP should prove one thing clearly:

```text
1 wallet
   ↓
multiple reward sources
   ↓
real confirmed claims
   ↓
security check
   ↓
human approval
   ↓
1 successful claim
```

When choosing between a larger feature and a simpler working path, choose the path that strengthens this demo.

The product should feel like one coherent consumer flow even though the backend uses multiple providers.

**Do not expand scope unless it directly improves this core journey.**
