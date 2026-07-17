import { describe, expect, it } from "vitest";

import {
  ConversationIdentitySchema,
  ProjectWorkflowEventSchema,
  ProjectWorkflowStateSchema,
} from "../src/index.js";

describe("project workflow contracts", () => {
  it("accepts service identities for service-authored chat events", () => {
    expect(ConversationIdentitySchema.parse("service:perkos-api")).toBe(
      "service:perkos-api",
    );
  });

  it("parses an approval event", () => {
    expect(
      ProjectWorkflowEventSchema.parse({
        domain: "project_workflow",
        type: "plan_approved",
        projectId: "project-1",
        phase: "approved",
        planId: "plan-1",
        actor: "user:0xabc",
      }).type,
    ).toBe("plan_approved");
  });

  it("rejects an invalid workflow phase", () => {
    expect(() =>
      ProjectWorkflowStateSchema.parse({ phase: "busy", updatedAt: "now" }),
    ).toThrow();
  });
});
