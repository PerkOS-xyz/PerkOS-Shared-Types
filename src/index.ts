/**
 * @perkos/shared-types
 *
 * Type contract shared by every PerkOS client (PerkOS mini-app,
 * PerkOS-Admin, PerkOS-Desktop, agent runtimes) and the platform-level
 * Hono backend (PerkOS-API). Zero runtime deps; just TypeScript types and
 * Zod schemas.
 *
 * Import strategy:
 *
 *   import { AgentSchema, type Agent } from "@perkos/shared-types";
 *
 * Versioning: strict semver. Breaking changes bump the major; deprecated
 * exports keep working for at least one minor before removal.
 */

// Access decisions and capability checks.
export * from "./access.js";

// Wallet sign-in.
export * from "./auth.js";

// Agents, runtime images, gateways, launch.
export * from "./agents.js";

// Workspace primitives.
export * from "./projects.js";

// Provisioning queue.
export * from "./jobs.js";

// Conversations + assistant chat.
export * from "./conversations.js";

// Cross-cutting API envelopes.
export * from "./api.js";
