import { describe, expect, it } from "vitest";

import {
  ExecutionEventV1Schema,
  executionEventDedupeKey,
  parseExecutionEvent,
} from "../src/execution-events.js";

const base = {
  schemaVersion: 1 as const,
  eventId: "evt-1",
  type: "task.started" as const,
  wallet: "0x123",
  projectId: "project-1",
  runId: "run-1",
  traceId: "trace-1",
  spanId: "span-1",
  sequence: 3,
  occurredAt: "2026-10-07T01:00:00.000Z",
  recordedAt: "2026-10-07T01:00:00.100Z",
  source: "tools" as const,
  actor: { type: "agent" as const, id: "researcher" },
  subject: { type: "task" as const, id: "task-1", label: "Research" },
  status: "running" as const,
  visibility: "project" as const,
  dedupeKey: "task:task-1:attempt:1:started",
  payload: { taskId: "task-1", assigneeId: "researcher" },
};

describe("ExecutionEventV1Schema", () => {
  it("accepts a canonical task event", () => {
    expect(ExecutionEventV1Schema.parse(base)).toEqual(base);
  });

  it("rejects sensitive or uncontracted payload keys", () => {
    expect(() => ExecutionEventV1Schema.parse({
      ...base,
      payload: { taskId: "task-1", claimToken: "secret" },
    })).toThrow();
  });

  it("rejects a payload from the wrong event family", () => {
    expect(() => ExecutionEventV1Schema.parse({
      ...base,
      type: "tool.started",
      payload: { taskId: "task-1", assigneeId: "researcher" },
    })).toThrow();
  });

  it("reports an unknown schema version without throwing", () => {
    expect(parseExecutionEvent({ ...base, schemaVersion: 2 })).toEqual({
      ok: false,
      reason: "unsupported_version",
    });
  });
});

describe("executionEventDedupeKey", () => {
  it("builds the stable transition key", () => {
    expect(executionEventDedupeKey(["task", "task-1", "attempt", 2, "dispatch-delivered"]))
      .toBe("task:task-1:attempt:2:dispatch-delivered");
  });
});
