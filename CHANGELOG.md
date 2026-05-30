# Changelog

Semver: minor bumps for additive type/schema changes (new schema, new optional
field), patch for fixes that don't change the wire shape, major for any
breaking change to existing types or schemas.

## 0.2.0 — 2026-05-29

Additive: BYO (bring-your-own infra) deploy modes for agent provisioning.
Replaces the dead VPS-SSH wizard flow with the bridge dial-out pattern that
already powers the platform Assistant. No existing field is removed; the
old `vpsIp` / `vpsSshKey` fields on legacy agent docs continue to round-trip
through `AgentSchema` (they're not in the schema, just preserved by callers).

### Added

- **`DeployModeSchema`** — `perkos-managed | self-hosted | imported | vps |
  local`. The first three are the canonical 0.2 values; `vps` and `local`
  are legacy aliases kept so pre-0.2 Firestore agent docs still parse.
- **`RuntimeKindSchema`** — `hermes | openclaw | custom`. Only meaningful
  on imported agents to tell the bridge sidecar which runtime API to
  speak.
- **`Agent`** gains four optional fields:
  - `deployMode?: DeployMode`
  - `runtimeKind?: RuntimeKind`
  - `bridgeConnected?: boolean`
  - `lastBridgeSeenAt?: string` (ISO 8601)
  - `runtimeVersion?: string` (perkos-a2a npm version the bridge reported)
- **`LaunchAgentRequest`** gains `deployMode?`, `runtimeKind?`,
  `hermesApiUrl?`. All optional — when omitted, server defaults to
  `perkos-managed` to preserve 0.1 behavior.
- **`DeployBundleSchema`** — new schema for the bundle returned by
  `LaunchAgentResponse.deployBundle`. Contains `composeYaml`, `envFile`,
  `instructions`, optional `dockerRunCommand`. Treat the contents as
  one-shot secret material; the bundle bakes in the relayApiKey.
- **`LaunchAgentResponse.deployBundle?`** — present for self-hosted +
  imported flows; absent for perkos-managed.
- **`HeartbeatRequestSchema` / `HeartbeatResponseSchema`** — new shape
  for `POST /agents/:id/heartbeat`. Auth via `Authorization: Bearer
  <relayApiKey>` or `x-relay-key: <relayApiKey>`.

### Migration notes

- **Old `vpsIp` / `vpsSshKey` Firestore fields are NOT removed.** The
  wizard stops collecting them in 0.2 but existing agent docs may carry
  them — `AgentSchema.parse()` already drops unknown keys (Zod default),
  so no migration is required. Admins can null them out by hand when
  cleaning up the wallet collection.
- **App / Admin / Desktop must bump shared-types peer to `^0.2.0`.** No
  source-level breaking change, but the additive fields are needed for
  the new wizard flow.

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
