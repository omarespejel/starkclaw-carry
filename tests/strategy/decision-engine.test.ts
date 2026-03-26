import { describe, expect, it } from "vitest";

import { evaluateCarryDecision } from "../../src/strategy/decision-engine.js";

const baseInput = {
  market: "ETH-USD",
  hasOpenPosition: false,
  venueHealthy: true,
  spotQuoteAgeMs: 500,
  perpSnapshotAgeMs: 300,
  feesAgeMs: 400,
  maxDataAgeMs: 3_000,
  notionalUsd: 1_000,
  holdHours: 8,
  currentFundingRateHourly: 0.0005,
  fundingHistoryHourly: [0.0004, 0.0005, 0.00045, 0.00047, 0.00052],
  minFundingAverageHourly: 0.0001,
  minFundingPositiveShare: 0.6,
  enterMinNetEdgeUsd: 0.1,
  enterMinNetEdgeBps: 1,
  holdMinNetEdgeUsd: 0,
  costs: {
    spotEntryFeeRate: 0.0001,
    spotExitFeeRate: 0.0001,
    perpEntryFeeRate: 0.00025,
    perpExitFeeRate: 0.00025,
    expectedSlippageBps: 4,
    driftReserveBps: 4,
    gasCostUsdTotal: 0.5,
  },
};

describe("evaluateCarryDecision", () => {
  it("pauses when venue health is degraded", () => {
    const decision = evaluateCarryDecision({
      ...baseInput,
      venueHealthy: false,
    });

    expect(decision.action).toBe("PAUSE");
    expect(decision.reasonCode).toBe("PAUSE_VENUE_UNHEALTHY");
  });

  it("pauses when data is stale", () => {
    const decision = evaluateCarryDecision({
      ...baseInput,
      spotQuoteAgeMs: 10_000,
    });

    expect(decision.action).toBe("PAUSE");
    expect(decision.reasonCode).toBe("PAUSE_STALE_DATA");
  });

  it("enters when edge and regime are both strong", () => {
    const decision = evaluateCarryDecision(baseInput);
    expect(decision.action).toBe("ENTER");
    expect(decision.reasonCode).toBe("ENTER_EDGE_POSITIVE");
    expect(decision.edge.netEdgeUsd).toBeGreaterThan(0);
  });

  it("holds when edge is insufficient", () => {
    const decision = evaluateCarryDecision({
      ...baseInput,
      costs: {
        ...baseInput.costs,
        expectedSlippageBps: 40,
        gasCostUsdTotal: 2.5,
      },
    });

    expect(decision.action).toBe("HOLD");
    expect(decision.reasonCode).toBe("HOLD_INSUFFICIENT_EDGE");
  });

  it("exits when a live position has negative net edge", () => {
    const decision = evaluateCarryDecision({
      ...baseInput,
      hasOpenPosition: true,
      currentFundingRateHourly: 0.00001,
      fundingHistoryHourly: [0.00002, -0.00001, 0.00001, -0.00002, 0.00001],
      minFundingAverageHourly: 0,
      minFundingPositiveShare: 0.2,
      costs: {
        ...baseInput.costs,
        expectedSlippageBps: 30,
      },
      holdMinNetEdgeUsd: 0.2,
    });

    expect(decision.action).toBe("EXIT");
    expect(decision.reasonCode).toBe("EXIT_EDGE_NEGATIVE");
  });
});
