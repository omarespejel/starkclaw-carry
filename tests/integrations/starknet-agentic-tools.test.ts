import { describe, expect, it, vi } from "vitest";

import { createStarknetAgenticCarryAdapter } from "../../src/integrations/starknet-agentic/tools.js";
import type { ExtendedClient } from "../../src/venues/extended/client.js";

function createMockExtendedClient(): ExtendedClient {
  return {
    getMarketSnapshot: vi.fn().mockResolvedValue({
      market: "ETH-USD",
      markPrice: 2100,
      indexPrice: 2098,
      fundingRate: 0.0002,
      nextFundingRateTimestampMs: 1777777000000,
      openInterestUsd: 50_000_000,
      dailyVolumeUsd: 100_000_000,
      tradingConfig: {
        minOrderSize: 0.01,
        minOrderSizeChange: 0.01,
        minPriceChange: 0.1,
      },
    }),
    getFundingHistory: vi.fn().mockResolvedValue([
      { timestamp: 1777777000000, fundingRate: 0.0002 },
      { timestamp: 1777777600000, fundingRate: 0.00025 },
    ]),
    getUserFees: vi.fn().mockResolvedValue({
      market: "ETH-USD",
      makerFeeRate: 0,
      takerFeeRate: 0.00025,
      builderFeeRate: 0.0001,
    }),
  };
}

describe("createStarknetAgenticCarryAdapter", () => {
  it("registers expected tool names", () => {
    const adapter = createStarknetAgenticCarryAdapter({
      extendedClient: createMockExtendedClient(),
    });

    const names = adapter.tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "starknet_carry_estimate_edge",
        "starknet_carry_decide",
        "starknet_carry_reconcile_hedge",
        "starknet_carry_legging_guard",
        "starknet_extended_market_snapshot",
        "starknet_extended_funding_history",
        "starknet_extended_user_fees",
      ]),
    );
  });

  it("evaluates decision tool with validated input", async () => {
    const adapter = createStarknetAgenticCarryAdapter({
      extendedClient: createMockExtendedClient(),
    });

    const result = await adapter.callTool("starknet_carry_decide", {
      market: "ETH-USD",
      hasOpenPosition: false,
      venueHealthy: true,
      spotQuoteAgeMs: 200,
      perpSnapshotAgeMs: 250,
      feesAgeMs: 300,
      maxDataAgeMs: 3000,
      notionalUsd: 1000,
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
    });

    expect(result).toMatchObject({
      action: "ENTER",
      reasonCode: "ENTER_EDGE_POSITIVE",
    });
  });

  it("delegates market snapshot tool to extended client", async () => {
    const extendedClient = createMockExtendedClient();
    const adapter = createStarknetAgenticCarryAdapter({ extendedClient });

    const result = await adapter.callTool("starknet_extended_market_snapshot", {
      market: "ETH-USD",
    });

    expect(result).toMatchObject({
      market: "ETH-USD",
      markPrice: 2100,
    });
    expect(extendedClient.getMarketSnapshot).toHaveBeenCalledWith({
      market: "ETH-USD",
    });
  });

  it("rejects unknown tool names", async () => {
    const adapter = createStarknetAgenticCarryAdapter({
      extendedClient: createMockExtendedClient(),
    });

    await expect(() => adapter.callTool("not_a_tool", {})).rejects.toThrowError(/unknown tool/i);
  });
});
