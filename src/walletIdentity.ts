import bs58 from "bs58";

export type WalletChain = "evm" | "solana";

export function isEvmWalletAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function isSolanaWalletAddress(value: unknown): value is string {
  if (typeof value !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;
  try {
    const bytes = bs58.decode(value);
    return bytes.length === 32 && bs58.encode(bytes) === value;
  } catch {
    return false;
  }
}

export function walletChain(value: unknown): WalletChain | null {
  if (isEvmWalletAddress(value)) return "evm";
  if (isSolanaWalletAddress(value)) return "solana";
  return null;
}

/** Canonical storage identity. Never lowercase a Solana public key. */
export function normalizeWalletAddress(value: string): string {
  return isEvmWalletAddress(value) ? value.toLowerCase() : value;
}
