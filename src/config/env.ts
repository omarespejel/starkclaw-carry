import { resolve } from "node:path";

import { config as loadDotEnv } from "dotenv";
import { z } from "zod";

import type { Logger } from "pino";

import { createLogger } from "../logging/logger.js";

const HEX_STRING_REGEX = /^0x[0-9a-fA-F]{6,}$/;
const MARKET_REGEX = /^[A-Z0-9]+-[A-Z0-9]+$/;

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("debug"),
  RUN_MODE: z.enum(["paper", "shadow", "micro_live"]).default("paper"),
  STARKNET_RPC_URL: z.url(),
  STARKNET_ACCOUNT_ADDRESS: z.string().regex(HEX_STRING_REGEX),
  STARKNET_PRIVATE_KEY: z.string().regex(HEX_STRING_REGEX),
  AVNU_API_KEY: z.string().optional(),
  EXTENDED_API_KEY: z.string().optional(),
  EXTENDED_PUBLIC_KEY: z.string().optional(),
  EXTENDED_PRIVATE_KEY: z.string().optional(),
  EXTENDED_VAULT_NUMBER: z
    .string()
    .optional()
    .transform((value) => (value === undefined ? undefined : Number(value)))
    .pipe(z.number().int().nonnegative().optional()),
  EXTENDED_CLIENT_ID: z
    .string()
    .optional()
    .transform((value) => (value === undefined ? undefined : Number(value)))
    .pipe(z.number().int().nonnegative().optional()),
  EXTENDED_BASE_URL: z.url().default("https://api.starknet.extended.exchange"),
  EXTENDED_API_PREFIX: z.string().default("/api/v1"),
  EXTENDED_ACCOUNT_WS_URL: z
    .url()
    .default("wss://api.starknet.extended.exchange/stream.extended.exchange/v1/account"),
  EXTENDED_FUNDING_WS_TEMPLATE: z
    .string()
    .default("wss://api.starknet.extended.exchange/stream.extended.exchange/v1/funding/{market}"),
  EXTENDED_TESTNET_BASE_URL: z.url().default("https://api.starknet.sepolia.extended.exchange"),
  EXTENDED_DEFAULT_RATE_LIMIT_RPM: z.coerce.number().int().positive().default(1000),
  EXTENDED_PING_INTERVAL_SECONDS: z.coerce.number().int().positive().default(15),
  EXTENDED_PONG_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(10),
  MARKET: z.string().regex(MARKET_REGEX).default("ETH-USD"),
  MAX_NOTIONAL_USD: z.coerce.number().positive().default(1_000),
  LOOP_INTERVAL_MS: z.coerce.number().int().min(1_000).default(5_000),
  JOURNAL_DIR: z.string().default(resolve(process.cwd(), "artifacts/journal")),
  BRIDGE_ENABLED: z
    .string()
    .default("false")
    .transform((value) => value.toLowerCase())
    .pipe(z.enum(["true", "false"]))
    .transform((value) => value === "true"),
  CCTP_SOURCE_DOMAIN: z.string().optional(),
  CCTP_DEST_DOMAIN: z.string().optional(),
  CCTP_USDC_TOKEN_ADDRESS: z.string().optional(),
});

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
  runMode: "paper" | "shadow" | "micro_live";
  starknetRpcUrl: string;
  starknetAccountAddress: string;
  starknetPrivateKey: string;
  avnuApiKey?: string;
  extendedApiKey?: string;
  extendedPublicKey?: string;
  extendedPrivateKey?: string;
  extendedVaultNumber?: number;
  extendedClientId?: number;
  extendedBaseUrl: string;
  extendedApiPrefix: string;
  extendedAccountWsUrl: string;
  extendedFundingWsTemplate: string;
  extendedTestnetBaseUrl: string;
  extendedDefaultRateLimitRpm: number;
  extendedPingIntervalSeconds: number;
  extendedPongTimeoutSeconds: number;
  market: string;
  maxNotionalUsd: number;
  loopIntervalMs: number;
  journalDir: string;
  bridgeEnabled: boolean;
  cctpSourceDomain?: string;
  cctpDestDomain?: string;
  cctpUsdcTokenAddress?: string;
};

type ParseEnvOptions = {
  loadDotenv?: boolean;
  logger?: Logger;
};

function pickEnvValues(env: Record<string, string | undefined>) {
  return {
    NODE_ENV: env.NODE_ENV,
    LOG_LEVEL: env.LOG_LEVEL,
    RUN_MODE: env.RUN_MODE,
    STARKNET_RPC_URL: env.STARKNET_RPC_URL,
    STARKNET_ACCOUNT_ADDRESS: env.STARKNET_ACCOUNT_ADDRESS,
    STARKNET_PRIVATE_KEY: env.STARKNET_PRIVATE_KEY,
    AVNU_API_KEY: env.AVNU_API_KEY,
    EXTENDED_API_KEY: env.EXTENDED_API_KEY,
    EXTENDED_PUBLIC_KEY: env.EXTENDED_PUBLIC_KEY,
    EXTENDED_PRIVATE_KEY: env.EXTENDED_PRIVATE_KEY,
    EXTENDED_VAULT_NUMBER: env.EXTENDED_VAULT_NUMBER,
    EXTENDED_CLIENT_ID: env.EXTENDED_CLIENT_ID,
    EXTENDED_BASE_URL: env.EXTENDED_BASE_URL,
    EXTENDED_API_PREFIX: env.EXTENDED_API_PREFIX,
    EXTENDED_ACCOUNT_WS_URL: env.EXTENDED_ACCOUNT_WS_URL,
    EXTENDED_FUNDING_WS_TEMPLATE: env.EXTENDED_FUNDING_WS_TEMPLATE,
    EXTENDED_TESTNET_BASE_URL: env.EXTENDED_TESTNET_BASE_URL,
    EXTENDED_DEFAULT_RATE_LIMIT_RPM: env.EXTENDED_DEFAULT_RATE_LIMIT_RPM,
    EXTENDED_PING_INTERVAL_SECONDS: env.EXTENDED_PING_INTERVAL_SECONDS,
    EXTENDED_PONG_TIMEOUT_SECONDS: env.EXTENDED_PONG_TIMEOUT_SECONDS,
    MARKET: env.MARKET,
    MAX_NOTIONAL_USD: env.MAX_NOTIONAL_USD,
    LOOP_INTERVAL_MS: env.LOOP_INTERVAL_MS,
    JOURNAL_DIR: env.JOURNAL_DIR,
    BRIDGE_ENABLED: env.BRIDGE_ENABLED,
    CCTP_SOURCE_DOMAIN: env.CCTP_SOURCE_DOMAIN,
    CCTP_DEST_DOMAIN: env.CCTP_DEST_DOMAIN,
    CCTP_USDC_TOKEN_ADDRESS: env.CCTP_USDC_TOKEN_ADDRESS,
  };
}

function mapSchemaToConfig(parsed: z.infer<typeof envSchema>): AppConfig {
  return {
    nodeEnv: parsed.NODE_ENV,
    logLevel: parsed.LOG_LEVEL,
    runMode: parsed.RUN_MODE,
    starknetRpcUrl: parsed.STARKNET_RPC_URL,
    starknetAccountAddress: parsed.STARKNET_ACCOUNT_ADDRESS,
    starknetPrivateKey: parsed.STARKNET_PRIVATE_KEY,
    avnuApiKey: parsed.AVNU_API_KEY,
    extendedApiKey: parsed.EXTENDED_API_KEY,
    extendedPublicKey: parsed.EXTENDED_PUBLIC_KEY,
    extendedPrivateKey: parsed.EXTENDED_PRIVATE_KEY,
    extendedVaultNumber: parsed.EXTENDED_VAULT_NUMBER,
    extendedClientId: parsed.EXTENDED_CLIENT_ID,
    extendedBaseUrl: parsed.EXTENDED_BASE_URL,
    extendedApiPrefix: parsed.EXTENDED_API_PREFIX,
    extendedAccountWsUrl: parsed.EXTENDED_ACCOUNT_WS_URL,
    extendedFundingWsTemplate: parsed.EXTENDED_FUNDING_WS_TEMPLATE,
    extendedTestnetBaseUrl: parsed.EXTENDED_TESTNET_BASE_URL,
    extendedDefaultRateLimitRpm: parsed.EXTENDED_DEFAULT_RATE_LIMIT_RPM,
    extendedPingIntervalSeconds: parsed.EXTENDED_PING_INTERVAL_SECONDS,
    extendedPongTimeoutSeconds: parsed.EXTENDED_PONG_TIMEOUT_SECONDS,
    market: parsed.MARKET,
    maxNotionalUsd: parsed.MAX_NOTIONAL_USD,
    loopIntervalMs: parsed.LOOP_INTERVAL_MS,
    journalDir: parsed.JOURNAL_DIR,
    bridgeEnabled: parsed.BRIDGE_ENABLED,
    cctpSourceDomain: parsed.CCTP_SOURCE_DOMAIN,
    cctpDestDomain: parsed.CCTP_DEST_DOMAIN,
    cctpUsdcTokenAddress: parsed.CCTP_USDC_TOKEN_ADDRESS,
  };
}

export function redactSecrets(env: Record<string, string | undefined>): Record<string, string> {
  const secretPattern = /(PRIVATE_KEY|API_KEY|AUTH_TOKEN|SECRET|CREDENTIAL)/i;
  const redacted: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      continue;
    }
    if (secretPattern.test(key)) {
      redacted[key] = `***${value.slice(-4)}`;
      continue;
    }
    redacted[key] = value;
  }
  return redacted;
}

export function parseEnv(
  rawEnv: Record<string, string | undefined> = process.env,
  options: ParseEnvOptions = {},
): AppConfig {
  if (options.loadDotenv ?? true) {
    loadDotEnv();
  }

  const logger = options.logger ?? createLogger({ component: "config" });
  const selected = pickEnvValues(rawEnv);
  logger.debug(
    { env: redactSecrets(selected), message: "Raw env snapshot collected." },
    "Loaded candidate environment values.",
  );

  const parsed = envSchema.safeParse(selected);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    logger.error(
      { issues: parsed.error.issues, message: "Environment validation failed." },
      "Invalid environment configuration.",
    );
    throw new Error(`Environment validation failed: ${details}`);
  }

  const config = mapSchemaToConfig(parsed.data);
  logger.debug(
    {
      nodeEnv: config.nodeEnv,
      runMode: config.runMode,
      market: config.market,
      extendedBaseUrl: config.extendedBaseUrl,
      extendedApiPrefix: config.extendedApiPrefix,
      extendedDefaultRateLimitRpm: config.extendedDefaultRateLimitRpm,
      loopIntervalMs: config.loopIntervalMs,
      maxNotionalUsd: config.maxNotionalUsd,
      bridgeEnabled: config.bridgeEnabled,
      journalDir: config.journalDir,
    },
    "Environment configuration parsed successfully.",
  );

  return config;
}
