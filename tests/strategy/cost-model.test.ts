import { describe, expect, it } from "vitest";

import { estimateCarryEdge } from "../../src/strategy/cost-model.js";

describe("estimateCarryEdge", () => {
  it("returns positive net edge when expected funding dominates costs", () => {
    const result = estimateCarryEdge({
      notionalUsd: 1_000,
      holdHours: 8,
      expectedFundingRateHourly: 0.0008,
      spotEntryFeeRate: 0.0001,
      spotExitFeeRate: 0.0001,
      perpEntryFeeRate: 0.00025,
      perpExitFeeRate: 0.00025,
      expectedSlippageBps: 5,
      driftReserveBps: 5,
      gasCostUsdTotal: 0.5,
    });

    expect(result.expectedFundingIncomeUsd).toBeGreaterThan(result.totalCostUsd);
    expect(result.netEdgeUsd).toBeGreaterThan(0);
    expect(result.netEdgeBps).toBeGreaterThan(0);
  });

  it("returns negative net edge when costs exceed expected funding", () => {
    const result = estimateCarryEdge({
      notionalUsd: 1_000,
      holdHours: 4,
      expectedFundingRateHourly: 0.00005,
      spotEntryFeeRate: 0.0003,
      spotExitFeeRate: 0.0003,
      perpEntryFeeRate: 0.00025,
      perpExitFeeRate: 0.00025,
      expectedSlippageBps: 20,
      driftReserveBps: 10,
      gasCostUsdTotal: 1.5,
    });

    expect(result.netEdgeUsd).toBeLessThan(0);
    expect(result.netEdgeBps).toBeLessThan(0);
  });
});
