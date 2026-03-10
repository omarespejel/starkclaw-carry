import { z } from "zod";

export const JournalLevelSchema = z.enum(["debug", "info", "warn", "error"]);

export const JournalEventSchema = z.object({
  runId: z.string().min(1),
  timestamp: z.iso.datetime(),
  level: JournalLevelSchema,
  component: z.string().min(1),
  eventType: z.string().regex(/^[a-z0-9_.-]+$/),
  message: z.string().min(1),
  data: z.record(z.string(), z.unknown()).default({}),
});

export type JournalEvent = z.infer<typeof JournalEventSchema>;

export function validateJournalEvent(event: unknown): JournalEvent {
  return JournalEventSchema.parse(event);
}
