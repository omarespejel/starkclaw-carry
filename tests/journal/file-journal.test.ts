import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createFileJournal } from "../../src/journal/file-journal.js";

describe("FileJournal", () => {
  it("writes append-only NDJSON events with deterministic pathing", async () => {
    const root = await mkdtemp(join(tmpdir(), "starkclaw-carry-journal-"));
    const journal = await createFileJournal({
      rootDir: root,
      runId: "run-abc",
    });

    await journal.append({
      runId: "run-abc",
      timestamp: "2026-03-11T00:00:00.000Z",
      level: "info",
      component: "risk_engine",
      eventType: "risk.guard",
      message: "All checks passed",
      data: {
        maxNotionalUsd: 1000,
      },
    });

    await journal.append({
      runId: "run-abc",
      timestamp: "2026-03-11T00:00:01.000Z",
      level: "warn",
      component: "risk_engine",
      eventType: "risk.drift",
      message: "Drift threshold breached.",
      data: {
        driftPct: 2.12,
      },
    });

    const output = await readFile(journal.filePath, "utf8");
    const lines = output.trim().split("\n");
    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0]) as { eventType: string };
    const second = JSON.parse(lines[1]) as { eventType: string };

    expect(first.eventType).toBe("risk.guard");
    expect(second.eventType).toBe("risk.drift");

    await journal.close();
  });

  it("rejects event writes with mismatched run ids", async () => {
    const root = await mkdtemp(join(tmpdir(), "starkclaw-carry-journal-"));
    const journal = await createFileJournal({
      rootDir: root,
      runId: "run-expected",
    });

    await expect(
      journal.append({
        runId: "run-other",
        timestamp: "2026-03-11T00:00:00.000Z",
        level: "error",
        component: "reconciler",
        eventType: "risk.fatal",
        message: "run id mismatch",
        data: {},
      }),
    ).rejects.toThrowError(/runId mismatch/i);

    await journal.close();
  });
});
