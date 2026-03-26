import { describe, expect, it } from "vitest";

import { evaluateLeggingGuard } from "../../src/strategy/legging-guard.js";

describe("evaluateLeggingGuard", () => {
  it("returns success when second leg is filled", () => {
    const result = evaluateLeggingGuard({
      nowMs: 1_000,
      firstLegSide: "SPOT",
      firstLegFilledAtMs: 900,
      secondLegStatus: "FILLED",
      unhedgedNotionalUsd: 0,
      maxUnhedgedDurationMs: 10_000,
      maxPartialFillDurationMs: 4_000,
      maxUnhedgedNotionalUsd: 2_000,
    });

    expect(result.action).toBe("SUCCESS_HEDGED");
  });

  it("waits while second leg pending inside timeout", () => {
    const result = evaluateLeggingGuard({
      nowMs: 2_000,
      firstLegSide: "SPOT",
      firstLegFilledAtMs: 1_500,
      secondLegStatus: "PENDING",
      unhedgedNotionalUsd: 1_000,
      maxUnhedgedDurationMs: 2_000,
      maxPartialFillDurationMs: 1_500,
      maxUnhedgedNotionalUsd: 2_000,
    });

    expect(result.action).toBe("WAIT");
    expect(result.incidentType).toBeUndefined();
  });

  it("neutralizes spot on timeout when second leg is still pending", () => {
    const result = evaluateLeggingGuard({
      nowMs: 5_000,
      firstLegSide: "SPOT",
      firstLegFilledAtMs: 1_000,
      secondLegStatus: "PENDING",
      unhedgedNotionalUsd: 1_000,
      maxUnhedgedDurationMs: 2_000,
      maxPartialFillDurationMs: 1_500,
      maxUnhedgedNotionalUsd: 2_000,
    });

    expect(result.action).toBe("NEUTRALIZE_SPOT");
    expect(result.incidentType).toBe("legging_timeout");
  });

  it("cancels and flattens perp if second leg fails after perp-first flow", () => {
    const result = evaluateLeggingGuard({
      nowMs: 5_000,
      firstLegSide: "PERP",
      firstLegFilledAtMs: 1_000,
      secondLegStatus: "FAILED",
      unhedgedNotionalUsd: 800,
      maxUnhedgedDurationMs: 2_000,
      maxPartialFillDurationMs: 1_500,
      maxUnhedgedNotionalUsd: 2_000,
    });

    expect(result.action).toBe("CANCEL_PERP_AND_FLATTEN");
    expect(result.incidentType).toBe("venue_error");
  });

  it("forces global exit on large partial-fill exposure", () => {
    const result = evaluateLeggingGuard({
      nowMs: 10_000,
      firstLegSide: "SPOT",
      firstLegFilledAtMs: 2_000,
      secondLegStatus: "PARTIAL",
      unhedgedNotionalUsd: 5_000,
      maxUnhedgedDurationMs: 2_000,
      maxPartialFillDurationMs: 3_000,
      maxUnhedgedNotionalUsd: 2_000,
    });

    expect(result.action).toBe("FORCE_EXIT_ALL");
    expect(result.incidentType).toBe("partial_fill_unhedged");
  });
});
