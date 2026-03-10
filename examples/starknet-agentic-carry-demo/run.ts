import { parseEnv } from "../../src/config/env.js";
import { createLogger } from "../../src/logging/logger.js";
import { createStarknetAgenticCarryAdapter } from "../../src/integrations/starknet-agentic/tools.js";
import { createExtendedClient } from "../../src/venues/extended/client.js";

async function main(): Promise<void> {
  const config = parseEnv();
  const logger = createLogger({ component: "agentic_demo", level: config.logLevel });

  const extendedClient = createExtendedClient({
    baseUrl: config.extendedBaseUrl,
    apiPrefix: config.extendedApiPrefix,
    apiKey: config.extendedApiKey,
  });

  const adapter = createStarknetAgenticCarryAdapter({ extendedClient, logger });

  const nowMs = Date.now();
  const startMs = nowMs - 24 * 60 * 60 * 1000;

  const marketSnapshot = await adapter.callTool("starknet_extended_market_snapshot", {
    market: config.market,
  });

  const fundingHistory = await adapter.callTool("starknet_extended_funding_history", {
    market: config.market,
    startTimeMs: startMs,
    endTimeMs: nowMs,
  });

  const fees = await adapter.callTool("starknet_extended_user_fees", {
    market: config.market,
  });

  const decision = await adapter.callTool("starknet_carry_decide", {
    market: config.market,
    hasOpenPosition: false,
    venueHealthy: true,
    spotQuoteAgeMs: 500,
    perpSnapshotAgeMs: 500,
    feesAgeMs: 500,
    maxDataAgeMs: 3000,
    notionalUsd: config.maxNotionalUsd,
    holdHours: 8,
    currentFundingRateHourly: (marketSnapshot as { fundingRate: number }).fundingRate,
    fundingHistoryHourly: (fundingHistory as Array<{ fundingRate: number }>).map(
      (item) => item.fundingRate,
    ),
    minFundingAverageHourly: 0.00005,
    minFundingPositiveShare: 0.6,
    enterMinNetEdgeUsd: 0.1,
    enterMinNetEdgeBps: 1,
    holdMinNetEdgeUsd: 0,
    costs: {
      spotEntryFeeRate: 0.0001,
      spotExitFeeRate: 0.0001,
      perpEntryFeeRate: (fees as { takerFeeRate: number }).takerFeeRate,
      perpExitFeeRate: (fees as { takerFeeRate: number }).takerFeeRate,
      expectedSlippageBps: 5,
      driftReserveBps: 5,
      gasCostUsdTotal: 0.5,
    },
  });

  logger.info(
    {
      market: config.market,
      marketSnapshot,
      fundingPoints: Array.isArray(fundingHistory) ? fundingHistory.length : 0,
      fees,
      decision,
    },
    "Starknet-agentic carry demo result.",
  );
}

main().catch((error: unknown) => {
  const logger = createLogger({ component: "agentic_demo" });
  logger.error({ error }, "Demo failed.");
  process.exitCode = 1;
});
