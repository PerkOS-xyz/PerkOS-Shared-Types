/**
 * Wallet sign-in protocol.
 *
 * Flow:
 *   1. Client: GET /api/auth/nonce?address=0x…  → NonceResponse
 *   2. Wallet signs `message`.
 *   3. Client: POST /api/auth/wallet-signin     → WalletSigninResponse
 *
 * The server verifies signature via viem (handles both ECDSA EOAs and
 * ERC-1271 smart wallets), checks the cascading allowlist, and mints a
 * Firebase custom token bound to `uid = walletAddress.toLowerCase()`.
 */

import { z } from "zod";

import { AccessDecisionSchema } from "./access.js";

/**
 * Lower- or mixed-case 0x-prefixed 40-hex EVM address.
 *
 * Validation deliberately tolerates both casings so callers don't need to
 * normalize before parsing — the server normalizes downstream.
 */
export const AddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "invalid wallet address");
export type Address = `0x${string}`;

/**
 * Returned by GET /api/auth/nonce. The nonce is stashed server-side under
 * /auth_nonces/{address}/nonces/{nonce} and expires after 5 minutes.
 */
export const NonceResponseSchema = z.object({
  /** Opaque random hex string the wallet will incorporate into its signed message. */
  nonce: z.string().min(16),
  /** Canonical UTF-8 message the wallet must sign verbatim. */
  message: z.string(),
  /**
   * Epoch ms (preferred) OR ISO 8601 string — accepted because the legacy
   * /api/auth/nonce route returns an ISO string while the new platform API
   * standardizes on epoch ms. Coerced by Zod to a number when possible.
   */
  expiresAt: z.union([
    z.number().int().positive(),
    z.string().transform((s) => new Date(s).getTime()),
  ]),
});
export type NonceResponse = z.infer<typeof NonceResponseSchema>;

/**
 * POST /api/auth/wallet-signin body.
 */
export const WalletSigninRequestSchema = z.object({
  address: AddressSchema,
  nonce: z.string().min(1),
  /** 0x-prefixed lowercase hex. EOAs ~132 chars, ERC-1271 smart wallet payloads can be longer. */
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
  /** Optional. When omitted, the server tries Base mainnet then Base Sepolia. */
  chainId: z.number().int().positive().optional(),
});
export type WalletSigninRequest = z.infer<typeof WalletSigninRequestSchema>;

/**
 * Platform-level role attached to a signed-in identity.
 *
 * - "super_admin" → unlocks the admin surface (`admin.perkos.xyz`).
 * - "user"        → standard wallet-owned workspace.
 * - null          → unknown / not yet resolved (transient).
 */
export const RoleSchema = z.enum(["super_admin", "user"]).nullable();
export type Role = z.infer<typeof RoleSchema>;

/**
 * POST /api/auth/wallet-signin success response.
 *
 * `token` is a short-lived Firebase custom token; the client signs into
 * Firebase Auth with it. `access` echoes the same decision the user would
 * see calling `/api/access/...` directly, so the client can cache it.
 */
export const WalletSigninResponseSchema = z.object({
  token: z.string().min(1),
  /** Lowercased wallet address — the Firebase uid. */
  uid: z.string().regex(/^0x[a-f0-9]{40}$/),
  role: RoleSchema,
  access: AccessDecisionSchema,
});
export type WalletSigninResponse = z.infer<typeof WalletSigninResponseSchema>;
