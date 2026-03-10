import { describe, expect, it, vi } from "vitest";

import { createExtendedClient } from "../../src/venues/extended/client.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ExtendedClient", () => {
  it("fetches and normalizes market snapshot", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        markets: [
          {
            market: "ETH-USD",
            marketStats: {
              markPrice: "2123.4",
              indexPrice: "2120.9",
              fundingRate: "0.000013",
              nextFundingRate: "1777777000000",
              openInterest: "65000000",
              dailyVolume: "143000000",
            },
            tradingConfig: {
              minOrderSize: "0.01",
              minOrderSizeChange: "0.01",
              minPriceChange: "0.1",
              maxNumOrders: 200,
              limitPriceCap: "0.05",
              limitPriceFloor: "0.05",
            },
          },
        ],
      }),
    );

    const client = createExtendedClient({
      baseUrl: "https://api.starknet.extended.exchange",
      apiPrefix: "/api/v1",
      fetchImpl: fetchMock,
    });

    const snapshot = await client.getMarketSnapshot({ market: "ETH-USD" });
    expect(snapshot.market).toBe("ETH-USD");
    expect(snapshot.markPrice).toBeCloseTo(2123.4);
    expect(snapshot.fundingRate).toBeCloseTo(0.000013);
    expect(snapshot.tradingConfig.minOrderSize).toBe(0.01);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches and normalizes funding history", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        funding: [
          { timestamp: 1777777000000, fundingRate: "0.000012" },
          { timestamp: 1777777600000, fundingRate: "0.000013" },
        ],
      }),
    );

    const client = createExtendedClient({
      baseUrl: "https://api.starknet.extended.exchange",
      apiPrefix: "/api/v1",
      fetchImpl: fetchMock,
    });

    const history = await client.getFundingHistory({
      market: "ETH-USD",
      startTimeMs: 1777777000000,
      endTimeMs: 1777777600000,
    });

    expect(history).toHaveLength(2);
    expect(history[0].fundingRate).toBeCloseTo(0.000012);
    expect(history[1].timestamp).toBe(1777777600000);
  });

  it("fetches user fee rates with API key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        market: "ETH-USD",
        makerFeeRate: "0.00000",
        takerFeeRate: "0.00025",
        builderFeeRate: "0.0001",
      }),
    );

    const client = createExtendedClient({
      baseUrl: "https://api.starknet.extended.exchange",
      apiPrefix: "/api/v1",
      apiKey: "test-api-key",
      fetchImpl: fetchMock,
    });

    const fees = await client.getUserFees({ market: "ETH-USD" });
    expect(fees.takerFeeRate).toBeCloseTo(0.00025);
    expect(fees.makerFeeRate).toBeCloseTo(0);

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = request.headers as Record<string, string>;
    expect(headers["X-Api-Key"]).toBe("test-api-key");
  });

  it("fails fast on non-2xx responses with context", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response("rate limited", { status: 429, statusText: "Too Many Requests" }),
      );

    const client = createExtendedClient({
      baseUrl: "https://api.starknet.extended.exchange",
      apiPrefix: "/api/v1",
      fetchImpl: fetchMock,
    });

    await expect(client.getMarketSnapshot({ market: "ETH-USD" })).rejects.toThrowError(/429/i);
  });

  it("rejects fee calls when api key is missing", async () => {
    const client = createExtendedClient({
      baseUrl: "https://api.starknet.extended.exchange",
      apiPrefix: "/api/v1",
      fetchImpl: vi.fn(),
    });

    await expect(client.getUserFees({ market: "ETH-USD" })).rejects.toThrowError(/api key/i);
  });
});
