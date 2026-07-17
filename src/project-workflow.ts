/**
 * Project workflow contracts shared by every PerkOS surface and service.
 *
 * The project conversation is the user-facing event stream. The API owns the
 * state machine; clients render these events and invoke explicit transitions.
 */

import { z } from "zod";

export const ProjectWorkflowPhaseSchema = z.enum([
  "draft",
  "planning",
  "awaiting_approval",
  "approved",
  "running",
  "pm_review",
  "complete",
  "cancelled",
]);
export type ProjectWorkflowPhase = z.infer<typeof ProjectWorkflowPhaseSchema>;

export const ProjectPlanTaskSchema = z.object({
  blockId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  assigneeAgentId: z.string().optional(),
  assigneeName: z.string().optional(),
  priority: z.enum(["High", "Medium", "Low"]).default("Medium"),
  dependsOn: z.array(z.string()).default([]),
  materializedTaskId: z.string().optional(),
});
export type ProjectPlanTask = z.infer<typeof ProjectPlanTaskSchema>;

export const ProjectWorkflowStateSchema = z.object({
  phase: ProjectWorkflowPhaseSchema,
  planId: z.string().optional(),
  planVersion: z.number().int().positive().optional(),
  taskIds: z.array(z.string()).default([]),
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  updatedAt: z.string(),
});
export type ProjectWorkflowState = z.infer<typeof ProjectWorkflowStateSchema>;

export const ProjectWorkflowEventTypeSchema = z.enum([
  "plan_proposed",
  "plan_changes_requested",
  "plan_approved",
  "execution_started",
  "task_started",
  "task_completed",
  "pm_review_started",
  "project_completed",
  "workflow_cancelled",
]);
export type ProjectWorkflowEventType = z.infer<
  typeof ProjectWorkflowEventTypeSchema
>;

export const ProjectWorkflowEventSchema = z.object({
  domain: z.literal("project_workflow"),
  type: ProjectWorkflowEventTypeSchema,
  projectId: z.string().min(1),
  phase: ProjectWorkflowPhaseSchema,
  planId: z.string().optional(),
  taskId: z.string().optional(),
  taskIds: z.array(z.string()).optional(),
  actor: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});
export type ProjectWorkflowEvent = z.infer<typeof ProjectWorkflowEventSchema>;

export const ProjectChatSendRequestSchema = z.object({
  text: z.string().min(1),
  targets: z.array(z.string().min(1)).optional(),
  replyTo: z.string().nullable().optional(),
  event: ProjectWorkflowEventSchema.optional(),
});
export type ProjectChatSendRequest = z.infer<typeof ProjectChatSendRequestSchema>;

