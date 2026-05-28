# @perkos/shared-types

The TypeScript type contract shared by every PerkOS surface — the
[mini-app](https://github.com/PerkOS-xyz/PerkOS), the
[admin console](https://github.com/PerkOS-xyz/Perkos-Admin), the desktop
workspace, the agent runtimes, and the platform-level Hono backend
([PerkOS-API](https://github.com/PerkOS-xyz/PerkOS-API)). Pure TypeScript
types plus [Zod](https://zod.dev) schemas, zero runtime dependencies beyond
Zod itself.

If you're calling a PerkOS API endpoint from anywhere in the org, the
request/response shape should live here — not duplicated in each consumer.

## Install

```bash
npm install @perkos/shared-types
```

## Usage

```ts
import {
  WalletSigninRequestSchema,
  type WalletSigninRequest,
  type WalletSigninResponse,
} from "@perkos/shared-types";

// Parse-then-trust: throws ZodError if the body is wrong shape.
const body: WalletSigninRequest = WalletSigninRequestSchema.parse(
  await request.json(),
);
```

Every domain exports both a `*Schema` (runtime validator) and a `type`
(static type) so consumers can pick the right tool for the layer:

- Server-side handlers and worker code: `.parse()` once at the boundary.
- Client-side React components: use the inferred `type` directly.

## Auth contract

The wallet sign-in flow (`/api/auth/nonce` → wallet signature →
`/api/auth/wallet-signin`) is the load-bearing piece of this package. The
canonical schemas live in [`src/auth.ts`](./src/auth.ts) and
[`src/access.ts`](./src/access.ts). See the platform migration plan for
the full sequence diagram — `MIGRATION-PLAN-v2.md` in the workspace root.

## What's covered

| Module | Exports |
|---|---|
| `access` | `AccessDecision`, `AccessReason`, `CapabilityCheckResponse` |
| `auth` | `Address`, `NonceResponse`, `WalletSigninRequest`, `WalletSigninResponse`, `Role` |
| `agents` | `Agent`, `AgentRuntime`, `RuntimeImage`, `AgentGatewayRecord`, `GatewayType`, `LaunchAgentRequest`/`Response`, `HibernationStatus`, `LiveEcsStatus` |
| `projects` | `Project`, `Task`, `TaskStatus`, `TaskPriority`, `OverviewStats` |
| `jobs` | `ProvisionJob`, `JobStatus`, `JobLogEntry` |
| `conversations` | `Conversation`, `Message`, `ConversationIdentity`, `AssistantChat*` |
| `api` | `ApiSuccess<T>`, `ApiError`, `ApiResult<T>` |

## Versioning

Strict [semver](https://semver.org/). Specifically:

- Renames, removed fields, narrowed types → **major** bump.
- New fields (optional), new schemas, new exports → **minor** bump.
- Doc-only / non-breaking refactors → **patch** bump.

Deprecated exports keep working for **at least one minor** release before
removal in the next major. Deprecated items carry a `@deprecated` JSDoc
tag pointing at the replacement.

## Related packages

- [`@perkos/shared-client`](https://github.com/PerkOS-xyz/PerkOS-Shared-Client)
  — typed HTTP client wrapping the same schemas (fetch helper + Zod-validated
  responses). Depends on this package.
- [PerkOS-API](https://github.com/PerkOS-xyz/PerkOS-API) — the Hono backend
  that produces these shapes.

## Publishing (maintainers)

The `publish.yml` workflow publishes on every `v*` tag push. After cloning
the repo to GitHub for the first time, set the `NPM_TOKEN` repository
secret (Settings → Secrets and variables → Actions) — an automation token
scoped to the `@perkos` org with publish rights. Then:

```bash
npm version patch   # or minor / major
git push --follow-tags
```

CI runs `typecheck`, `test`, `build`, then `npm publish --access public`.

## License

MIT
