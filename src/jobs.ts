/**
 * Provision-job queue.
 *
 * Source: PerkOS/app/lib/provisionJobs.ts.
 *
 * Schema on Firestore lives at /provision_jobs/{jobId} with a /log
 * subcollection of `JobLogEntry`. /api/agents/launch enqueues a job and
 * returns immediately; the provisioner worker drains the queue.
 *
 * The lease-with-heartbeat fields (`claimedBy`, `leaseUntil`,
 * `claimedAt`) are written to the doc but only `claimedBy` is exposed
 * in the platform-facing `ProvisionJob` shape — the rest are internal
 * to the worker.
 */

import { z } from "zod";

import { AgentRuntimeSchema } from "./agents.js";

export const JobStatusSchema = z.enum([
  "pending",
  "claimed",
  "running",
  "ready",
  "failed",
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobLogLevelSchema = z.enum(["info", "ok", "warn", "error"]);
export type JobLogLevel = z.infer<typeof JobLogLevelSchema>;

export const ProvisionJobInputSchema = z.object({
  runtime: AgentRuntimeSchema,
  imageTag: z.string().min(1),
  /**
   * Where the runtime's LLM Authorization header comes from. For "byok"
   * the worker fetches the user's key from /agent_secrets — never
   * plaintext in the job doc.
   */
  llmSource: z.enum(["perkos", "byok"]),
});
export type ProvisionJobInput = z.infer<typeof ProvisionJobInputSchema>;

export const ProvisionJobResultSchema = z.object({
  serviceArn: z.string().optional(),
  taskDefinitionArn: z.string().optional(),
  imageUri: z.string().optional(),
  /** Last 4 chars of the LLM key the worker provisioned. */
  llmKeyLast4: z.string().optional(),
});
export type ProvisionJobResult = z.infer<typeof ProvisionJobResultSchema>;

export const ProvisionJobSchema = z.object({
  jobId: z.string().min(1),
  status: JobStatusSchema,
  walletAddress: z.string(),
  agentId: z.string().min(1),
  agentName: z.string().min(1),
  input: ProvisionJobInputSchema,
  /** Worker id currently holding the lease. */
  claimedBy: z.string().nullable(),
  attempts: z.number().int().nonnegative(),
  result: ProvisionJobResultSchema.nullable(),
  error: z.string().nullable(),
});
export type ProvisionJob = z.infer<typeof ProvisionJobSchema>;

/** One row in /provision_jobs/{jobId}/log. */
export const JobLogEntrySchema = z.object({
  /** ISO 8601 timestamp (Firestore Timestamp converted on read). */
  ts: z.string(),
  level: JobLogLevelSchema,
  message: z.string(),
});
export type JobLogEntry = z.infer<typeof JobLogEntrySchema>;
