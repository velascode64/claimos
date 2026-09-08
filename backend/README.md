# Claimos backend

The backend exposes the MVP journey as both a terminal flow and HTTP endpoints. It never signs or broadcasts a transaction: the final step remains a human approval through Privy/Ledger.

## Terminal flow

```bash
bun run flow:demo
bun run flow:live --wallet 0xYourAddress
bun run flow:live --wallet 0xYourAddress --json
```

`flow:demo` is deterministic and needs no credentials. `flow:live` queries The Graph Token API and Merkl, prepares a confirmed Merkl claim, and asks Alchemy to simulate its asset changes.

## HTTP API

Start the app with `bun run dev`, then use:

```text
GET  /api/health
POST /api/scan
GET  /api/claims/:id
POST /api/claims/:id/prepare
POST /api/claims/:id/verify
POST /api/claims/:id/execute
```

Example scan body:

```json
{ "wallet": "0x4F2BF7469Bc38d1aE779b1F4affC588f35E60973", "mode": "demo" }
```

The `prepare` and `verify` bodies accept `{ "mode": "demo" }` or `{ "mode": "live" }`. `execute` returns an `awaiting_human_approval` response and the verified transaction; it does not sign or broadcast it.

## Safety boundary

Only rewards with an onchain amount greater than the already claimed amount and a Merkl proof become `confirmed`. Pending rewards are shown separately and never counted as claimable. A prepared transaction must pass Alchemy simulation before it can be presented for approval.

Bazantic credentials are already part of project configuration, but no endpoint or workflow recipe is documented in this repository. The integration is intentionally not fabricated; it will be added when the recipe URL/ID is available.
