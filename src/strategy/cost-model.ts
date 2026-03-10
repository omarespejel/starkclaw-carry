import { createLogger } from "../logging/logger.js";

export type CarryCostInput = {
  notionalUsd: number;
  holdHours: number;
  expectedFundingRateHourly: number;
  spotEntryFeeRate: number;
  spotExitFeeRate: number;
  perpEntryFeeRate: number;
  perpExitFeeRate: number;
  expectedSlippageBps: number;
  driftReserveBps: number;
  gasCostUsdTotal: number;
};

export type CarryEdgeEstimate = {
  expectedFundingIncomeUsd: number;
  feeCostUsd: number;
  slippageCostUsd: number;
  driftReserveUsd: number;
  gasCostUsd: number;
  totalCostUsd: number;
  netEdgeUsd: number;
  netEdgeBps: number;
};

const costLogger = createLogger({ component: "cost_model" });

export function estimateCarryEdge(input: CarryCostInput): CarryEdgeEstimate {
  const feeRateTotal =
    input.spotEntryFeeRate + input.spotExitFeeRate + input.perpEntryFeeRate + input.perpExitFeeRate;
  const feeCostUsd = input.notionalUsd * feeRateTotal;
  const slippageCostUsd = input.notionalUsd * (input.expectedSlippageBps / 10_000);
  const driftReserveUsd = input.notionalUsd * (input.driftReserveBps / 10_000);
  const gasCostUsd = input.gasCostUsdTotal;
  const totalCostUsd = feeCostUsd + slippageCostUsd + driftReserveUsd + gasCostUsd;

  const expectedFundingIncomeUsd =
    input.notionalUsd * input.expectedFundingRateHourly * input.holdHours;
  const netEdgeUsd = expectedFundingIncomeUsd - totalCostUsd;
  const netEdgeBps = (netEdgeUsd / input.notionalUsd) * 10_000;

  const estimate: CarryEdgeEstimate = {
    expectedFundingIncomeUsd,
    feeCostUsd,
    slippageCostUsd,
    driftReserveUsd,
    gasCostUsd,
    totalCostUsd,
    netEdgeUsd,
    netEdgeBps,
  };

  costLogger.debug(
    {
      notionalUsd: input.notionalUsd,
      holdHours: input.holdHours,
      expectedFundingRateHourly: input.expectedFundingRateHourly,
      feeRateTotal,
      expectedSlippageBps: input.expectedSlippageBps,
      driftReserveBps: input.driftReserveBps,
      estimate,
    },
    "Carry edge estimate computed.",
  );

  return estimate;
}
