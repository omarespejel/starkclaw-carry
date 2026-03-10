import pino, { type Logger, type LoggerOptions } from "pino";

export type AppLogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

const DEFAULT_LOG_LEVEL: AppLogLevel = "debug";

export function createLogger(
  context: { service?: string; component?: string; level?: AppLogLevel } = {},
): Logger {
  const options: LoggerOptions = {
    level: context.level ?? DEFAULT_LOG_LEVEL,
    base: {
      service: context.service ?? "starkclaw-carry",
      component: context.component ?? "runtime",
    },
    redact: {
      paths: [
        "*.privateKey",
        "*.apiKey",
        "*.authToken",
        "*.credentialPrivateKeyPem",
        "env.STARKNET_PRIVATE_KEY",
        "env.EXTENDED_API_KEY",
        "env.AVNU_API_KEY",
        "env.DFNS_AUTH_TOKEN",
        "env.DFNS_CREDENTIAL_PRIVATE_KEY_PEM",
      ],
      censor: "***redacted***",
    },
  };

  return pino(options);
}

export const rootLogger = createLogger({ component: "bootstrap" });
