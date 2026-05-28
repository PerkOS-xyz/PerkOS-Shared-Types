import { describe, expect, it } from "vitest";

import {
  AgentGatewayRecordSchema,
  AgentRuntimeSchema,
  AgentSchema,
  AgentStatusSchema,
  GatewayTypeSchema,
  GatewayUpsertInputSchema,
  HibernationStateSchema,
  HibernationStatusSchema,
  LaunchAgentRequestSchema,
  LaunchAgentResponseSchema,
  LiveEcsStatusSchema,
  RuntimeImageSchema,
  RuntimesListResponseSchema,
} from "../src/index.js";

describe("AgentRuntimeSchema", () => {
  it("accepts OpenClaw and Hermes", () => {
    expect(AgentRuntimeSchema.parse("OpenClaw")).toBe("OpenClaw");
    expect(AgentRuntimeSchema.parse("Hermes")).toBe("Hermes");
  });
  it("rejects lowercase variants", () => {
    expect(() => AgentRuntimeSchema.parse("hermes")).toThrow();
  });
});

describe("AgentStatusSchema", () => {
  it("accepts the documented enum", () => {
    for (const s of ["provisioning", "ready", "failed", "unknown"] as const) {
      expect(AgentStatusSchema.parse(s)).toBe(s);
    }
  });
});

describe("AgentSchema", () => {
  it("parses a minimal agent", () => {
    const a = AgentSchema.parse({
      id: "abc",
      name: "PerkOS-Assistant",
      runtime: "Hermes",
      status: "ready",
      walletAddress: "0x" + "a".repeat(40),
      plugins: [],
    });
    expect(a.id).toBe("abc");
    expect(a.modelKeyProvided).toBeUndefined();
  });

  it("defaults plugins to []", () => {
    const a = AgentSchema.parse({
      id: "abc",
      name: "Foo",
      runtime: "OpenClaw",
      status: "provisioning",
      walletAddress: "0x" + "a".repeat(40),
    });
    expect(a.plugins).toEqual([]);
  });

  it("rejects missing id", () => {
    expect(() =>
      AgentSchema.parse({
        name: "Foo",
        runtime: "Hermes",
        status: "ready",
        walletAddress: "0x" + "a".repeat(40),
      }),
    ).toThrow();
  });
});

describe("RuntimeImageSchema + RuntimesListResponseSchema", () => {
  it("parses an admin-curated runtime image", () => {
    const img = RuntimeImageSchema.parse({
      runtime: "Hermes",
      primaryTag: "hermes-2026-05-27",
      displayName: "Hermes 2026.05",
      notes: null,
    });
    expect(img.primaryTag).toBe("hermes-2026-05-27");
  });

  it("requires non-empty primaryTag", () => {
    expect(() =>
      RuntimeImageSchema.parse({
        runtime: "Hermes",
        primaryTag: "",
        displayName: null,
        notes: null,
      }),
    ).toThrow();
  });

  it("parses a /api/runtimes list response", () => {
    const list = RuntimesListResponseSchema.parse({
      runtimes: [
        {
          runtime: "OpenClaw",
          primaryTag: "openclaw-2026-05-27",
          displayName: null,
          notes: null,
        },
      ],
    });
    expect(list.runtimes).toHaveLength(1);
  });
});

describe("GatewayTypeSchema + AgentGatewayRecordSchema", () => {
  it("accepts the three known gateway types", () => {
    expect(GatewayTypeSchema.parse("telegram")).toBe("telegram");
    expect(GatewayTypeSchema.parse("farcaster")).toBe("farcaster");
    expect(GatewayTypeSchema.parse("slack")).toBe("slack");
  });

  it("parses a Telegram gateway record", () => {
    const rec = AgentGatewayRecordSchema.parse({
      type: "telegram",
      enabled: true,
      nonSecretConfig: { webhookUrl: "https://example.com/wh" },
      secretsProvided: ["botToken"],
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(rec.secretsProvided).toContain("botToken");
  });

  it("rejects unknown gateway status", () => {
    expect(() =>
      AgentGatewayRecordSchema.parse({
        type: "slack",
        enabled: false,
        nonSecretConfig: {},
        secretsProvided: [],
        status: "exploded",
        createdAt: "x",
        updatedAt: "y",
      }),
    ).toThrow();
  });
});

describe("GatewayUpsertInputSchema", () => {
  it("parses a Farcaster enable with secrets stripped at the boundary", () => {
    const out = GatewayUpsertInputSchema.parse({
      type: "farcaster",
      enabled: true,
      nonSecretConfig: { fid: "12345" },
      secrets: {
        neynarApiKey: "NEY...",
        signerUuid: "uuid",
        webhookSecret: "wh",
      },
    });
    expect(out.type).toBe("farcaster");
    expect(out.secrets?.neynarApiKey).toBe("NEY...");
  });
});

describe("HibernationStateSchema + HibernationStatusSchema", () => {
  it("accepts every state", () => {
    for (const s of ["active", "hibernating", "hibernated", "waking"] as const) {
      expect(HibernationStateSchema.parse(s)).toBe(s);
    }
  });

  it("parses a hibernated status", () => {
    const s = HibernationStatusSchema.parse({
      state: "hibernated",
      desiredCount: 0,
      runningCount: 0,
      pendingCount: 0,
      snapshot: { bucket: "b", prefix: "p/" },
    });
    expect(s.state).toBe("hibernated");
  });
});

describe("LiveEcsStatusSchema", () => {
  it("parses an online service", () => {
    const out = LiveEcsStatusSchema.parse({
      serviceName: "agent-c2563c4d-foo",
      exists: true,
      status: "ACTIVE",
      desiredCount: 1,
      runningCount: 1,
      pendingCount: 0,
      online: true,
    });
    expect(out.online).toBe(true);
  });

  it("parses a missing-service result", () => {
    const out = LiveEcsStatusSchema.parse({
      serviceName: "agent-deadbeef-bar",
      exists: false,
      online: false,
    });
    expect(out.exists).toBe(false);
  });
});

describe("LaunchAgentRequestSchema + LaunchAgentResponseSchema", () => {
  it("parses a valid launch request", () => {
    const out = LaunchAgentRequestSchema.parse({
      walletAddress: "0x" + "a".repeat(40),
      runtime: "Hermes",
      name: "MyAgent",
      plugins: ["chat"],
      imageTag: "hermes-2026-05-27",
    });
    expect(out.name).toBe("MyAgent");
  });

  it("rejects names with spaces", () => {
    expect(() =>
      LaunchAgentRequestSchema.parse({
        walletAddress: "0x" + "a".repeat(40),
        runtime: "Hermes",
        name: "Agent With Space",
      }),
    ).toThrow();
  });

  it("parses a successful launch response", () => {
    const out = LaunchAgentResponseSchema.parse({
      ok: true,
      launchId: "abc",
      credentials: {
        agentName: "MyAgent",
        relayApiKey: "rk_abc",
        chatUrl: "wss://chat.perkos.xyz/chat",
        transportUrl: "wss://transport.perkos.xyz/a2a",
      },
      result: {
        mode: "byok",
        status: "provisioning",
        jobId: "job-123",
      },
    });
    expect(out.credentials?.relayApiKey).toBe("rk_abc");
  });
});
