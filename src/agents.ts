/**
 * Agent identity, runtime, gateways, and admin-curated runtime images.
 *
 * Reconciled from:
 *   - PerkOS/app/lib/perkosApi.ts                 (Agent, AgentRuntime)
 *   - PerkOS/app/lib/runtimeImages.ts             (RuntimeImage)
 *   - PerkOS/app/lib/agentGateways.ts             (GatewayType, AgentGatewayRecord, GATEWAY_CATALOG)
 *   - PerkOS-Admin/app/lib/ecsStatus.ts           (LiveEcsStatus)
 *
 * Field-level reconciliation notes:
 *   - `Agent.runtime`: App used `AgentRuntime = "OpenClaw" | "Hermes"`. The
 *     canonical platform shape is that union — admin had no narrower take.
 *   - `Agent.status`: App used a 4-state union ("provisioning" | "ready" |
 *     "failed" | "unknown"). Hibernation introduced its own orthogonal state
 *     enum (HibernationApiState). We keep the two enums separate; an agent
 *     may be `status: "ready"` while `hibernation.state: "hibernated"`.
 *   - `RuntimeImage`: identical between App and Admin reads of
 *     /runtime_images. Admin owns the write path (extra `active` flag), but
 *     the public-shaped record exported here is what /api/runtimes returns.
 */

import { z } from "zod";

import { AddressSchema } from "./auth.js";

// ---------------------------------------------------------------------------
// Runtime kind
// ---------------------------------------------------------------------------

/**
 * Agent runtime kind. User-facing capitalization preserved (it's what the
 * wizard and the Firestore agent docs already store).
 */
export const AgentRuntimeSchema = z.enum(["OpenClaw", "Hermes"]);
export type AgentRuntime = z.infer<typeof AgentRuntimeSchema>;

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export const AgentStatusSchema = z.enum([
  "provisioning",
  "ready",
  "failed",
  "unknown",
]);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

/**
 * Where the runtime physically lives.
 *
 *   - "perkos-managed" — PerkOS provisions Fargate (ECS) for the agent.
 *   - "self-hosted"    — the user runs the whole stack (Hermes/OpenClaw +
 *                        bridge sidecar) on their own host via a generated
 *                        docker-compose bundle.
 *   - "imported"       — the user already has a runtime process running.
 *                        We only ship the bridge sidecar config.
 *
 * Two legacy values are still accepted so existing Firestore docs parse:
 *
 *   - "vps"            — pre-0.2 alias for the old SSH-push flow. Replaced
 *                        by "self-hosted". Old docs may still carry it; the
 *                        wizard never emits it anymore.
 *   - "local"          — pre-0.2 alias for "agent runs on user's laptop".
 *                        Functionally identical to "self-hosted" from the
 *                        platform's perspective (bridge dials out either
 *                        way); kept here for back-compat.
 */
export const DeployModeSchema = z.enum([
  "perkos-managed",
  "self-hosted",
  "imported",
  "vps",
  "local",
]);
export type DeployMode = z.infer<typeof DeployModeSchema>;

/**
 * Which kind of agent process the user is bridging in. Only meaningful
 * for `deployMode: "imported"` — for self-hosted we ship the runtime
 * container ourselves and the kind is implied by `runtime`.
 */
export const RuntimeKindSchema = z.enum(["hermes", "openclaw", "custom"]);
export type RuntimeKind = z.infer<typeof RuntimeKindSchema>;

/**
 * Per-wallet agent record under /wallets/{walletAddress}/agents/{id}.
 *
 * Doubles as the shape returned by /api/agents/launch.result.agent — the
 * server replies with this same projection so the wizard can hydrate the
 * UI without a second fetch.
 */
export const AgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  runtime: AgentRuntimeSchema,
  status: AgentStatusSchema,
  walletAddress: z.string(),
  plugins: z.array(z.string()).default([]),
  taskArn: z.string().optional(),
  endpoint: z.string().optional(),
  /** ISO 8601 timestamp string. */
  createdAt: z.string().optional(),
  /** Full image URI the runtime is pinned to. */
  image: z.string().optional(),
  /** Whether the agent has a BYOK model key stored in /agent_secrets/. */
  modelKeyProvided: z.boolean().optional(),
  /** Where the runtime physically lives. New in 0.2.0. */
  deployMode: DeployModeSchema.optional(),
  /** Only set when deployMode === "imported". New in 0.2.0. */
  runtimeKind: RuntimeKindSchema.optional(),
  /** Flipped to true by /agents/:id/heartbeat. New in 0.2.0. */
  bridgeConnected: z.boolean().optional(),
  /** ISO 8601 timestamp of the last bridge ping. New in 0.2.0. */
  lastBridgeSeenAt: z.string().optional(),
  /** perkos-a2a npm version the bridge advertised. New in 0.2.0. */
  runtimeVersion: z.string().optional(),
});
export type Agent = z.infer<typeof AgentSchema>;

// ---------------------------------------------------------------------------
// Hibernation
// ---------------------------------------------------------------------------

export const HibernationStateSchema = z.enum([
  "active",
  "hibernating",
  "hibernated",
  "waking",
]);
export type HibernationState = z.infer<typeof HibernationStateSchema>;

export const HibernationStatusSchema = z.object({
  state: HibernationStateSchema,
  desiredCount: z.number().int().nonnegative(),
  runningCount: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  snapshot: z.object({
    bucket: z.string(),
    prefix: z.string(),
    key: z.string().optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
  }),
  hibernatedAt: z.string().optional(),
  wakeStartedAt: z.string().optional(),
  note: z.string().optional(),
});
export type HibernationStatus = z.infer<typeof HibernationStatusSchema>;

// ---------------------------------------------------------------------------
// Live ECS status (admin)
// ---------------------------------------------------------------------------

export const LiveEcsStatusSchema = z.object({
  serviceName: z.string(),
  exists: z.boolean(),
  status: z.string().optional(),
  desiredCount: z.number().int().nonnegative().optional(),
  runningCount: z.number().int().nonnegative().optional(),
  pendingCount: z.number().int().nonnegative().optional(),
  /** Convenience: at least one ECS task is RUNNING. */
  online: z.boolean(),
});
export type LiveEcsStatus = z.infer<typeof LiveEcsStatusSchema>;

// ---------------------------------------------------------------------------
// Runtime images (admin-curated, surfaced read-only to users)
// ---------------------------------------------------------------------------

/**
 * One row in the user-facing /api/runtimes response. Admin code that
 * mutates `/runtime_images/{id}` carries extra fields (`active`, write
 * audit), but those don't leak to clients.
 */
export const RuntimeImageSchema = z.object({
  runtime: AgentRuntimeSchema,
  /** ECR tag that PerkOS-Admin has pinned active. */
  primaryTag: z.string().min(1),
  /** Admin-curated label; the UI falls back to `primaryTag` when null. */
  displayName: z.string().nullable(),
  /** Optional notes shown next to the runtime card in the wizard. */
  notes: z.string().nullable(),
});
export type RuntimeImage = z.infer<typeof RuntimeImageSchema>;

/** GET /api/runtimes response. */
export const RuntimesListResponseSchema = z.object({
  runtimes: z.array(RuntimeImageSchema),
});
export type RuntimesListResponse = z.infer<typeof RuntimesListResponseSchema>;

// ---------------------------------------------------------------------------
// Agent gateways (Telegram / Farcaster / Slack)
// ---------------------------------------------------------------------------

export const GatewayTypeSchema = z.enum(["telegram", "farcaster", "slack"]);
export type GatewayType = z.infer<typeof GatewayTypeSchema>;

export const AgentGatewayStatusSchema = z.enum(["pending", "active", "error"]);
export type AgentGatewayStatus = z.infer<typeof AgentGatewayStatusSchema>;

/**
 * What lives on a Firestore agent doc under `gateways.<type>`.
 *
 * No secret values here. `secretsProvided` is the set of formKeys we
 * stashed in Secrets Manager — used by the UI to render
 * "Token: configured" / "Token: missing" without reading AWS.
 */
export const AgentGatewayRecordSchema = z.object({
  type: GatewayTypeSchema,
  enabled: z.boolean(),
  nonSecretConfig: z.record(z.string(), z.string()),
  secretsProvided: z.array(z.string()),
  /** formKey → AWS Secrets Manager ARN. Populated by the gateways POST route. */
  secretArns: z.record(z.string(), z.string()).optional(),
  status: AgentGatewayStatusSchema,
  statusMessage: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AgentGatewayRecord = z.infer<typeof AgentGatewayRecordSchema>;

/** Map of gateways enabled on an agent. */
export const AgentGatewaysSchema = z.record(
  GatewayTypeSchema,
  AgentGatewayRecordSchema,
);
export type AgentGateways = z.infer<typeof AgentGatewaysSchema>;

/**
 * Body of POST /api/agents/{agentId}/gateways. Carries raw secret values;
 * the server strips them after persisting to Secrets Manager.
 */
export const GatewayUpsertInputSchema = z.object({
  type: GatewayTypeSchema,
  enabled: z.boolean(),
  nonSecretConfig: z.record(z.string(), z.string()).optional(),
  secrets: z.record(z.string(), z.string()).optional(),
});
export type GatewayUpsertInput = z.infer<typeof GatewayUpsertInputSchema>;

// ---------------------------------------------------------------------------
// Launch
// ---------------------------------------------------------------------------

/**
 * One-shot credentials handed back by /api/agents/launch. The relayApiKey
 * is shown to the user exactly once — the wizard reveals it in a modal and
 * the server-side record is the only copy after that.
 */
export const LaunchAgentCredentialsSchema = z.object({
  agentName: z.string().min(1),
  relayApiKey: z.string().min(1),
  chatUrl: z.string().url(),
  transportUrl: z.string().url(),
});
export type LaunchAgentCredentials = z.infer<typeof LaunchAgentCredentialsSchema>;

export const LaunchAgentRequestSchema = z.object({
  walletAddress: AddressSchema,
  runtime: AgentRuntimeSchema,
  name: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/, "letters, digits, _ or - only"),
  plugins: z.array(z.string()).optional(),
  /** BYOK LLM key. Optional. */
  modelKey: z.string().optional(),
  /** ECR image tag pinned by the admin. Null/undefined → VPS or Local. */
  imageTag: z.string().nullable().optional(),
  /**
   * New in 0.2.0. Where to run the agent:
   *   - "perkos-managed" (default): platform provisions ECS
   *   - "self-hosted": user runs runtime + bridge on their host (we
   *     return a deploy bundle in the response)
   *   - "imported": user already has a runtime process; we ship the
   *     bridge-only bundle
   * Legacy values "vps" / "local" are accepted but treated like
   * "self-hosted" so existing wizard builds keep working until the
   * App ships the 0.2-aware flow.
   */
  deployMode: DeployModeSchema.optional(),
  /**
   * Only meaningful when deployMode === "imported". Tells the bundle
   * generator whether to wire the bridge at the Hermes API surface
   * (`hermes-api`) or the OpenClaw plugin surface, or to leave the
   * runtime contract entirely to the user.
   */
  runtimeKind: RuntimeKindSchema.optional(),
  /**
   * Override for HERMES_API_URL on imported flows when the user's
   * runtime is not on the default port. Ignored for self-hosted
   * (we always emit the compose-network DNS name).
   */
  hermesApiUrl: z.string().optional(),
  /**
   * Rendered persona markdown (SOUL.md for Hermes / AGENTS.md for
   * OpenClaw). Capped well under the ECS 8 KB-per-var ceiling (base64
   * inflation ~33%). Optional — absent → default persona.
   */
  soul: z.string().max(12000).optional(),
  /**
   * Selected skill pack ids from the wizard's skills step. The server
   * resolves these to raw SKILL.md URLs (re-validating the host
   * allow-list) — clients never send raw URLs.
   */
  skills: z.array(z.string()).max(40).optional(),
});
export type LaunchAgentRequest = z.infer<typeof LaunchAgentRequestSchema>;

/**
 * Bundle returned for self-hosted + imported deploys. Contains the literal
 * file contents the user pastes onto their host — no signed URL, no
 * Firestore download token. The relayApiKey is baked in via .env, so the
 * wizard must treat this payload as one-shot secret material the same way
 * it treats `LaunchAgentCredentials`.
 *
 * New in 0.2.0.
 */
export const DeployBundleSchema = z.object({
  /** docker-compose.yml content. */
  composeYaml: z.string(),
  /** .env file content (relayApiKey, agentId, URLs, optional BYOK). */
  envFile: z.string(),
  /** Markdown-formatted, copy-safe deploy instructions. */
  instructions: z.string(),
  /** One-liner equivalent of compose, for users who prefer `docker run`. */
  dockerRunCommand: z.string().optional(),
});
export type DeployBundle = z.infer<typeof DeployBundleSchema>;

export const LaunchAgentResponseSchema = z.object({
  ok: z.boolean(),
  launchId: z.string(),
  credentials: LaunchAgentCredentialsSchema.optional(),
  /** Present for self-hosted + imported flows. New in 0.2.0. */
  deployBundle: DeployBundleSchema.optional(),
  result: z.object({
    mode: z.string().optional(),
    status: z.string().optional(),
    taskArn: z.string().optional(),
    jobId: z.string().nullable().optional(),
    agent: AgentSchema.optional(),
  }),
});
export type LaunchAgentResponse = z.infer<typeof LaunchAgentResponseSchema>;

// ---------------------------------------------------------------------------
// Bridge heartbeat (POST /agents/:id/heartbeat) — new in 0.2.0
// ---------------------------------------------------------------------------

/**
 * Body shape posted by the perkos-a2a bridge when it boots. Auth is
 * carried in the `Authorization: Bearer <relayApiKey>` header or
 * `x-relay-key: <relayApiKey>`.
 */
export const HeartbeatRequestSchema = z.object({
  runtimeKind: RuntimeKindSchema,
  version: z.string().min(1),
  ts: z.number().int().nonnegative(),
});
export type HeartbeatRequest = z.infer<typeof HeartbeatRequestSchema>;

export const HeartbeatResponseSchema = z.object({
  ok: z.boolean(),
});
export type HeartbeatResponse = z.infer<typeof HeartbeatResponseSchema>;
