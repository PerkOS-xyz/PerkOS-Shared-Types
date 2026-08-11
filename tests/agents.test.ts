import { describe, expect, it } from "vitest";

import {
  AgentGatewayRecordSchema,
  AgentProfileUpdateSchema,
  RuntimeChannelCapabilitySchema,
  AgentRuntimeSchema,
  AgentSchema,
  AgentStatusSchema,
  DeployBundleSchema,
  DeployModeSchema,
  GatewayTypeSchema,
  GatewayUpsertInputSchema,
  HeartbeatRequestSchema,
  HeartbeatResponseSchema,
  HibernationStateSchema,
  HibernationStatusSchema,
  LaunchAgentRequestSchema,
  LaunchAgentResponseSchema,
  LiveEcsStatusSchema,
  RuntimeImageSchema,
  RuntimeKindSchema,
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

describe("AgentProfileUpdateSchema", () => {
  it("accepts owner-editable profile fields without operational identity", () => {
    expect(AgentProfileUpdateSchema.parse({
      displayName: "Research lead",
      soul: "Use primary sources.",
      plugins: ["web-search"],
      skillIds: ["research"],
      disabledTools: ["code-execution"],
    })).toMatchObject({ displayName: "Research lead" });
  });

  it("rejects empty patches, unknown fields, and runtime identity changes", () => {
    expect(() => AgentProfileUpdateSchema.parse({})).toThrow();
    expect(() => AgentProfileUpdateSchema.parse({ name: "new-relay-name" })).toThrow();
    expect(() => AgentProfileUpdateSchema.parse({ relayApiKey: "secret" })).toThrow();
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

describe("RuntimeChannelCapabilitySchema", () => {
  it("models a framework-specific Telegram transport", () => {
    const out = RuntimeChannelCapabilitySchema.parse({
      adapterId: "hermes.telegram.polling.v1",
      framework: "Hermes",
      provider: "telegram",
      label: "Telegram · Hermes polling",
      transportMode: "polling",
      managementMode: "runtime-native",
      loginMode: "token",
      requiresAlwaysOn: true,
      requiresPersistentStorage: false,
      supportsManagedRelay: false,
      fields: [
        {
          key: "botToken",
          label: "Bot token",
          required: true,
          secret: true,
          input: "password",
        },
      ],
    });
    expect(out.framework).toBe("Hermes");
    expect(out.transportMode).toBe("polling");
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

// ---------------------------------------------------------------------------
// 0.2.0 — BYO deploy modes
// ---------------------------------------------------------------------------

describe("DeployModeSchema", () => {
  it("accepts the canonical 0.2 values", () => {
    for (const m of ["perkos-managed", "self-hosted", "imported"] as const) {
      expect(DeployModeSchema.parse(m)).toBe(m);
    }
  });
  it("accepts the legacy aliases for back-compat", () => {
    expect(DeployModeSchema.parse("vps")).toBe("vps");
    expect(DeployModeSchema.parse("local")).toBe("local");
  });
  it("rejects unknown deploy modes", () => {
    expect(() => DeployModeSchema.parse("kubernetes")).toThrow();
  });
});

describe("RuntimeKindSchema", () => {
  it("accepts hermes / openclaw / custom", () => {
    for (const k of ["hermes", "openclaw", "custom"] as const) {
      expect(RuntimeKindSchema.parse(k)).toBe(k);
    }
  });
  it("rejects unknown kinds", () => {
    expect(() => RuntimeKindSchema.parse("Hermes")).toThrow();
  });
});

describe("AgentSchema 0.2 additions", () => {
  it("accepts a self-hosted agent with bridge state", () => {
    const a = AgentSchema.parse({
      id: "a1",
      name: "Bob",
      runtime: "Hermes",
      status: "ready",
      walletAddress: "0x" + "b".repeat(40),
      plugins: [],
      deployMode: "self-hosted",
      bridgeConnected: true,
      lastBridgeSeenAt: new Date().toISOString(),
      runtimeVersion: "0.12.1",
    });
    expect(a.deployMode).toBe("self-hosted");
    expect(a.bridgeConnected).toBe(true);
  });
  it("accepts an imported agent with runtimeKind", () => {
    const a = AgentSchema.parse({
      id: "a2",
      name: "Carol",
      runtime: "Hermes",
      status: "ready",
      walletAddress: "0x" + "c".repeat(40),
      plugins: [],
      deployMode: "imported",
      runtimeKind: "hermes",
    });
    expect(a.runtimeKind).toBe("hermes");
  });
});

describe("LaunchAgentRequestSchema 0.2 additions", () => {
  it("parses a self-hosted launch request", () => {
    const r = LaunchAgentRequestSchema.parse({
      walletAddress: "0x" + "a".repeat(40),
      runtime: "Hermes",
      name: "TestAgent",
      deployMode: "self-hosted",
    });
    expect(r.deployMode).toBe("self-hosted");
  });
  it("parses an imported launch request with custom HERMES_API_URL", () => {
    const r = LaunchAgentRequestSchema.parse({
      walletAddress: "0x" + "a".repeat(40),
      runtime: "Hermes",
      name: "TestAgent",
      deployMode: "imported",
      runtimeKind: "hermes",
      hermesApiUrl: "http://localhost:9090",
    });
    expect(r.hermesApiUrl).toBe("http://localhost:9090");
  });
});

describe("DeployBundleSchema", () => {
  it("parses a minimal bundle", () => {
    const b = DeployBundleSchema.parse({
      composeYaml: "services:\n  bridge: {}\n",
      envFile: "A2A_AGENT_NAME=Test\n",
      instructions: "# Run\n\n```docker compose up -d\n```\n",
    });
    expect(b.composeYaml).toContain("bridge");
  });
  it("accepts the optional dockerRunCommand", () => {
    const b = DeployBundleSchema.parse({
      composeYaml: "x",
      envFile: "y",
      instructions: "z",
      dockerRunCommand: "docker run --rm perkos/a2a",
    });
    expect(b.dockerRunCommand).toContain("docker run");
  });
});

describe("LaunchAgentResponseSchema with deployBundle", () => {
  it("parses a self-hosted response carrying a bundle", () => {
    const out = LaunchAgentResponseSchema.parse({
      ok: true,
      launchId: "abc",
      credentials: {
        agentName: "MyAgent",
        relayApiKey: "rk_abc",
        chatUrl: "wss://chat.perkos.xyz/chat",
        transportUrl: "wss://transport.perkos.xyz/a2a",
      },
      deployBundle: {
        composeYaml: "services:\n  bridge: {}\n",
        envFile: "FOO=BAR\n",
        instructions: "Run it.",
      },
      result: {
        mode: "self-hosted",
        status: "ready",
      },
    });
    expect(out.deployBundle?.envFile).toContain("FOO=BAR");
  });
});

describe("HeartbeatRequestSchema + HeartbeatResponseSchema", () => {
  it("parses a valid heartbeat payload", () => {
    const h = HeartbeatRequestSchema.parse({
      runtimeKind: "hermes",
      version: "0.12.1",
      ts: Date.now(),
      runtimeStatus: "healthy",
    });
    expect(h.runtimeKind).toBe("hermes");
    expect(h.runtimeStatus).toBe("healthy");
  });
  it("rejects a non-integer ts", () => {
    expect(() =>
      HeartbeatRequestSchema.parse({
        runtimeKind: "hermes",
        version: "0.12.1",
        ts: 1.5,
      }),
    ).toThrow();
  });
  it("parses the response shape", () => {
    expect(HeartbeatResponseSchema.parse({ ok: true }).ok).toBe(true);
  });
  it("keeps legacy heartbeats compatible but rejects invented runtime states", () => {
    expect(HeartbeatRequestSchema.parse({
      runtimeKind: "openclaw",
      version: "0.12.48",
      ts: 1,
    }).runtimeStatus).toBeUndefined();
    expect(() => HeartbeatRequestSchema.parse({
      runtimeKind: "custom",
      version: "1.0.0",
      ts: 1,
      runtimeStatus: "connected",
    })).toThrow();
  });
});
