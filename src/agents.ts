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
});
export type LaunchAgentRequest = z.infer<typeof LaunchAgentRequestSchema>;

export const LaunchAgentResponseSchema = z.object({
  ok: z.boolean(),
  launchId: z.string(),
  credentials: LaunchAgentCredentialsSchema.optional(),
  result: z.object({
    mode: z.string().optional(),
    status: z.string().optional(),
    taskArn: z.string().optional(),
    jobId: z.string().nullable().optional(),
    agent: AgentSchema.optional(),
  }),
});
export type LaunchAgentResponse = z.infer<typeof LaunchAgentResponseSchema>;
