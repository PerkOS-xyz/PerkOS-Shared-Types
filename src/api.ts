/**
 * Cross-cutting API envelope types.
 *
 * `ApiSuccess<T>` and `ApiError` are the canonical shapes for /api/*
 * responses going forward. The Hono backend (PerkOS-API) standardizes on
 * these; existing Next.js routes still return naked-T responses and will
 * migrate progressively.
 *
 * `ApiResult<T>` is a discriminated union so callers can `if (res.ok)` and
 * narrow TypeScript-side without a runtime instanceof check.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Error envelope
// ---------------------------------------------------------------------------

/**
 * Canonical error envelope returned by failed /api/* calls.
 *
 * `code` is a stable machine-readable string (e.g. "AGENT_NAME_TAKEN") that
 * existing routes already emit. `message` is the human-readable string the
 * client can surface as a toast. `details` is an optional, route-specific
 * blob (e.g. field-level validation errors).
 */
export const ApiErrorSchema = z.object({
  ok: z.literal(false),
  /** HTTP-style numeric code; mirrored from the response status when present. */
  status: z.number().int().min(100).max(599).optional(),
  /** Stable machine-readable error code. */
  code: z.string().optional(),
  /** Human-readable summary. */
  error: z.string().min(1),
  /** Optional route-specific payload (e.g. field validation errors). */
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ---------------------------------------------------------------------------
// Success envelope
// ---------------------------------------------------------------------------

/**
 * Builder for typed success envelopes. Usage:
 *
 *   const FooResponseSchema = ApiSuccessSchema(FooSchema);
 *   type FooResponse = ApiSuccess<Foo>;
 */
export const ApiSuccessSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    ok: z.literal(true),
    data,
  });

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

export type ApiResult<T> = ApiSuccess<T> | ApiError;

export const ApiResultSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.discriminatedUnion("ok", [ApiSuccessSchema(data), ApiErrorSchema]);
