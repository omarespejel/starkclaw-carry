export { createLogger, rootLogger } from "./logging/logger.js";
export { parseEnv, redactSecrets, type AppConfig } from "./config/env.js";
export {
  JournalEventSchema,
  JournalLevelSchema,
  validateJournalEvent,
  type JournalEvent,
} from "./journal/schema.js";
export {
  createFileJournal,
  type CreateFileJournalOptions,
  type FileJournal,
} from "./journal/file-journal.js";
export { createExtendedClient, type ExtendedClient } from "./venues/extended/client.js";
export type {
  ExtendedFundingPoint,
  ExtendedMarketSnapshot,
  ExtendedTradingConfig,
  ExtendedUserFees,
} from "./venues/extended/types.js";
export {
  evaluateHedgeReconciliation,
  type HedgeReconciliationAction,
  type HedgeReconciliationDecision,
  type HedgeReconciliationInput,
} from "./strategy/reconciler.js";
export {
  estimateCarryEdge,
  type CarryCostInput,
  type CarryEdgeEstimate,
} from "./strategy/cost-model.js";
export {
  evaluateCarryDecision,
  type CarryAction,
  type CarryDecision,
  type CarryDecisionInput,
  type CarryReasonCode,
  type FundingRegimeMetrics,
} from "./strategy/decision-engine.js";
export {
  evaluateLeggingGuard,
  type LeggingAction,
  type LeggingGuardDecision,
  type LeggingGuardInput,
  type LeggingIncidentType,
} from "./strategy/legging-guard.js";
export {
  createStarknetAgenticCarryAdapter,
  type StarknetAgenticCarryAdapter,
  type StarknetAgenticToolDefinition,
} from "./integrations/starknet-agentic/tools.js";
