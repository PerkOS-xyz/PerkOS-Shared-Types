/**
 * Projects + tasks (workspace primitives).
 *
 * Source: PerkOS/app/lib/perkosApi.ts (Project, Task, TaskStatus).
 *
 * Reconciliation:
 *   - App stored `agents` and `tasks` as denormalized counters on the
 *     project doc; we preserve them as numeric counters.
 *   - `Task.status`: App allowed either the enum or any string (to tolerate
 *     legacy docs). The canonical type below is the enum; consumers
 *     migrating legacy data should normalize before parse().
 *   - `Task.priority`: same pattern — canonical enum, no free strings.
 *   - The deprecated `ChatMessage` / `ProjectDetail` from perkosApi.ts are
 *     intentionally NOT ported. New chat lives in `conversations.ts`.
 */

import { z } from "zod";

export const TaskStatusSchema = z.enum([
  "Backlog",
  "In progress",
  "Review",
  "Done",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskPrioritySchema = z.enum(["High", "Medium", "Low"]);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const TaskSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  /** Human-readable agent name as shown on the task card. */
  agent: z.string(),
  /** Firestore agent doc id (when the task is bound to a specific one). */
  agentId: z.string().optional(),
  prompt: z.string().optional(),
  result: z.string().optional(),
  logs: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const ProjectStatusSchema = z.enum([
  "Active",
  "In progress",
  "Paused",
  "Done",
  "Archived",
]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const ProjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  goal: z.string().optional(),
  /** Free-form for back-compat with legacy values; new code should use ProjectStatus. */
  status: z.string(),
  /** Denormalized counters maintained by createProjectTasks / deleteTask. */
  agents: z.number().int().nonnegative(),
  tasks: z.number().int().nonnegative(),
  /** Human-readable budget label (e.g. "0 USDC"). */
  budget: z.string(),
  agentIds: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

// ---------------------------------------------------------------------------
// Overview / aggregates
// ---------------------------------------------------------------------------

export const OverviewStatsSchema = z.object({
  activeProjects: z.number().int().nonnegative(),
  registeredAgents: z.number().int().nonnegative(),
  activeTasks: z.number().int().nonnegative(),
  completedTasks: z.number().int().nonnegative(),
});
export type OverviewStats = z.infer<typeof OverviewStatsSchema>;
