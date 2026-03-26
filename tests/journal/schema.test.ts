import { describe, expect, it } from "vitest";

import {
  JournalEventSchema,
  type JournalEvent,
  validateJournalEvent,
} from "../../src/journal/schema.js";

describe("JournalEventSchema", () => {
  const validEvent: JournalEvent = {
    runId: "run-123",
    timestamp: "2026-03-11T00:00:00.000Z",
    level: "info",
    component: "decision_engine",
    eventType: "engine.decision",
    message: "Decision made.",
    data: {
      decision: "ENTER",
      expectedEdgeBps: 12.4,
    },
  };

  it("accepts valid events", () => {
    const parsed = JournalEventSchema.parse(validEvent);
    expect(parsed.eventType).toBe("engine.decision");
    expect(parsed.data.decision).toBe("ENTER");
  });

  it("rejects invalid events", () => {
    expect(() =>
      validateJournalEvent({
        ...validEvent,
        level: "verbose",
      } as unknown as JournalEvent),
    ).toThrowError(/level/i);
  });
});
