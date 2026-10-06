/** Durable, replayable execution events shared across PerkOS services. */
import { z } from "zod";

const Id = z.string().trim().min(1).max(200);
const Label = z.string().trim().min(1).max(160);
const SafeDetail = z.string().trim().min(1).max(500);
const IsoDate = z.string().datetime({ offset: true });

export const ExecutionEventSourceSchema = z.enum([
  "workflow",
  "dispatcher",
  "tools",
  "a2a",
  "runtime",
  "knowledge",
]);
export const ExecutionEventStatusSchema = z.enum([
  "queued",
  "running",
  "waiting",
  "succeeded",
  "failed",
  "cancelled",
]);
export const ExecutionEventVisibilitySchema = z.enum(["project", "owner", "system"]);
export const ExecutionActorSchema = z.object({
  type: z.enum(["user", "agent", "system", "service"]),
  id: Id,
  label: Label.optional(),
}).strict();
export const ExecutionSubjectSchema = z.object({
  type: z.enum(["project", "plan", "task", "agent", "tool", "artifact", "knowledge", "gate"]),
  id: Id,
  label: Label.optional(),
}).strict();
export const ExecutionTargetSchema = z.object({
  type: Label,
  id: Id,
  label: Label.optional(),
}).strict();

export const ExecutionEventTypeSchema = z.enum([
  "plan.created",
  "plan.proposed",
  "approval.requested",
  "approval.granted",
  "approval.changes_requested",
  "execution.started",
  "project.review_started",
  "project.completed",
  "workflow.cancelled",
  "task.materialized",
  "task.blocked",
  "task.unblocked",
  "task.queued",
  "task.claimed",
  "task.dispatch_started",
  "task.dispatch_delivered",
  "task.dispatch_failed",
  "task.retry_scheduled",
  "task.started",
  "task.review_requested",
  "task.completed",
  "task.failed",
  "task.contention_detected",
  "agent.wake_requested",
  "agent.wake_succeeded",
  "agent.wake_failed",
  "agent.turn_accepted",
  "agent.turn_started",
  "agent.turn_recovering",
  "agent.turn_completed",
  "agent.turn_uncertain",
  "handoff.started",
  "handoff.accepted",
  "handoff.completed",
  "handoff.failed",
  "model.started",
  "model.completed",
  "model.failed",
  "tool.started",
  "tool.completed",
  "tool.failed",
  "artifact.created",
  "artifact.updated",
  "proof.recorded",
  "judge.started",
  "judge.passed",
  "judge.failed",
  "knowledge.read",
  "knowledge.written",
]);
export type ExecutionEventType = z.infer<typeof ExecutionEventTypeSchema>;

const Envelope = z.object({
  schemaVersion: z.literal(1),
  eventId: Id,
  wallet: Id,
  orgId: Id.optional(),
  projectId: Id,
  runId: Id,
  traceId: Id,
  spanId: Id,
  parentSpanId: Id.optional(),
  correlationId: Id.optional(),
  sequence: z.number().int().nonnegative(),
  occurredAt: IsoDate,
  recordedAt: IsoDate,
  source: ExecutionEventSourceSchema,
  actor: ExecutionActorSchema,
  subject: ExecutionSubjectSchema,
  target: ExecutionTargetSchema.optional(),
  status: ExecutionEventStatusSchema.optional(),
  durationMs: z.number().int().nonnegative().max(86_400_000).optional(),
  attempt: z.number().int().positive().max(10_000).optional(),
  visibility: ExecutionEventVisibilitySchema,
  dedupeKey: z.string().trim().min(1).max(300),
});

const WorkflowPayload = z.object({
  planId: Id.optional(),
  planVersion: z.number().int().positive().optional(),
  taskIds: z.array(Id).max(200).optional(),
  reasonCode: Label.optional(),
}).strict();
const TaskPayload = z.object({
  taskId: Id,
  assigneeId: Id.optional(),
  dependencyIds: z.array(Id).max(100).optional(),
  priority: Label.optional(),
  reasonCode: Label.optional(),
  errorClass: Label.optional(),
}).strict();
const AgentPayload = z.object({
  agentId: Id,
  taskId: Id.optional(),
  fromAgentId: Id.optional(),
  toAgentId: Id.optional(),
  reasonCode: Label.optional(),
  errorClass: Label.optional(),
}).strict();
const RuntimePayload = z.object({
  taskId: Id.optional(),
  operationName: Label,
  provider: Label.optional(),
  model: Label.optional(),
  errorClass: Label.optional(),
}).strict();
const ResultPayload = z.object({
  taskId: Id.optional(),
  artifactId: Id.optional(),
  artifactType: Label.optional(),
  proofType: Label.optional(),
  knowledgeRef: Id.optional(),
  summary: SafeDetail.optional(),
  reasonCode: Label.optional(),
  errorClass: Label.optional(),
}).strict();

const WORKFLOW_TYPES = [
  "plan.created", "plan.proposed", "approval.requested", "approval.granted",
  "approval.changes_requested", "execution.started", "project.review_started",
  "project.completed", "workflow.cancelled",
] as const;
const TASK_TYPES = [
  "task.materialized", "task.blocked", "task.unblocked", "task.queued",
  "task.claimed", "task.dispatch_started", "task.dispatch_delivered",
  "task.dispatch_failed", "task.retry_scheduled", "task.started",
  "task.review_requested", "task.completed", "task.failed",
  "task.contention_detected",
] as const;
const AGENT_TYPES = [
  "agent.wake_requested", "agent.wake_succeeded", "agent.wake_failed",
  "agent.turn_accepted", "agent.turn_started", "agent.turn_recovering",
  "agent.turn_completed", "agent.turn_uncertain", "handoff.started",
  "handoff.accepted", "handoff.completed", "handoff.failed",
] as const;
const RUNTIME_TYPES = [
  "model.started", "model.completed", "model.failed", "tool.started",
  "tool.completed", "tool.failed",
] as const;
const RESULT_TYPES = [
  "artifact.created", "artifact.updated", "proof.recorded", "judge.started",
  "judge.passed", "judge.failed", "knowledge.read", "knowledge.written",
] as const;

function variants<const T extends readonly [string, ...string[]]>(types: T, payload: z.ZodTypeAny) {
  return types.map((type) => Envelope.extend({ type: z.literal(type), payload: payload.optional() }).strict());
}

const EventVariants = [
  ...variants(WORKFLOW_TYPES, WorkflowPayload),
  ...variants(TASK_TYPES, TaskPayload),
  ...variants(AGENT_TYPES, AgentPayload),
  ...variants(RUNTIME_TYPES, RuntimePayload),
  ...variants(RESULT_TYPES, ResultPayload),
] as unknown as [
  z.ZodDiscriminatedUnionOption<"type">,
  ...z.ZodDiscriminatedUnionOption<"type">[],
];

export const ExecutionEventV1Schema = z.discriminatedUnion("type", EventVariants);
export type ExecutionEventV1 = z.infer<typeof ExecutionEventV1Schema>;

export function executionEventDedupeKey(parts: readonly (string | number)[]): string {
  const key = parts.map((part) => String(part).trim()).filter(Boolean).join(":");
  if (!key || key.length > 300) throw new Error("invalid execution event dedupe key");
  return key;
}

/** Lets readers reject unknown versions without throwing during live upgrades. */
export function parseExecutionEvent(value: unknown):
  | { ok: true; event: ExecutionEventV1 }
  | { ok: false; reason: "unsupported_version" | "invalid_event" } {
  if (typeof value === "object" && value !== null && "schemaVersion" in value && value.schemaVersion !== 1) {
    return { ok: false, reason: "unsupported_version" };
  }
  const parsed = ExecutionEventV1Schema.safeParse(value);
  return parsed.success ? { ok: true, event: parsed.data } : { ok: false, reason: "invalid_event" };
}
