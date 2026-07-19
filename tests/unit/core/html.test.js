import { describe, expect, it } from "vitest";

import { clear, escapeHtml, html, raw, render, renderToString } from "../../../ui/src/core/html.js";

describe("safe HTML rendering", () => {
  it("escapes every untrusted interpolation", () => {
    const result = html`<p title="${'" onmouseover="bad'}">${"<script>bad()</script>"}</p>`;

    expect(renderToString(result)).toBe(
      '<p title="&quot; onmouseover=&quot;bad">&lt;script&gt;bad()&lt;/script&gt;</p>',
    );
  });

  it("composes nested templates, arrays, and empty values", () => {
    const rows = ["Alpha", "<Beta>"].map((name) => html`<li>${name}</li>`);
    const result = html`<ul>
      ${rows}${null}${false}
    </ul>`;

    expect(renderToString(result).replace(/\s+/gu, "")).toBe(
      "<ul><li>Alpha</li><li>&lt;Beta&gt;</li></ul>",
    );
  });

  it("requires explicit review for raw fragments", () => {
    expect(renderToString(html`<svg>${raw("<path />")}</svg>`)).toBe("<svg><path /></svg>");
    expect(() => raw(/** @type {never} */ (42))).toThrow(TypeError);
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("centralizes DOM sinks", () => {
    const target = document.createElement("div");
    render(target, html`<b>${"<safe>"}</b>`);
    expect(target.innerHTML).toBe("<b>&lt;safe&gt;</b>");
    clear(target);
    expect(target.childNodes).toHaveLength(0);
  });
});
