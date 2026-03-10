import { z } from "zod";

import type { Logger } from "pino";

import { createLogger } from "../../logging/logger.js";
import type {
  ExtendedFundingPoint,
  ExtendedMarketSnapshot,
  ExtendedTradingConfig,
  ExtendedUserFees,
} from "./types.js";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const numericLikeSchema = z.union([z.string(), z.number()]);

const marketRecordSchema = z.object({
  market: z.string(),
  marketStats: z.object({
    markPrice: numericLikeSchema,
    indexPrice: numericLikeSchema,
    fundingRate: numericLikeSchema,
    nextFundingRate: numericLikeSchema.optional(),
    openInterest: numericLikeSchema.optional(),
    dailyVolume: numericLikeSchema.optional(),
  }),
  tradingConfig: z.object({
    minOrderSize: numericLikeSchema,
    minOrderSizeChange: numericLikeSchema,
    minPriceChange: numericLikeSchema,
    maxNumOrders: numericLikeSchema.optional(),
    limitPriceCap: numericLikeSchema.optional(),
    limitPriceFloor: numericLikeSchema.optional(),
    maxMarketOrderValue: numericLikeSchema.optional(),
    maxLimitOrderValue: numericLikeSchema.optional(),
    maxPositionValue: numericLikeSchema.optional(),
    maxLeverage: numericLikeSchema.optional(),
  }),
});

const marketResponseSchema = z.object({
  markets: z.array(marketRecordSchema),
});

const userFeesSchema = z.object({
  market: z.string(),
  makerFeeRate: numericLikeSchema,
  takerFeeRate: numericLikeSchema,
  builderFeeRate: numericLikeSchema.optional(),
});

function toNumber(value: string | number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

function toRequiredNumber(value: string | number, fieldName: string): number {
  const parsed = toNumber(value);
  if (parsed === undefined) {
    throw new Error(`Invalid numeric field: ${fieldName}`);
  }
  return parsed;
}

function normalizeTradingConfig(
  raw: z.infer<typeof marketRecordSchema>["tradingConfig"],
): ExtendedTradingConfig {
  return {
    minOrderSize: toRequiredNumber(raw.minOrderSize, "tradingConfig.minOrderSize"),
    minOrderSizeChange: toRequiredNumber(
      raw.minOrderSizeChange,
      "tradingConfig.minOrderSizeChange",
    ),
    minPriceChange: toRequiredNumber(raw.minPriceChange, "tradingConfig.minPriceChange"),
    maxNumOrders: toNumber(raw.maxNumOrders),
    limitPriceCap: toNumber(raw.limitPriceCap),
    limitPriceFloor: toNumber(raw.limitPriceFloor),
    maxMarketOrderValue: toNumber(raw.maxMarketOrderValue),
    maxLimitOrderValue: toNumber(raw.maxLimitOrderValue),
    maxPositionValue: toNumber(raw.maxPositionValue),
    maxLeverage: toNumber(raw.maxLeverage),
  };
}

type CreateExtendedClientOptions = {
  baseUrl: string;
  apiPrefix?: string;
  apiKey?: string;
  fetchImpl?: FetchLike;
  logger?: Logger;
};

type GetMarketSnapshotParams = {
  market: string;
};

type GetFundingHistoryParams = {
  market: string;
  startTimeMs: number;
  endTimeMs: number;
};

type GetUserFeesParams = {
  market: string;
};

export type ExtendedClient = {
  getMarketSnapshot: (params: GetMarketSnapshotParams) => Promise<ExtendedMarketSnapshot>;
  getFundingHistory: (params: GetFundingHistoryParams) => Promise<ExtendedFundingPoint[]>;
  getUserFees: (params: GetUserFeesParams) => Promise<ExtendedUserFees>;
};

function buildUrl(baseUrl: string, apiPrefix: string, path: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPrefix = apiPrefix.startsWith("/") ? apiPrefix : `/${apiPrefix}`;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPrefix}${normalizedPath}`;
}

function extractFundingRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload !== null && typeof payload === "object") {
    const asRecord = payload as Record<string, unknown>;
    const candidateKeys = ["funding", "fundingRates", "data", "items"];
    for (const key of candidateKeys) {
      if (Array.isArray(asRecord[key])) {
        return asRecord[key] as unknown[];
      }
    }
  }
  return [];
}

function mapFundingRow(row: unknown): ExtendedFundingPoint | null {
  if (row === null || typeof row !== "object") {
    return null;
  }
  const asRecord = row as Record<string, unknown>;

  const timestampCandidate = asRecord.timestamp ?? asRecord.time ?? asRecord.ts;
  const rateCandidate = asRecord.fundingRate ?? asRecord.rate ?? asRecord.value;

  const timestamp = toNumber(timestampCandidate as string | number | undefined);
  const fundingRate = toNumber(rateCandidate as string | number | undefined);
  if (timestamp === undefined || fundingRate === undefined) {
    return null;
  }

  return {
    timestamp,
    fundingRate,
  };
}

export function createExtendedClient(options: CreateExtendedClientOptions): ExtendedClient {
  const logger = options.logger ?? createLogger({ component: "extended_client" });
  const apiPrefix = options.apiPrefix ?? "/api/v1";
  const fetchImpl: FetchLike = options.fetchImpl ?? fetch;

  async function requestJson(
    path: string,
    init: { method?: string; headers?: Record<string, string> } = {},
  ): Promise<unknown> {
    const url = buildUrl(options.baseUrl, apiPrefix, path);
    const method = init.method ?? "GET";
    logger.debug({ method, url }, "Extended request started.");

    const response = await fetchImpl(url, {
      method,
      headers: init.headers,
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error(
        {
          method,
          url,
          status: response.status,
          statusText: response.statusText,
          bodySnippet: body.slice(0, 240),
        },
        "Extended request failed.",
      );
      throw new Error(
        `Extended request failed with status ${response.status} (${response.statusText}) for ${url}`,
      );
    }

    const payload = (await response.json()) as unknown;
    logger.debug({ method, url }, "Extended request completed.");
    return payload;
  }

  return {
    async getMarketSnapshot(params: GetMarketSnapshotParams): Promise<ExtendedMarketSnapshot> {
      const payload = await requestJson(
        `/info/markets?market=${encodeURIComponent(params.market)}`,
      );
      const parsed = marketResponseSchema.parse(payload);
      const match =
        parsed.markets.find((item) => item.market === params.market) ?? parsed.markets[0];
      if (match === undefined) {
        throw new Error(`Market not found in Extended response: ${params.market}`);
      }

      const snapshot: ExtendedMarketSnapshot = {
        market: match.market,
        markPrice: toRequiredNumber(match.marketStats.markPrice, "marketStats.markPrice"),
        indexPrice: toRequiredNumber(match.marketStats.indexPrice, "marketStats.indexPrice"),
        fundingRate: toRequiredNumber(match.marketStats.fundingRate, "marketStats.fundingRate"),
        nextFundingRateTimestampMs: toNumber(match.marketStats.nextFundingRate),
        openInterestUsd: toNumber(match.marketStats.openInterest),
        dailyVolumeUsd: toNumber(match.marketStats.dailyVolume),
        tradingConfig: normalizeTradingConfig(match.tradingConfig),
      };

      logger.debug(
        {
          market: snapshot.market,
          markPrice: snapshot.markPrice,
          fundingRate: snapshot.fundingRate,
          minOrderSize: snapshot.tradingConfig.minOrderSize,
        },
        "Extended market snapshot normalized.",
      );
      return snapshot;
    },

    async getFundingHistory(params: GetFundingHistoryParams): Promise<ExtendedFundingPoint[]> {
      const payload = await requestJson(
        `/info/${encodeURIComponent(params.market)}/funding?startTime=${params.startTimeMs}&endTime=${params.endTimeMs}`,
      );
      const rows = extractFundingRows(payload);
      const points = rows
        .map(mapFundingRow)
        .filter((point): point is ExtendedFundingPoint => point !== null)
        .sort((a, b) => a.timestamp - b.timestamp);

      logger.debug(
        {
          market: params.market,
          startTimeMs: params.startTimeMs,
          endTimeMs: params.endTimeMs,
          rowsReceived: rows.length,
          pointsParsed: points.length,
        },
        "Extended funding history normalized.",
      );

      return points;
    },

    async getUserFees(params: GetUserFeesParams): Promise<ExtendedUserFees> {
      if (options.apiKey === undefined || options.apiKey.length === 0) {
        throw new Error("Extended API key is required for getUserFees.");
      }

      const payload = await requestJson(`/user/fees?market=${encodeURIComponent(params.market)}`, {
        headers: {
          "X-Api-Key": options.apiKey,
        },
      });
      const parsed = userFeesSchema.parse(payload);
      const normalized: ExtendedUserFees = {
        market: parsed.market,
        makerFeeRate: toRequiredNumber(parsed.makerFeeRate, "makerFeeRate"),
        takerFeeRate: toRequiredNumber(parsed.takerFeeRate, "takerFeeRate"),
        builderFeeRate: toNumber(parsed.builderFeeRate),
      };

      logger.debug(
        {
          market: normalized.market,
          makerFeeRate: normalized.makerFeeRate,
          takerFeeRate: normalized.takerFeeRate,
          builderFeeRate: normalized.builderFeeRate,
        },
        "Extended user fees normalized.",
      );
      return normalized;
    },
  };
}
