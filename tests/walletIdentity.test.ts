import { describe, expect, it } from "vitest";
import { AddressSchema, WalletAddressSchema, WalletSigninRequestSchema, normalizeWalletAddress, walletChain } from "../src/index.js";

const solana = "So11111111111111111111111111111111111111112";
describe("chain-aware wallet identity", () => {
  it("preserves Solana case and existing EVM identities", () => {
    expect(normalizeWalletAddress(solana)).toBe(solana);
    expect(normalizeWalletAddress(`0x${"aB".repeat(20)}`)).toBe(`0x${"ab".repeat(20)}`);
    expect(normalizeWalletAddress(solana.toLowerCase())).not.toBe(solana);
    expect(walletChain(solana)).toBe("solana");
  });
  it("does not widen EVM transaction address validation", () => {
    expect(AddressSchema.safeParse(solana).success).toBe(false);
    expect(WalletAddressSchema.safeParse(solana).success).toBe(true);
  });
  it("rejects paths, whitespace, invalid alphabets and wrong byte lengths", () => {
    for (const value of ["", "../wallet", " " + solana, "0".repeat(32), "z".repeat(44), "1".repeat(31), "1".repeat(33)]) {
      expect(walletChain(value)).toBeNull();
    }
  });
  it("requires explicit Solana chain and bounds the nonce", () => {
    const request = { address: solana, nonce: "a".repeat(32), signature: Buffer.alloc(64).toString("base64") };
    expect(WalletSigninRequestSchema.safeParse(request).success).toBe(false);
    expect(WalletSigninRequestSchema.safeParse({ ...request, chain: "solana" }).success).toBe(true);
    expect(WalletSigninRequestSchema.safeParse({ ...request, chain: "solana", nonce: "../x" }).success).toBe(false);
  });
});
