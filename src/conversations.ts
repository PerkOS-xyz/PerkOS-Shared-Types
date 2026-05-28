/**
 * Conversations (C-hybrid privacy model).
 *
 * Reconciled from:
 *   - PerkOS/app/lib/conversationsApi.ts  (Conversation, ConvKind, ConvIdentity)
 *   - PerkOS-A2A/src/chat-types.ts        (ChatMessage, ChatIdentity)
 *
 * Firestore stores conversation **metadata only** at
 *   /wallets/{walletAddress}/conversations/{convId}
 *
 * Message bodies live exclusively on the host agent's filesystem
 * (`~/.perkos/conversations/{convId}/messages.jsonl`). The chat backbone
 * (chat.perkos.xyz) routes frames between users (browser, Firebase ID
 * token auth) and agents (A2A relay API key auth).
 *
 * `ChatIdentity` from PerkOS-A2A and `ConvIdentity` from the App were
 * structurally identical — exported here as one canonical type
 * `ConversationIdentity` with the historical aliases preserved.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/**
 * `user:0xabc…` or `agent:SomeAgentName`. Templated literal type encodes
 * the prefix invariant in TypeScript; the Zod refine() mirrors it at runtime.
 */
export const ConversationIdentitySchema = z
  .string()
  .refine((s) => s.startsWith("user:") || s.startsWith("agent:"), {
    message: "identity must start with 'user:' or 'agent:'",
  });
export type ConversationIdentity = `user:${string}` | `agent:${string}`;

/** Legacy alias used by PerkOS-A2A. */
export type ChatIdentity = ConversationIdentity;
/** Legacy alias used by PerkOS app. */
export type ConvIdentity = ConversationIdentity;

// ---------------------------------------------------------------------------
// Conversation metadata
// ---------------------------------------------------------------------------

export const ConversationKindSchema = z.enum(["dm", "channel"]);
export type ConversationKind = z.infer<typeof ConversationKindSchema>;
export type ConvKind = ConversationKind;

export const ConversationSchema = z.object({
  id: z.string().min(1),
  /** Editable display title; auto-derived when omitted at creation. */
  title: z.string(),
  kind: ConversationKindSchema,
  participants: z.array(ConversationIdentitySchema).min(1),
  /** Agent identity that owns the canonical jsonl log. Must be in participants. */
  historyHost: ConversationIdentitySchema,
  projectId: z.string().optional(),
  /** ISO 8601 timestamp the server stamps when a message routes. */
  lastMessageAt: z.string().optional(),
  pinned: z.boolean(),
  archived: z.boolean(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

// ---------------------------------------------------------------------------
// Messages (chat wire format / jsonl line shape)
// ---------------------------------------------------------------------------

/** "user" or "assistant" — used by /api/assistant/chat history blocks. */
export const MessageRoleSchema = z.enum(["user", "assistant"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

/**
 * One persisted message in a conversation's jsonl. Matches the
 * ChatMessage struct served by PerkOS-A2A.
 */
export const MessageSchema = z.object({
  id: z.string().min(1),
  from: ConversationIdentitySchema,
  /** Body. May be markdown. */
  text: z.string(),
  /** ISO 8601 timestamp. */
  timestamp: z.string(),
  replyTo: z.string().nullable().optional(),
});
export type Message = z.infer<typeof MessageSchema>;

// ---------------------------------------------------------------------------
// Assistant chat (concierge)
// ---------------------------------------------------------------------------

/** History block sent to /api/assistant/chat. */
export const AssistantChatHistoryEntrySchema = z.object({
  role: MessageRoleSchema,
  content: z.string(),
});
export type AssistantChatHistoryEntry = z.infer<typeof AssistantChatHistoryEntrySchema>;

export const AssistantChatRequestSchema = z.object({
  walletAddress: z.string(),
  message: z.string().min(1),
  history: z.array(AssistantChatHistoryEntrySchema).optional(),
  agentId: z.string().optional(),
  /** When true, the server returns SSE; when false/undefined, plain JSON. */
  stream: z.boolean().optional(),
});
export type AssistantChatRequest = z.infer<typeof AssistantChatRequestSchema>;

export const AssistantChatResponseSchema = z.object({
  reply: z.string(),
  agent: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
      runtime: z.string().optional(),
    })
    .optional(),
});
export type AssistantChatResponse = z.infer<typeof AssistantChatResponseSchema>;

/**
 * Idempotent canonical-conversation lookup used by /api/concierge/ensure-conv
 * and /api/agents/{id}/ensure-conv.
 */
export const EnsureConversationResponseSchema = z.object({
  convId: z.string().min(1),
  historyHost: ConversationIdentitySchema,
  /** Populated only by the per-agent route. */
  agentName: z.string().optional(),
});
export type EnsureConversationResponse = z.infer<typeof EnsureConversationResponseSchema>;
