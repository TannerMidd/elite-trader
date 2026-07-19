import { describe, expect, it } from "vitest";

import {
  collectManifest,
  createBuilderModel,
  xbRuleFromManifest,
} from "../../ui/src/features/extension-builder/model.js";

describe("extension builder schema model", () => {
  it("collects typed conditions, permissions, and voice actions", () => {
    const model = createBuilderModel({
      name: "Big bounty",
      rules: [
        {
          event: "Bounty",
          conditions: [
            { field: "Reward", op: "min", value: "100000" },
            { field: "Target", op: "in", value: "Pirate, 42, true" },
          ],
          action: {
            type: "alert",
            level: "warn",
            text: "Bounty {Reward}",
            voice: true,
          },
        },
      ],
    });

    const manifest = collectManifest(model, "Big bounty");

    expect(manifest.id).toBe("big-bounty");
    expect(manifest.permissions).toEqual(["read:journal", "emit:alert"]);
    expect(manifest.rules[0].when).toEqual({
      Reward: { min: 100000 },
      Target: { in: ["Pirate", 42, true] },
    });
    expect(manifest.rules[0].action).toMatchObject({
      type: "alert",
      level: "warn",
      text: "Bounty {Reward}",
      say: "Bounty {Reward}",
    });
  });

  it("maps an editable manifest rule back without losing custom events or conditions", () => {
    const editable = xbRuleFromManifest({
      event: "PluginEvent",
      when: {
        Enabled: { exists: true },
        Score: { max: 12 },
        Mode: { eq: "safe" },
      },
      action: {
        type: "objective",
        title: "Review {Mode}",
        category: "operations",
      },
    });

    expect(editable.event).toBe("");
    expect(editable.customEvent).toBe("PluginEvent");
    expect(editable.conditions).toEqual([
      { field: "Enabled", op: "exists", value: "" },
      { field: "Score", op: "max", value: "12" },
      { field: "Mode", op: "eq", value: "safe" },
    ]);
    expect(editable.action).toMatchObject({
      type: "objective",
      title: "Review {Mode}",
      category: "operations",
    });
  });
});
