import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  ApiErrorSchema,
  ApiResultSchema,
  ApiSuccessSchema,
  ConversationSchema,
  EnsureConversationResponseSchema,
  JobLogEntrySchema,
  JobStatusSchema,
  MessageRoleSchema,
  MessageSchema,
  ProjectSchema,
  ProvisionJobSchema,
  TaskSchema,
  TaskStatusSchema,
} from "../src/index.js";

describe("ApiErrorSchema", () => {
  it("parses a minimal error", () => {
    const out = ApiErrorSchema.parse({ ok: false, error: "Nope" });
    expect(out.error).toBe("Nope");
  });

  it("parses a full error with code + status + details", () => {
    const out = ApiErrorSchema.parse({
      ok: false,
      status: 409,
      code: "AGENT_NAME_TAKEN",
      error: "Agent name is taken",
      details: { name: "MyAgent" },
    });
    expect(out.code).toBe("AGENT_NAME_TAKEN");
    expect(out.status).toBe(409);
  });

  it("rejects a missing error message", () => {
    expect(() => ApiErrorSchema.parse({ ok: false })).toThrow();
  });
});

describe("ApiSuccessSchema + ApiResultSchema", () => {
  const inner = z.object({ name: z.string() });
  const Success = ApiSuccessSchema(inner);
  const Result = ApiResultSchema(inner);

  it("parses a success envelope", () => {
    const out = Success.parse({ ok: true, data: { name: "x" } });
    expect(out.data.name).toBe("x");
  });

  it("narrows via the ApiResult discriminated union", () => {
    const ok = Result.parse({ ok: true, data: { name: "x" } });
    if (ok.ok) {
      expect(ok.data.name).toBe("x");
    } else {
      throw new Error("should not be the error branch");
    }

    const err = Result.parse({ ok: false, error: "boom" });
    if (!err.ok) {
      expect(err.error).toBe("boom");
    } else {
      throw new Error("should not be the success branch");
    }
  });

  it("rejects success without data", () => {
    expect(() => Success.parse({ ok: true })).toThrow();
  });
});

describe("ProjectSchema + TaskSchema", () => {
  it("parses a project", () => {
    const out = ProjectSchema.parse({
      id: "p1",
      name: "Launch",
      status: "Active",
      agents: 2,
      tasks: 5,
      budget: "0 USDC",
    });
    expect(out.name).toBe("Launch");
  });

  it("rejects negative task counters", () => {
    expect(() =>
      ProjectSchema.parse({
        name: "p",
        status: "Active",
        agents: 0,
        tasks: -1,
        budget: "0 USDC",
      }),
    ).toThrow();
  });

  it("parses a task with the documented status enum", () => {
    const out = TaskSchema.parse({
      name: "Write spec",
      status: "Backlog",
      priority: "Medium",
      agent: "App Agent",
    });
    expect(out.status).toBe("Backlog");
  });

  it("rejects an unknown task status (canonical enum is strict)", () => {
    expect(() =>
      TaskSchema.parse({
        name: "X",
        status: "Wishlist",
        priority: "Medium",
        agent: "App Agent",
      }),
    ).toThrow();
  });

  it("TaskStatusSchema enumerates the documented states", () => {
    expect(TaskStatusSchema.options).toEqual([
      "Backlog",
      "In progress",
      "Review",
      "Done",
    ]);
  });
});

describe("ProvisionJobSchema + JobLogEntrySchema", () => {
  it("parses a pending job with no result", () => {
    const out = ProvisionJobSchema.parse({
      jobId: "j1",
      status: "pending",
      walletAddress: "0xabc",
      agentId: "a1",
      agentName: "MyAgent",
      input: {
        runtime: "Hermes",
        imageTag: "hermes-2026-05-27",
        llmSource: "perkos",
      },
      claimedBy: null,
      attempts: 0,
      result: null,
      error: null,
    });
    expect(out.status).toBe("pending");
  });

  it("parses a ready job result", () => {
    const out = ProvisionJobSchema.parse({
      jobId: "j1",
      status: "ready",
      walletAddress: "0xabc",
      agentId: "a1",
      agentName: "MyAgent",
      input: {
        runtime: "Hermes",
        imageTag: "hermes-2026-05-27",
        llmSource: "byok",
      },
      claimedBy: "worker-1",
      attempts: 1,
      result: {
        serviceArn: "arn:aws:ecs:us-east-1:089332276762:service/perkos-agents/agent-foo",
        taskDefinitionArn: "arn:aws:ecs:us-east-1:089332276762:task-definition/agent-foo:1",
        imageUri: "089332276762.dkr.ecr.us-east-1.amazonaws.com/perkos-hermes:tag",
        llmKeyLast4: "abcd",
      },
      error: null,
    });
    expect(out.result?.llmKeyLast4).toBe("abcd");
  });

  it("rejects an unknown status", () => {
    expect(() =>
      ProvisionJobSchema.parse({
        jobId: "j1",
        status: "weird",
        walletAddress: "0xabc",
        agentId: "a1",
        agentName: "MyAgent",
        input: { runtime: "Hermes", imageTag: "t", llmSource: "perkos" },
        claimedBy: null,
        attempts: 0,
        result: null,
        error: null,
      }),
    ).toThrow();
  });

  it("JobStatusSchema documents the worker lifecycle", () => {
    expect(JobStatusSchema.options).toEqual([
      "pending",
      "claimed",
      "running",
      "ready",
      "failed",
    ]);
  });

  it("parses a job log entry", () => {
    const out = JobLogEntrySchema.parse({
      ts: new Date().toISOString(),
      level: "info",
      message: "claimed",
    });
    expect(out.level).toBe("info");
  });
});

describe("ConversationSchema + MessageSchema", () => {
  it("parses a DM conversation", () => {
    const out = ConversationSchema.parse({
      id: "c1",
      title: "PerkOS Assistant",
      kind: "dm",
      participants: ["user:0xabc", "agent:PerkOS-Assistant"],
      historyHost: "agent:PerkOS-Assistant",
      pinned: true,
      archived: false,
    });
    expect(out.kind).toBe("dm");
  });

  it("rejects an identity missing the prefix", () => {
    expect(() =>
      ConversationSchema.parse({
        id: "c1",
        title: "x",
        kind: "dm",
        participants: ["0xabc", "agent:Foo"],
        historyHost: "agent:Foo",
        pinned: false,
        archived: false,
      }),
    ).toThrow();
  });

  it("parses a message", () => {
    const out = MessageSchema.parse({
      id: "m1",
      from: "user:0xabc",
      text: "hi",
      timestamp: new Date().toISOString(),
    });
    expect(out.text).toBe("hi");
  });

  it("MessageRoleSchema accepts user + assistant", () => {
    expect(MessageRoleSchema.parse("user")).toBe("user");
    expect(MessageRoleSchema.parse("assistant")).toBe("assistant");
    expect(() => MessageRoleSchema.parse("system")).toThrow();
  });
});

describe("EnsureConversationResponseSchema", () => {
  it("parses the concierge ensure-conv response", () => {
    const out = EnsureConversationResponseSchema.parse({
      convId: "assistant-0xabc",
      historyHost: "agent:PerkOS-Assistant",
    });
    expect(out.convId).toBe("assistant-0xabc");
  });

  it("parses the per-agent ensure-conv response (with agentName)", () => {
    const out = EnsureConversationResponseSchema.parse({
      convId: "agent-0xabc-MyAgent",
      historyHost: "agent:MyAgent",
      agentName: "MyAgent",
    });
    expect(out.agentName).toBe("MyAgent");
  });
});
