import { describe, expect, it } from "vitest";

import {
  AddressSchema,
  AccessDecisionSchema,
  AccessReasonSchema,
  CapabilityCheckResponseSchema,
  NonceResponseSchema,
  RoleSchema,
  WalletSigninRequestSchema,
  WalletSigninResponseSchema,
} from "../src/index.js";

describe("AddressSchema", () => {
  it("accepts a lowercase 0x address", () => {
    const addr = AddressSchema.parse("0x" + "a".repeat(40));
    expect(addr).toBe("0x" + "a".repeat(40));
  });

  it("accepts mixed-case 0x address (checksum)", () => {
    const checksummed = "0xAbC1230000000000000000000000000000000def";
    expect(AddressSchema.parse(checksummed)).toBe(checksummed);
  });

  it("rejects non-0x prefix", () => {
    expect(() => AddressSchema.parse("12345")).toThrow();
  });

  it("rejects truncated address", () => {
    expect(() => AddressSchema.parse("0xdeadbeef")).toThrow();
  });
});

describe("NonceResponseSchema", () => {
  it("parses a valid nonce response with numeric expiresAt", () => {
    const out = NonceResponseSchema.parse({
      nonce: "abcd1234abcd1234",
      message: "Sign in to PerkOS",
      expiresAt: Date.now() + 60_000,
    });
    expect(out.nonce).toBe("abcd1234abcd1234");
    expect(typeof out.expiresAt).toBe("number");
  });

  it("coerces ISO 8601 expiresAt to epoch ms", () => {
    const iso = new Date(Date.now() + 60_000).toISOString();
    const out = NonceResponseSchema.parse({
      nonce: "abcd1234abcd1234",
      message: "Sign in",
      expiresAt: iso,
    });
    expect(typeof out.expiresAt).toBe("number");
    expect(out.expiresAt).toBeGreaterThan(Date.now());
  });

  it("rejects missing message", () => {
    expect(() =>
      NonceResponseSchema.parse({
        nonce: "abcd1234abcd1234",
        expiresAt: 1,
      }),
    ).toThrow();
  });
});

describe("WalletSigninRequestSchema", () => {
  it("parses a valid request without chainId", () => {
    const out = WalletSigninRequestSchema.parse({
      address: "0x" + "a".repeat(40),
      nonce: "n",
      signature: "0xdeadbeef",
    });
    expect(out.address).toMatch(/^0x/);
    expect(out.chainId).toBeUndefined();
  });

  it("accepts optional chainId", () => {
    const out = WalletSigninRequestSchema.parse({
      address: "0x" + "a".repeat(40),
      nonce: "n",
      signature: "0xdeadbeef",
      chainId: 8453,
    });
    expect(out.chainId).toBe(8453);
  });

  it("rejects non-hex signature", () => {
    expect(() =>
      WalletSigninRequestSchema.parse({
        address: "0x" + "a".repeat(40),
        nonce: "n",
        signature: "not-hex",
      }),
    ).toThrow();
  });
});

describe("AccessDecisionSchema + AccessReasonSchema", () => {
  it("parses a full allowed decision", () => {
    const out = AccessDecisionSchema.parse({
      allowed: true,
      reason: "firestore-allowlist",
      ecs: true,
      llm: false,
      public: false,
    });
    expect(out.allowed).toBe(true);
    expect(out.reason).toBe("firestore-allowlist");
  });

  it("rejects an unknown reason", () => {
    expect(() =>
      AccessDecisionSchema.parse({
        allowed: false,
        reason: "made-up",
        ecs: false,
        llm: false,
        public: false,
      }),
    ).toThrow();
  });

  it("AccessReasonSchema lists exactly the documented variants", () => {
    const all = AccessReasonSchema.options;
    expect(all).toEqual([
      "public-mode",
      "env-allowlist",
      "firestore-allowlist",
      "super-admin",
      // A third party nobody vouched for, authorised because it pays.
      "funded",
      "not-allowlisted",
    ]);
  });

  it("accepts funded as an allowed decision", () => {
    const decision = AccessDecisionSchema.parse({
      allowed: true,
      reason: "funded",
      ecs: false,
      llm: false,
      public: false,
    });
    expect(decision.reason).toBe("funded");
    // Funded buys compute, not somebody else's organization. The capability
    // flags stay independent of how the caller got through the door.
    expect(decision.ecs).toBe(false);
  });
});

describe("CapabilityCheckResponseSchema", () => {
  it("parses a super-admin grant", () => {
    const out = CapabilityCheckResponseSchema.parse({
      allowed: true,
      reason: "super-admin",
    });
    expect(out.allowed).toBe(true);
  });

  it("rejects an unknown reason", () => {
    expect(() =>
      CapabilityCheckResponseSchema.parse({
        allowed: false,
        reason: "elsewhere",
      }),
    ).toThrow();
  });
});

describe("RoleSchema", () => {
  it("accepts super_admin / user / null", () => {
    expect(RoleSchema.parse("super_admin")).toBe("super_admin");
    expect(RoleSchema.parse("user")).toBe("user");
    expect(RoleSchema.parse(null)).toBe(null);
  });

  it("rejects other strings", () => {
    expect(() => RoleSchema.parse("guest")).toThrow();
  });
});

describe("WalletSigninResponseSchema", () => {
  it("parses a full sign-in response", () => {
    const out = WalletSigninResponseSchema.parse({
      token: "eyJ...",
      uid: "0x" + "a".repeat(40),
      role: "user",
      access: {
        allowed: true,
        reason: "firestore-allowlist",
        ecs: true,
        llm: false,
        public: false,
      },
    });
    expect(out.role).toBe("user");
    expect(out.access.allowed).toBe(true);
  });

  it("rejects a mixed-case uid (must be lowercased)", () => {
    expect(() =>
      WalletSigninResponseSchema.parse({
        token: "tok",
        uid: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        role: null,
        access: {
          allowed: false,
          reason: "not-allowlisted",
          ecs: false,
          llm: false,
          public: false,
        },
      }),
    ).toThrow();
  });
});
