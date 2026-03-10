# starkclaw-carry

Production-grade carry bot scaffold for Starknet, built test-first.

## PR1 Delivered

- Strict TypeScript runtime scaffold
- Typed environment parsing with hard validation (`zod`)
- Secret-safe env debug snapshots (redacted)
- Structured logger (`pino`) with production-friendly redaction rules
- Append-only NDJSON journal with schema validation and runId safety checks
- TDD baseline with coverage (`vitest`)

## PR2 Delivered (merged into same PR branch)

- Extended venue client (read-only) with robust request logging:
  - market snapshot (`/info/markets`)
  - funding history (`/info/{market}/funding`)
  - effective fee tier (`/user/fees`)
- Normalized typed outputs for market/funding/fees
- Deterministic hedge reconciler skeleton with explicit actions:
  - `HOLD`
  - `REBALANCE_INCREASE_PERP_SHORT`
  - `REBALANCE_DECREASE_PERP_SHORT`
  - `EXIT_ALL`
- Expanded env model for Extended runtime fields:
  - base URLs, API prefix, WS endpoints, client id, rate/heartbeat defaults
- Additional tests for Extended client behavior and reconciler logic

## Stack

- Node.js 22+
- TypeScript (strict mode)
- Vitest + coverage
- Zod
- Pino

## Quick Start

```bash
npm install
cp .env.example .env
npm test
```

## Scripts

```bash
npm test         # test + coverage
npm run typecheck
npm run lint
npm run format
```

## Config

Environment is validated by [`/Users/espejelomar/StarkNet/starkclaw-carry/src/config/env.ts`](/Users/espejelomar/StarkNet/starkclaw-carry/src/config/env.ts). Invalid config fails fast with explicit field-level errors.

Key required vars:

- `STARKNET_RPC_URL`
- `STARKNET_ACCOUNT_ADDRESS`
- `STARKNET_PRIVATE_KEY`

Important defaults:

- `RUN_MODE=paper`
- `MARKET=ETH-USD`
- `MAX_NOTIONAL_USD=1000`
- `LOOP_INTERVAL_MS=5000`
- `JOURNAL_DIR=./artifacts/journal`

## Journal

Journal schema lives in [`/Users/espejelomar/StarkNet/starkclaw-carry/src/journal/schema.ts`](/Users/espejelomar/StarkNet/starkclaw-carry/src/journal/schema.ts), and file writer in [`/Users/espejelomar/StarkNet/starkclaw-carry/src/journal/file-journal.ts`](/Users/espejelomar/StarkNet/starkclaw-carry/src/journal/file-journal.ts).

- Format: NDJSON (`events.ndjson`)
- Path: `<JOURNAL_DIR>/<runId>/events.ndjson`
- Guarantees in PR1:
  - schema-validated writes
  - append-only writes
  - runId mismatch rejection
  - sync-on-write mode enabled by default for safer crash behavior

## Debugging

PR1 intentionally emits detailed debug logs across:

- env loading/parsing
- journal init/write/close
- validation failures and rejection reasons

This is deliberate for early-stage strategy debugging and incident replay.
