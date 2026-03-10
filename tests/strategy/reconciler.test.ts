import { describe, expect, it } from "vitest";

import { evaluateHedgeReconciliation } from "../../src/strategy/reconciler.js";

describe("evaluateHedgeReconciliation", () => {
  it("holds when drift is within threshold", () => {
    const decision = evaluateHedgeReconciliation({
      spotNotionalUsd: 1000,
      perpShortNotionalUsd: 995,
      maxDriftPct: 2,
      emergencyDriftPct: 6,
    });

    expect(decision.action).toBe("HOLD");
    expect(decision.reason).toMatch(/within drift threshold/i);
  });

  it("rebalances by increasing perp short when spot is higher", () => {
    const decision = evaluateHedgeReconciliation({
      spotNotionalUsd: 1000,
      perpShortNotionalUsd: 960,
      maxDriftPct: 2,
      emergencyDriftPct: 6,
    });

    expect(decision.action).toBe("REBALANCE_INCREASE_PERP_SHORT");
    expect(decision.driftPct).toBeGreaterThan(2);
  });

  it("rebalances by reducing perp short when perp is higher", () => {
    const decision = evaluateHedgeReconciliation({
      spotNotionalUsd: 1000,
      perpShortNotionalUsd: 1040,
      maxDriftPct: 2,
      emergencyDriftPct: 6,
    });

    expect(decision.action).toBe("REBALANCE_DECREASE_PERP_SHORT");
  });

  it("exits all when emergency drift is breached", () => {
    const decision = evaluateHedgeReconciliation({
      spotNotionalUsd: 1000,
      perpShortNotionalUsd: 1300,
      maxDriftPct: 2,
      emergencyDriftPct: 6,
    });

    expect(decision.action).toBe("EXIT_ALL");
    expect(decision.reason).toMatch(/emergency drift/i);
  });
});
