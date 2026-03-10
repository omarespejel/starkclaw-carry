import { createLogger } from "../logging/logger.js";

export type LeggingIncidentType =
  | "legging_timeout"
  | "partial_fill_unhedged"
  | "stale_data"
  | "venue_error"
  | "policy_denial";

export type LeggingAction =
  | "WAIT"
  | "SUCCESS_HEDGED"
  | "NEUTRALIZE_SPOT"
  | "CANCEL_PERP_AND_FLATTEN"
  | "FORCE_EXIT_ALL";

export type LeggingGuardInput = {
  nowMs: number;
  firstLegSide: "SPOT" | "PERP" | null;
  firstLegFilledAtMs?: number;
  secondLegStatus: "PENDING" | "FILLED" | "FAILED" | "PARTIAL";
  unhedgedNotionalUsd: number;
  maxUnhedgedDurationMs: number;
  maxPartialFillDurationMs: number;
  maxUnhedgedNotionalUsd: number;
};

export type LeggingGuardDecision = {
  action: LeggingAction;
  reason: string;
  elapsedMs: number;
  incidentType?: LeggingIncidentType;
};

const leggingLogger = createLogger({ component: "legging_guard" });

function elapsed(nowMs: number, firstLegFilledAtMs?: number): number {
  if (firstLegFilledAtMs === undefined) {
    return 0;
  }
  return Math.max(0, nowMs - firstLegFilledAtMs);
}

function sideDependentRecovery(firstLegSide: "SPOT" | "PERP"): LeggingAction {
  return firstLegSide === "SPOT" ? "NEUTRALIZE_SPOT" : "CANCEL_PERP_AND_FLATTEN";
}

export function evaluateLeggingGuard(input: LeggingGuardInput): LeggingGuardDecision {
  const elapsedMs = elapsed(input.nowMs, input.firstLegFilledAtMs);

  leggingLogger.debug(
    {
      firstLegSide: input.firstLegSide,
      secondLegStatus: input.secondLegStatus,
      unhedgedNotionalUsd: input.unhedgedNotionalUsd,
      maxUnhedgedDurationMs: input.maxUnhedgedDurationMs,
      maxPartialFillDurationMs: input.maxPartialFillDurationMs,
      maxUnhedgedNotionalUsd: input.maxUnhedgedNotionalUsd,
      elapsedMs,
    },
    "Evaluating legging guard state.",
  );

  if (input.firstLegSide === null || input.firstLegFilledAtMs === undefined) {
    return {
      action: "WAIT",
      reason: "No first-leg exposure detected.",
      elapsedMs,
    };
  }

  if (Math.abs(input.unhedgedNotionalUsd) > input.maxUnhedgedNotionalUsd) {
    const decision: LeggingGuardDecision = {
      action: "FORCE_EXIT_ALL",
      reason: "Unhedged exposure exceeded hard safety cap.",
      elapsedMs,
      incidentType: "partial_fill_unhedged",
    };
    leggingLogger.warn(decision, "Legging guard triggered force exit.");
    return decision;
  }

  if (input.secondLegStatus === "FILLED") {
    return {
      action: "SUCCESS_HEDGED",
      reason: "Second leg filled; position is hedged.",
      elapsedMs,
    };
  }

  if (input.secondLegStatus === "FAILED") {
    const action = sideDependentRecovery(input.firstLegSide);
    const decision: LeggingGuardDecision = {
      action,
      reason: "Second leg failed; executing recovery path.",
      elapsedMs,
      incidentType: "venue_error",
    };
    leggingLogger.warn(decision, "Legging guard triggered venue-error recovery.");
    return decision;
  }

  if (input.secondLegStatus === "PARTIAL") {
    if (elapsedMs > input.maxPartialFillDurationMs) {
      const decision: LeggingGuardDecision = {
        action: "FORCE_EXIT_ALL",
        reason: "Partial fill exceeded allowed unhedged duration.",
        elapsedMs,
        incidentType: "partial_fill_unhedged",
      };
      leggingLogger.warn(decision, "Legging guard triggered partial-fill emergency exit.");
      return decision;
    }

    return {
      action: "WAIT",
      reason: "Partial fill in progress and still within grace window.",
      elapsedMs,
    };
  }

  if (elapsedMs > input.maxUnhedgedDurationMs) {
    const action = sideDependentRecovery(input.firstLegSide);
    const decision: LeggingGuardDecision = {
      action,
      reason: "Second leg timed out beyond maximum unhedged duration.",
      elapsedMs,
      incidentType: "legging_timeout",
    };
    leggingLogger.warn(decision, "Legging guard triggered timeout recovery.");
    return decision;
  }

  return {
    action: "WAIT",
    reason: "Waiting for second leg completion within timeout window.",
    elapsedMs,
  };
}
