import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  deleteExtension: vi.fn(),
  getManifest: vi.fn(),
}));

vi.mock("../../ui/src/api/extensions.js", () => ({
  extensionsApi: {
    deleteExtension: apiMocks.deleteExtension,
    getManifest: apiMocks.getManifest,
  },
}));

import {
  initExtensionBuilder,
  xbDeletePack,
  xbEditPack,
} from "../../ui/src/features/extension-builder.js";

function mountBuilder() {
  document.body.innerHTML = `
    <section id="ext-builder-card">
      <div id="xb-templates"></div>
      <button id="xb-new"></button>
      <form id="xb-form" class="hidden">
        <input id="xb-name">
        <span id="xb-id"></span>
        <div id="xb-rules"></div>
        <button id="xb-add-rule" type="button"></button>
        <button id="xb-test" type="button"></button>
        <button id="xb-cancel" type="button"></button>
        <button id="xb-save" type="submit"></button>
        <div id="xb-status"></div>
        <div id="xb-results" class="hidden"></div>
      </form>
    </section>
    <div id="extensions-status"></div>
  `;
  document.querySelector("#ext-builder-card").scrollIntoView = vi.fn();
}

describe("extension builder edit and delete actions", () => {
  beforeEach(() => {
    apiMocks.deleteExtension.mockReset();
    apiMocks.getManifest.mockReset();
    mountBuilder();
  });

  it("loads an editable manifest and refreshes the extension list after deletion", async () => {
    const refresh = vi.fn(async () => {});
    initExtensionBuilder({ refreshLocalServices: refresh });
    apiMocks.getManifest.mockResolvedValue({
      manifest: {
        id: "docking-pack",
        api_version: 1,
        name: "Docking pack",
        version: "1",
        permissions: ["read:journal", "emit:alert"],
        rules: [
          {
            event: "Docked",
            action: { type: "alert", level: "info", text: "Docked at {StationName}" },
          },
        ],
      },
    });

    await xbEditPack("docking-pack");

    expect(document.querySelector("#xb-name").value).toBe("Docking pack");
    expect(document.querySelector("#xb-id").textContent).toBe("docking-pack");
    expect(document.querySelector('[data-xb="action-text"]').value).toBe("Docked at {StationName}");

    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);
    apiMocks.deleteExtension.mockResolvedValue({ loaded: [], errors: [] });
    const button = document.createElement("button");
    document.body.appendChild(button);
    await xbDeletePack("docking-pack", button);
    window.confirm = originalConfirm;

    expect(apiMocks.deleteExtension).toHaveBeenCalledWith("docking-pack");
    expect(refresh).toHaveBeenCalledOnce();
    expect(button.disabled).toBe(false);
  });
});
