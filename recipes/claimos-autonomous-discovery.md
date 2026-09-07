# ClaimOS Autonomous Opportunity Discovery

Use this recipe with Bazantic or any MCP-compatible agent. ClaimOS remains the deterministic source of truth; the agent orchestrates calls and stops before signing.

## Tools

1. `search_campaigns()` — discover active campaigns from official sources.
2. `get_campaign_requirements(campaign_id)` — normalize requirements into structured rules.
3. `verify_campaign(campaign_id)` — reject unverified or high-risk campaigns.
4. `check_wallet_eligibility(wallet, campaign_id)` — compare wallet activity with requirements.
5. `scan_claims(wallet)` — find already claimable rewards.
6. `prepare_claim(claim_id)` — build official calldata.
7. `verify_claim(claim_id)` — simulate and inspect asset changes.

## Policy

- Discovery, requirements, verification and eligibility may run autonomously.
- Never request a signature for a campaign with `HIGH_RISK`, `BLOCKED`, or `UNVERIFIED`.
- Stop at `RECOMMEND` and notify the user with campaign, requirements, risks and expected value.
- Only after explicit user approval may ClaimOS prepare and present a transaction.
- ClaimOS/Privy/Ledger must obtain the final human approval; the agent never signs.
- Never store private keys or seed phrases.

## Loop

```text
SEARCH → UNDERSTAND → VERIFY → CHECK ELIGIBILITY → RANK → RECOMMEND → STOP
```

## Output contract

Return structured JSON with `campaign`, `requirements`, `security`, `eligibility`, `recommendation` and `nextAction`. `nextAction` must be `WAIT_FOR_USER` before participation.
