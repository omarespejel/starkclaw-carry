import { mkdir, open, type FileHandle } from "node:fs/promises";
import { join } from "node:path";

import type { Logger } from "pino";

import { createLogger } from "../logging/logger.js";
import { type JournalEvent, validateJournalEvent } from "./schema.js";

export type CreateFileJournalOptions = {
  rootDir: string;
  runId: string;
  logger?: Logger;
  syncOnWrite?: boolean;
};

export type FileJournal = {
  filePath: string;
  append: (event: JournalEvent) => Promise<void>;
  close: () => Promise<void>;
};

async function ensureDirectories(rootDir: string, runId: string): Promise<string> {
  const runDirectory = join(rootDir, runId);
  await mkdir(runDirectory, { recursive: true });
  return runDirectory;
}

async function writeLine(
  handle: FileHandle,
  line: string,
  syncOnWrite: boolean,
  logger: Logger,
  eventType: string,
): Promise<void> {
  await handle.appendFile(line, "utf8");
  if (syncOnWrite) {
    await handle.sync();
  }
  logger.debug(
    {
      bytesWritten: Buffer.byteLength(line),
      eventType,
      syncOnWrite,
    },
    "Journal line appended.",
  );
}

export async function createFileJournal(options: CreateFileJournalOptions): Promise<FileJournal> {
  const logger = options.logger ?? createLogger({ component: "journal" });
  const syncOnWrite = options.syncOnWrite ?? true;

  logger.debug(
    {
      rootDir: options.rootDir,
      runId: options.runId,
      syncOnWrite,
    },
    "Initializing file journal.",
  );

  const runDirectory = await ensureDirectories(options.rootDir, options.runId);
  const filePath = join(runDirectory, "events.ndjson");
  const handle = await open(filePath, "a");

  logger.debug(
    {
      runDirectory,
      filePath,
    },
    "File journal opened.",
  );

  let writeChain: Promise<void> = Promise.resolve();

  return {
    filePath,
    append(event: JournalEvent): Promise<void> {
      const validated = validateJournalEvent(event);
      if (validated.runId !== options.runId) {
        logger.error(
          {
            expectedRunId: options.runId,
            actualRunId: validated.runId,
          },
          "Rejected journal event due to runId mismatch.",
        );
        return Promise.reject(
          new Error(`Journal runId mismatch. expected=${options.runId} actual=${validated.runId}`),
        );
      }

      const payload = `${JSON.stringify(validated)}\n`;
      logger.debug(
        {
          eventType: validated.eventType,
          level: validated.level,
          component: validated.component,
        },
        "Queueing journal append operation.",
      );

      writeChain = writeChain.then(() =>
        writeLine(handle, payload, syncOnWrite, logger, validated.eventType),
      );
      return writeChain;
    },
    async close(): Promise<void> {
      await writeChain;
      await handle.close();
      logger.debug({ filePath }, "File journal handle closed.");
    },
  };
}
