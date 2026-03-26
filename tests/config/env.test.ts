import { describe, expect, it } from "vitest";

import { parseEnv, redactSecrets } from "../../src/config/env.js";

describe("parseEnv", () => {
  it("parses required configuration and applies production-safe defaults", () => {
    const config = parseEnv(
      {
        STARKNET_RPC_URL: "https://starknet-sepolia-rpc.publicnode.com",
        STARKNET_ACCOUNT_ADDRESS: "0x1234567890abcdef",
        STARKNET_PRIVATE_KEY: "0xabcdef1234567890",
      },
      { loadDotenv: false },
    );

    expect(config.nodeEnv).toBe("development");
    expect(config.logLevel).toBe("debug");
    expect(config.runMode).toBe("paper");
    expect(config.market).toBe("ETH-USD");
    expect(config.loopIntervalMs).toBe(5_000);
    expect(config.maxNotionalUsd).toBe(1_000);
    expect(config.bridgeEnabled).toBe(false);
    expect(config.extendedBaseUrl).toBe("https://api.starknet.extended.exchange");
    expect(config.extendedApiPrefix).toBe("/api/v1");
    expect(config.extendedDefaultRateLimitRpm).toBe(1000);
    expect(config.extendedPingIntervalSeconds).toBe(15);
    expect(config.extendedPongTimeoutSeconds).toBe(10);
    expect(config.journalDir).toContain("artifacts/journal");
  });

  it("rejects invalid or missing required env vars", () => {
    expect(() => parseEnv({}, { loadDotenv: false })).toThrowError();

    expect(() =>
      parseEnv(
        {
          STARKNET_RPC_URL: "not-a-url",
          STARKNET_ACCOUNT_ADDRESS: "0x123456",
          STARKNET_PRIVATE_KEY: "0xabcdef",
        },
        { loadDotenv: false },
      ),
    ).toThrowError(/STARKNET_RPC_URL/i);
  });

  it("rejects invalid market symbols", () => {
    expect(() =>
      parseEnv(
        {
          STARKNET_RPC_URL: "https://starknet-sepolia-rpc.publicnode.com",
          STARKNET_ACCOUNT_ADDRESS: "0x1234567890abcdef",
          STARKNET_PRIVATE_KEY: "0xabcdef1234567890",
          MARKET: "ethusd",
        },
        { loadDotenv: false },
      ),
    ).toThrowError(/MARKET/i);
  });
});

describe("redactSecrets", () => {
  it("redacts private keys and API keys in debug snapshots", () => {
    const redacted = redactSecrets({
      STARKNET_PRIVATE_KEY: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      EXTENDED_API_KEY: "ext-very-secret",
      AVNU_API_KEY: "avnu-secret",
      SAFE_FIELD: "ok",
    });

    expect(redacted.STARKNET_PRIVATE_KEY).toMatch(/^\*\*\*/);
    expect(redacted.EXTENDED_API_KEY).toMatch(/^\*\*\*/);
    expect(redacted.AVNU_API_KEY).toMatch(/^\*\*\*/);
    expect(redacted.SAFE_FIELD).toBe("ok");
  });
});
