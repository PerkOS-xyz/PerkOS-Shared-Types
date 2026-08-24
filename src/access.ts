/**
 * Access-control decision returned by /api/auth/wallet-signin and surfaced
 * across the platform (admin pages, agent wizard gating, LLM-service gate).
 *
 * Cascade encoded by `reason`:
 *
 *   1. "public-mode"          → Firestore `config/access.publicMode` is on.
 *   2. "env-allowlist"        → wallet seeded in the env `PERKOS_WHITELIST`.
 *   3. "firestore-allowlist"  → wallet in `/allowlist/{address}`.
 *   4. "super-admin"          → wallet in `/super_admins/{address}` or env.
 *   5. "funded"               → not allowlisted, but the wallet carries a
 *                               prepaid balance that covers at least one
 *                               billable call. This is how a third-party
 *                               agent onboards itself: nobody vouches for it,
 *                               it pays. A balance below the minimum charge
 *                               does NOT qualify — letting it in would admit
 *                               a caller that fails on its first job.
 *   6. "not-allowlisted"      → none of the above.
 *
 * "funded" authorises a caller to exist and consume. It does NOT grant access
 * to anyone else's organization: membership is what does that. Collapsing the
 * two would let anyone with USDC into anyone's projects.
 *
 * The booleans `ecs`, `llm`, `public` describe the *capabilities* unlocked
 * by the decision, separating "can sign in" from "can pick PerkOS LLM" and
 * "can launch on PerkOS ECS". This is the reconciled platform-level shape
 * — App-only code historically used a narrower AccessDecision (no
 * super-admin, no capability flags); the broader shape here is canonical
 * going forward.
 */

import { z } from "zod";

export const AccessReasonSchema = z.enum([
  "public-mode",
  "env-allowlist",
  "firestore-allowlist",
  "super-admin",
  "funded",
  "not-allowlisted",
]);
export type AccessReason = z.infer<typeof AccessReasonSchema>;

export const AccessDecisionSchema = z.object({
  allowed: z.boolean(),
  reason: AccessReasonSchema,
  /** Caller may provision agents on the PerkOS-managed ECS cluster. */
  ecs: z.boolean(),
  /** Caller may select the PerkOS-hosted LLM service in the agent wizard. */
  llm: z.boolean(),
  /** Mirror of the `public-mode` flag — true when public mode is on globally. */
  public: z.boolean(),
});
export type AccessDecision = z.infer<typeof AccessDecisionSchema>;

/**
 * Per-capability access response used by /api/access/llm-check and
 * /api/access/ecs-check. Narrower than AccessDecision — the wizard uses
 * these to enable/disable individual options.
 */
export const CapabilityReasonSchema = z.enum([
  "super-admin",
  "allowlist",
  "denied",
]);
export type CapabilityReason = z.infer<typeof CapabilityReasonSchema>;

export const CapabilityCheckResponseSchema = z.object({
  allowed: z.boolean(),
  reason: CapabilityReasonSchema,
});
export type CapabilityCheckResponse = z.infer<typeof CapabilityCheckResponseSchema>;
