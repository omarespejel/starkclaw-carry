import { createLogger } from "../logging/logger.js";
import { estimateCarryEdge, type CarryCostInput, type CarryEdgeEstimate } from "./cost-model.js";

export type CarryAction = "ENTER" | "HOLD" | "EXIT" | "PAUSE";

export type CarryReasonCode =
  | "PAUSE_VENUE_UNHEALTHY"
  | "PAUSE_STALE_DATA"
  | "ENTER_EDGE_POSITIVE"
  | "HOLD_INSUFFICIENT_EDGE"
  | "HOLD_REGIME_WEAK"
  | "HOLD_POSITION"
  | "EXIT_EDGE_NEGATIVE"
  | "EXIT_REGIME_WEAK";

export type CarryDecisionInput = {
  market: string;
  hasOpenPosition: boolean;
  venueHealthy: boolean;
  spotQuoteAgeMs: number;
  perpSnapshotAgeMs: number;
  feesAgeMs: number;
  maxDataAgeMs: number;
  notionalUsd: number;
  holdHours: number;
  currentFundingRateHourly: number;
  fundingHistoryHourly: number[];
  minFundingAverageHourly: number;
  minFundingPositiveShare: number;
  enterMinNetEdgeUsd: number;
  enterMinNetEdgeBps: number;
  holdMinNetEdgeUsd: number;
  costs: Omit<CarryCostInput, "notionalUsd" | "holdHours" | "expectedFundingRateHourly">;
};

export type FundingRegimeMetrics = {
  averageFundingRateHourly: number;
  positiveShare: number;
  isStrong: boolean;
};

export type CarryDecision = {
  action: CarryAction;
  reasonCode: CarryReasonCode;
  reason: string;
  edge: CarryEdgeEstimate;
  regime: FundingRegimeMetrics;
};

const decisionLogger = createLogger({ component: "decision_engine" });

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function evaluateFundingRegime(
  rates: number[],
  minFundingAverageHourly: number,
  minFundingPositiveShare: number,
): FundingRegimeMetrics {
  const averageFundingRateHourly = mean(rates);
  const positiveShare =
    rates.length === 0 ? 0 : rates.filter((value) => value > 0).length / rates.length;
  const isStrong =
    averageFundingRateHourly >= minFundingAverageHourly && positiveShare >= minFundingPositiveShare;

  return {
    averageFundingRateHourly,
    positiveShare,
    isStrong,
  };
}

function isDataStale(input: CarryDecisionInput): boolean {
  return (
    input.spotQuoteAgeMs > input.maxDataAgeMs ||
    input.perpSnapshotAgeMs > input.maxDataAgeMs ||
    input.feesAgeMs > input.maxDataAgeMs
  );
}

export function evaluateCarryDecision(input: CarryDecisionInput): CarryDecision {
  const regime = evaluateFundingRegime(
    input.fundingHistoryHourly,
    input.minFundingAverageHourly,
    input.minFundingPositiveShare,
  );

  const edge = estimateCarryEdge({
    notionalUsd: input.notionalUsd,
    holdHours: input.holdHours,
    expectedFundingRateHourly: input.currentFundingRateHourly,
    ...input.costs,
  });

  decisionLogger.debug(
    {
      market: input.market,
      hasOpenPosition: input.hasOpenPosition,
      venueHealthy: input.venueHealthy,
      spotQuoteAgeMs: input.spotQuoteAgeMs,
      perpSnapshotAgeMs: input.perpSnapshotAgeMs,
      feesAgeMs: input.feesAgeMs,
      maxDataAgeMs: input.maxDataAgeMs,
      regime,
      edge,
    },
    "Evaluating carry decision.",
  );

  if (!input.venueHealthy) {
    return {
      action: "PAUSE",
      reasonCode: "PAUSE_VENUE_UNHEALTHY",
      reason: "Venue health check failed.",
      edge,
      regime,
    };
  }

  if (isDataStale(input)) {
    return {
      action: "PAUSE",
      reasonCode: "PAUSE_STALE_DATA",
      reason: "Input data exceeded freshness threshold.",
      edge,
      regime,
    };
  }

  if (input.hasOpenPosition) {
    if (!regime.isStrong) {
      return {
        action: "EXIT",
        reasonCode: "EXIT_REGIME_WEAK",
        reason: "Funding regime is no longer strong enough to hold position.",
        edge,
        regime,
      };
    }

    if (edge.netEdgeUsd < input.holdMinNetEdgeUsd) {
      return {
        action: "EXIT",
        reasonCode: "EXIT_EDGE_NEGATIVE",
        reason: "Open position no longer has sufficient expected edge.",
        edge,
        regime,
      };
    }

    return {
      action: "HOLD",
      reasonCode: "HOLD_POSITION",
      reason: "Position still meets edge and regime requirements.",
      edge,
      regime,
    };
  }

  if (!regime.isStrong) {
    return {
      action: "HOLD",
      reasonCode: "HOLD_REGIME_WEAK",
      reason: "Funding regime not strong enough to open a new position.",
      edge,
      regime,
    };
  }

  if (edge.netEdgeUsd >= input.enterMinNetEdgeUsd && edge.netEdgeBps >= input.enterMinNetEdgeBps) {
    return {
      action: "ENTER",
      reasonCode: "ENTER_EDGE_POSITIVE",
      reason: "Net edge and regime both pass entry thresholds.",
      edge,
      regime,
    };
  }

  return {
    action: "HOLD",
    reasonCode: "HOLD_INSUFFICIENT_EDGE",
    reason: "Regime is acceptable but expected edge is below entry threshold.",
    edge,
    regime,
  };
}
