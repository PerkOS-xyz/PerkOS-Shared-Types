# Changelog

Semver: minor bumps for additive type/schema changes (new schema, new optional
field), patch for fixes that don't change the wire shape, major for any
breaking change to existing types or schemas.

## 0.1.0 — 2026-05-28

Initial release. Type contract for the PerkOS platform, shared by `PerkOS-API`,
`@perkos/shared-client`, App, Admin, Desktop, and future products.

### Added

- **Auth contract**: `NonceResponseSchema`, `WalletSigninRequestSchema`,
  `WalletSigninResponseSchema`, `RoleSchema`, `AddressSchema`. `NonceResponse`
  schema accepts both epoch-ms and ISO-string `expiresAt` (auto-coerces ISO
  to epoch ms) for compatibility with App's existing nonce route.
- **Access cascade**: `AccessReasonSchema` (`public-mode`, `env-allowlist`,
  `firestore-allowlist`, `super-admin`, `not-allowlisted`), `AccessDecisionSchema`
  with `allowed`, `reason`, `ecs`, `llm`, `public` flags.
- **Capability checks**: `CapabilityReasonSchema`, `CapabilityCheckResponseSchema`
  (used by `/access/ecs-check` and `/access/llm-check`).
- **Agents**: `AgentRuntimeSchema` (`OpenClaw | Hermes`), `AgentStatusSchema`,
  `AgentSchema`, `HibernationStateSchema`, `HibernationStatusSchema`,
  `LiveEcsStatusSchema`, `RuntimeImageSchema`, `RuntimesListResponseSchema`.
- **Agent gateways**: `GatewayTypeSchema`, `AgentGatewayStatusSchema`,
  `AgentGatewayRecordSchema`, `AgentGatewaysSchema`, `GatewayUpsertInputSchema`.
- **Agent launch**: `LaunchAgentRequestSchema`, `LaunchAgentResponseSchema`,
  `LaunchAgentCredentialsSchema`.
- **Projects + tasks**: `TaskStatusSchema`, `TaskPrioritySchema`, `TaskSchema`,
  `ProjectStatusSchema`, `ProjectSchema`, `OverviewStatsSchema`.
- **Provisioning jobs**: `JobStatusSchema`, `JobLogLevelSchema`,
  `ProvisionJobInputSchema`, `ProvisionJobResultSchema`, `ProvisionJobSchema`,
  `JobLogEntrySchema`.
- **Conversations**: `ConversationIdentitySchema` (+ aliases `ChatIdentity`,
  `ConvIdentity`), `ConversationKindSchema`, `ConversationSchema`,
  `MessageRoleSchema`, `MessageSchema`, `EnsureConversationResponseSchema`.
- **Assistant chat**: `AssistantChatRequestSchema`, `AssistantChatResponseSchema`,
  `AssistantChatHistoryEntrySchema`.
- **API envelopes**: `ApiErrorSchema`, `ApiSuccessSchema`, `ApiResultSchema`.
- 61 unit tests (vitest) — happy path + ZodError on each major schema.

### Reconciled from App + Admin

- `AccessDecision`: App returned a 4-state shape with no capability flags;
  canonical shape adds `ecs`, `llm`, `public` and a `super-admin` reason
  variant. Old shape is a strict subset.
- `Agent.runtime`: both App and Admin agreed on `OpenClaw | Hermes` — no
  divergence.
- `Task.status` / `priority`: App allowed `TaskStatus | string` (legacy escape
  hatch). Canonical version is strict enum; consumers migrating legacy docs
  must normalize before `.parse()`.
- `ConversationIdentity` vs `ChatIdentity`: structurally identical across App
  and `@perkos/perkos-a2a`. Merged into one canonical type with aliases.
- Deprecated App types (`ChatMessage`, `ProjectDetail` from `perkosApi.ts`)
  intentionally NOT ported — superseded by new chat stack.

### Not included

- A2A relay frame types — lives in `@perkos/perkos-a2a`, not duplicated here.
- Caddy / nginx / infra config types — owned by deploy repos.
