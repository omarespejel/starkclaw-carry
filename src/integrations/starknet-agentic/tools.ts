import { z } from "zod";

import type { Logger } from "pino";

import { createLogger } from "../../logging/logger.js";
import { estimateCarryEdge } from "../../strategy/cost-model.js";
import { evaluateCarryDecision } from "../../strategy/decision-engine.js";
import { evaluateLeggingGuard } from "../../strategy/legging-guard.js";
import { evaluateHedgeReconciliation } from "../../strategy/reconciler.js";
import type { ExtendedClient } from "../../venues/extended/client.js";

export type StarknetAgenticToolDefinition = {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  execute: (input: unknown) => Promise<unknown>;
};

export type StarknetAgenticCarryAdapter = {
  tools: readonly StarknetAgenticToolDefinition[];
  callTool: (name: string, args: unknown) => Promise<unknown>;
};

type CreateStarknetAgenticCarryAdapterOptions = {
  extendedClient: ExtendedClient;
  logger?: Logger;
};

const carryCostInputSchema = z.object({
  notionalUsd: z.number().positive(),
  holdHours: z.number().positive(),
  expectedFundingRateHourly: z.number(),
  spotEntryFeeRate: z.number().nonnegative(),
  spotExitFeeRate: z.number().nonnegative(),
  perpEntryFeeRate: z.number().nonnegative(),
  perpExitFeeRate: z.number().nonnegative(),
  expectedSlippageBps: z.number().nonnegative(),
  driftReserveBps: z.number().nonnegative(),
  gasCostUsdTotal: z.number().nonnegative(),
});

const carryDecisionInputSchema = z.object({
  market: z.string().min(1),
  hasOpenPosition: z.boolean(),
  venueHealthy: z.boolean(),
  spotQuoteAgeMs: z.number().nonnegative(),
  perpSnapshotAgeMs: z.number().nonnegative(),
  feesAgeMs: z.number().nonnegative(),
  maxDataAgeMs: z.number().positive(),
  notionalUsd: z.number().positive(),
  holdHours: z.number().positive(),
  currentFundingRateHourly: z.number(),
  fundingHistoryHourly: z.array(z.number()),
  minFundingAverageHourly: z.number(),
  minFundingPositiveShare: z.number().min(0).max(1),
  enterMinNetEdgeUsd: z.number(),
  enterMinNetEdgeBps: z.number(),
  holdMinNetEdgeUsd: z.number(),
  costs: z.object({
    spotEntryFeeRate: z.number().nonnegative(),
    spotExitFeeRate: z.number().nonnegative(),
    perpEntryFeeRate: z.number().nonnegative(),
    perpExitFeeRate: z.number().nonnegative(),
    expectedSlippageBps: z.number().nonnegative(),
    driftReserveBps: z.number().nonnegative(),
    gasCostUsdTotal: z.number().nonnegative(),
  }),
});

const reconcileInputSchema = z.object({
  spotNotionalUsd: z.number(),
  perpShortNotionalUsd: z.number(),
  maxDriftPct: z.number().positive(),
  emergencyDriftPct: z.number().positive(),
});

const leggingGuardInputSchema = z.object({
  nowMs: z.number().nonnegative(),
  firstLegSide: z.enum(["SPOT", "PERP"]).nullable(),
  firstLegFilledAtMs: z.number().nonnegative().optional(),
  secondLegStatus: z.enum(["PENDING", "FILLED", "FAILED", "PARTIAL"]),
  unhedgedNotionalUsd: z.number().nonnegative(),
  maxUnhedgedDurationMs: z.number().positive(),
  maxPartialFillDurationMs: z.number().positive(),
  maxUnhedgedNotionalUsd: z.number().positive(),
});

const marketInputSchema = z.object({
  market: z.string().min(1),
});

const fundingInputSchema = z.object({
  market: z.string().min(1),
  startTimeMs: z.number().int().nonnegative(),
  endTimeMs: z.number().int().nonnegative(),
});

const feesInputSchema = z.object({
  market: z.string().min(1),
});

export function createStarknetAgenticCarryAdapter(
  options: CreateStarknetAgenticCarryAdapterOptions,
): StarknetAgenticCarryAdapter {
  const logger = options.logger ?? createLogger({ component: "agentic_carry_adapter" });

  const tools: readonly StarknetAgenticToolDefinition[] = [
    {
      name: "starknet_carry_estimate_edge",
      description: "Estimate net carry edge after fees, slippage, gas, and drift reserves.",
      inputSchema: carryCostInputSchema,
      execute: (input) =>
        Promise.resolve(estimateCarryEdge(input as z.infer<typeof carryCostInputSchema>)),
    },
    {
      name: "starknet_carry_decide",
      description: "Run deterministic carry decision engine and return ENTER/HOLD/EXIT/PAUSE.",
      inputSchema: carryDecisionInputSchema,
      execute: (input) =>
        Promise.resolve(evaluateCarryDecision(input as z.infer<typeof carryDecisionInputSchema>)),
    },
    {
      name: "starknet_carry_reconcile_hedge",
      description: "Evaluate hedge drift and return deterministic reconciliation action.",
      inputSchema: reconcileInputSchema,
      execute: (input) =>
        Promise.resolve(evaluateHedgeReconciliation(input as z.infer<typeof reconcileInputSchema>)),
    },
    {
      name: "starknet_carry_legging_guard",
      description: "Evaluate legging safety and return recovery action/incident classification.",
      inputSchema: leggingGuardInputSchema,
      execute: (input) =>
        Promise.resolve(evaluateLeggingGuard(input as z.infer<typeof leggingGuardInputSchema>)),
    },
    {
      name: "starknet_extended_market_snapshot",
      description: "Fetch normalized market snapshot from Extended.",
      inputSchema: marketInputSchema,
      execute: async (input) =>
        options.extendedClient.getMarketSnapshot(input as z.infer<typeof marketInputSchema>),
    },
    {
      name: "starknet_extended_funding_history",
      description: "Fetch and normalize Extended funding history window.",
      inputSchema: fundingInputSchema,
      execute: async (input) =>
        options.extendedClient.getFundingHistory(input as z.infer<typeof fundingInputSchema>),
    },
    {
      name: "starknet_extended_user_fees",
      description: "Fetch effective user fee tier from Extended for a market.",
      inputSchema: feesInputSchema,
      execute: async (input) =>
        options.extendedClient.getUserFees(input as z.infer<typeof feesInputSchema>),
    },
  ];

  return {
    tools,
    async callTool(name: string, args: unknown): Promise<unknown> {
      const tool = tools.find((candidate) => candidate.name === name);
      if (tool === undefined) {
        throw new Error(`Unknown tool: ${name}`);
      }

      const parsed = tool.inputSchema.parse(args);
      logger.debug(
        {
          tool: name,
          argsPreview: parsed,
        },
        "Invoking Starknet-agentic carry tool.",
      );

      const output = await tool.execute(parsed);
      logger.debug({ tool: name }, "Tool invocation completed.");
      return output;
    },
  };
}
