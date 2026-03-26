import { createLogger } from "../logging/logger.js";

export type HedgeReconciliationAction =
  | "HOLD"
  | "REBALANCE_INCREASE_PERP_SHORT"
  | "REBALANCE_DECREASE_PERP_SHORT"
  | "EXIT_ALL";

export type HedgeReconciliationInput = {
  spotNotionalUsd: number;
  perpShortNotionalUsd: number;
  maxDriftPct: number;
  emergencyDriftPct: number;
};

export type HedgeReconciliationDecision = {
  action: HedgeReconciliationAction;
  reason: string;
  driftUsd: number;
  driftPct: number;
};

const reconcilerLogger = createLogger({ component: "reconciler" });

function computeDriftPct(spotNotionalUsd: number, perpShortNotionalUsd: number): number {
  const denominator = Math.max(Math.abs(spotNotionalUsd), Math.abs(perpShortNotionalUsd), 1);
  return (Math.abs(spotNotionalUsd - perpShortNotionalUsd) / denominator) * 100;
}

export function evaluateHedgeReconciliation(
  input: HedgeReconciliationInput,
): HedgeReconciliationDecision {
  const driftUsd = input.spotNotionalUsd - input.perpShortNotionalUsd;
  const driftPct = computeDriftPct(input.spotNotionalUsd, input.perpShortNotionalUsd);

  reconcilerLogger.debug(
    {
      spotNotionalUsd: input.spotNotionalUsd,
      perpShortNotionalUsd: input.perpShortNotionalUsd,
      maxDriftPct: input.maxDriftPct,
      emergencyDriftPct: input.emergencyDriftPct,
      driftUsd,
      driftPct,
    },
    "Reconciler evaluating hedge drift.",
  );

  if (driftPct >= input.emergencyDriftPct) {
    const decision: HedgeReconciliationDecision = {
      action: "EXIT_ALL",
      reason: "Emergency drift breached; flatten all exposure.",
      driftUsd,
      driftPct,
    };
    reconcilerLogger.warn(decision, "Reconciler decided emergency exit.");
    return decision;
  }

  if (driftPct <= input.maxDriftPct) {
    const decision: HedgeReconciliationDecision = {
      action: "HOLD",
      reason: "Exposure is within drift threshold.",
      driftUsd,
      driftPct,
    };
    reconcilerLogger.debug(decision, "Reconciler decided hold.");
    return decision;
  }

  if (driftUsd > 0) {
    const decision: HedgeReconciliationDecision = {
      action: "REBALANCE_INCREASE_PERP_SHORT",
      reason: "Spot leg is larger than perp short; increase perp short.",
      driftUsd,
      driftPct,
    };
    reconcilerLogger.info(decision, "Reconciler decided to increase perp short.");
    return decision;
  }

  const decision: HedgeReconciliationDecision = {
    action: "REBALANCE_DECREASE_PERP_SHORT",
    reason: "Perp short is larger than spot leg; decrease perp short.",
    driftUsd,
    driftPct,
  };
  reconcilerLogger.info(decision, "Reconciler decided to decrease perp short.");
  return decision;
}
