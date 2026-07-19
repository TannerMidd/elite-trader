/** @import {UpdateCheckResponse} from "../api/contracts/update.js" */
import { requireById, setSafeHref } from "../core/dom.js";
import { clear, escapeHtml, html, render } from "../core/html.js";
import { updateApi } from "../api/update.js";
import { openExternal } from "./extensions.js";

/** @param {string} id @returns {HTMLElement} */
const $ = (id) => /** @type {HTMLElement} */ (requireById(id));

/** @type {UpdateCheckResponse|null} */
export let updateInfo = null;

export let updateApplying = false;

export async function pollUpdate() {
  let delay = 30 * 60 * 1000; // re-check every 30 min so a new release is noticed
  try {
    updateInfo = await updateApi.checkForUpdate();
    if (updateInfo.current) $("app-version").textContent = "v" + updateInfo.current;
    renderUpdateBanner();
    if (updateInfo.error) delay = 60 * 1000; // transient check error: retry soon
  } catch {
    delay = 60 * 1000; // server not up yet (just launched): retry soon, not in hours
  }
  window.setTimeout(pollUpdate, delay);
}

/**
 * @param {HTMLButtonElement} btn
 * @param {HTMLElement} stat
 */
export async function checkForUpdatesNow(btn, stat) {
  btn.disabled = true;
  stat.textContent = "Checking…";
  try {
    updateInfo = await updateApi.checkForUpdate(true);
    if (updateInfo.current) $("app-version").textContent = "v" + updateInfo.current;
    renderUpdateBanner();
    if (updateInfo.error) stat.textContent = updateInfo.error;
    else if (updateInfo.available)
      stat.textContent = `v${updateInfo.latest} available — see the banner at the top.`;
    else stat.textContent = `You're on the latest version (v${updateInfo.current}).`;
  } catch {
    stat.textContent = "Couldn't check right now.";
  } finally {
    btn.disabled = false;
  }
}

/** @param {unknown} md @returns {string[]} */
function markdownLines(md) {
  // Join lazy continuations first: release notes are hard-wrapped at ~80
  // columns, and like GitHub we fold a plain line into the paragraph or list
  // item above it rather than starting a new block.
  /** @param {string} line */
  const special = (line) =>
    /^\s*[-*]\s+/.test(line) ||
    /^#{1,4}\s/.test(line) ||
    /^-{3,}$/.test(line) ||
    line.startsWith(">");
  const lines = [];
  for (const raw of String(md || "")
    .replace(/\r/g, "")
    .split("\n")) {
    const line = raw.trimEnd();
    const previousLine = lines[lines.length - 1];
    if (
      line &&
      lines.length &&
      previousLine &&
      !special(line) &&
      !/^#{1,4}\s|^-{3,}$/.test(previousLine)
    ) {
      lines[lines.length - 1] += " " + line.trim();
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/** @param {unknown} md @returns {string} */
export function mdToHtml(md) {
  /** @param {string} source */
  const inline = (source) =>
    escapeHtml(source)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/\*([^*]+)\*/g, "<i>$1</i>")
      .replace(
        /\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>',
      );
  let html = "",
    inList = false;
  for (const line of markdownLines(md)) {
    const li = line.match(/^\s*[-*]\s+(.*)/);
    if (li) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline(li[1] || "")}</li>`;
      continue;
    }
    if (inList) {
      html += "</ul>";
      inList = false;
    }
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      const lvl = Math.min((h[1] || "").length + 2, 5);
      html += `<h${lvl}>${inline(h[2] || "")}</h${lvl}>`;
      continue;
    }
    if (/^-{3,}$/.test(line)) {
      html += "<hr>";
      continue;
    }
    if (line.startsWith(">")) {
      html += `<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`;
      continue;
    }
    if (line) html += `<p>${inline(line)}</p>`;
  }
  if (inList) html += "</ul>";
  return html;
}

/** @param {unknown} value @returns {string} */
function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""), window.location.href);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "#";
  } catch {
    return "#";
  }
}

/**
 * @param {Element} parent
 * @param {unknown} value
 */
function appendInlineMarkdown(parent, value) {
  const source = String(value || "");
  const token = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https?:[^)\s]+)\)/gi;
  let start = 0;
  for (const match of source.matchAll(token)) {
    const index = match.index ?? 0;
    parent.appendChild(document.createTextNode(source.slice(start, index)));
    if (match[1] != null) {
      const code = document.createElement("code");
      code.textContent = match[1];
      parent.appendChild(code);
    } else if (match[2] != null) {
      const bold = document.createElement("b");
      bold.textContent = match[2];
      parent.appendChild(bold);
    } else if (match[3] != null) {
      const italic = document.createElement("i");
      italic.textContent = match[3];
      parent.appendChild(italic);
    } else {
      const link = document.createElement("a");
      setSafeHref(link, safeExternalUrl(match[5]));
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = match[4] || "";
      parent.appendChild(link);
    }
    start = index + match[0].length;
  }
  parent.appendChild(document.createTextNode(source.slice(start)));
}

/**
 * @param {Element} target
 * @param {unknown} markdown
 */
export function renderMarkdown(target, markdown) {
  clear(target);
  /** @type {HTMLUListElement|null} */
  let list = null;
  for (const line of markdownLines(markdown)) {
    const item = line.match(/^\s*[-*]\s+(.*)/);
    if (item) {
      if (!list) {
        list = document.createElement("ul");
        target.appendChild(list);
      }
      const row = document.createElement("li");
      appendInlineMarkdown(row, item[1] || "");
      list.appendChild(row);
      continue;
    }
    list = null;
    const heading = line.match(/^(#{1,4})\s+(.*)/);
    if (heading) {
      const level = Math.min((heading[1] || "").length + 2, 5);
      const node = document.createElement(`h${level}`);
      appendInlineMarkdown(node, heading[2] || "");
      target.appendChild(node);
      continue;
    }
    if (/^-{3,}$/.test(line)) {
      target.appendChild(document.createElement("hr"));
      continue;
    }
    if (line.startsWith(">")) {
      const quote = document.createElement("blockquote");
      appendInlineMarkdown(quote, line.replace(/^>\s?/, ""));
      target.appendChild(quote);
      continue;
    }
    if (line) {
      const paragraph = document.createElement("p");
      appendInlineMarkdown(paragraph, line);
      target.appendChild(paragraph);
    }
  }
}

export function showReleaseNotes() {
  if (!updateInfo) return;
  const notesUrl = safeExternalUrl(updateInfo.notes_url);
  if (!updateInfo.notes) {
    // No body on the release — fall back to opening it externally.
    if (!openExternal(notesUrl, "Release notes")) window.open(notesUrl, "_blank");
    return;
  }
  $("notes-title").textContent = updateInfo.notes_title || `Frameshift v${updateInfo.latest}`;
  renderMarkdown($("notes-body"), updateInfo.notes);
  setSafeHref(/** @type {HTMLAnchorElement} */ ($("notes-external")), notesUrl);
  $("notes-modal").classList.remove("hidden");
}

export function renderUpdateBanner() {
  const el = $("update-banner");
  if (!updateInfo || !updateInfo.available || !updateInfo.supported) {
    if (!updateApplying) el.classList.add("hidden");
    return;
  }
  el.classList.remove("hidden");
  render(
    el,
    html`<span class="ub-badge">⬆ UPDATE</span>
      <span class="ub-text"
        >Frameshift <b>v${updateInfo.latest}</b> is available
        <span class="dim">(you have v${updateInfo.current})</span></span
      >`,
  );
  const notes = document.createElement("a");
  setSafeHref(notes, safeExternalUrl(updateInfo.notes_url));
  notes.target = "_blank";
  notes.rel = "noopener";
  notes.className = "ub-notes";
  notes.textContent = "release notes";
  notes.addEventListener("click", (ev) => {
    ev.preventDefault();
    showReleaseNotes();
  });
  const btn = document.createElement("button");
  btn.className = "ub-btn";
  btn.textContent = "Update & restart";
  btn.addEventListener("click", applyUpdate);
  el.appendChild(notes);
  el.appendChild(btn);
}

export async function applyUpdate() {
  if (updateApplying) return;
  updateApplying = true;
  const el = $("update-banner");
  el.classList.remove("hidden");
  render(
    el,
    html`<span class="ub-badge">⬆ UPDATE</span
      ><span class="ub-text" id="ub-status">Starting update…</span>`,
  );
  try {
    await updateApi.applyUpdate();
    void pollUpdateStatus();
  } catch (err) {
    updateApplying = false;
    $("ub-status").textContent = err instanceof Error ? err.message : String(err);
    el.classList.add("ub-error");
  }
}

export async function pollUpdateStatus() {
  const status = $("ub-status");
  try {
    const s = await updateApi.getUpdateStatus();
    if (s.phase === "downloading") {
      if (status)
        status.textContent = `Downloading update… ${s.pct}% (${s.downloaded_mb} / ${s.total_mb} MB)`;
    } else if (s.phase === "verifying") {
      if (status) status.textContent = "Verifying…";
    } else if (s.phase === "restarting") {
      if (status) status.textContent = "Restarting — Frameshift will reopen in a moment.";
    } else if (s.phase === "error") {
      updateApplying = false;
      if (status) status.textContent = "Update failed: " + (s.error || "unknown error");
      $("update-banner").classList.add("ub-error");
      return;
    }
  } catch {
    // Connection lost while restarting is the expected success signal.
    if (status)
      status.textContent =
        "Restarting — Frameshift will reopen in a moment. You can close this tab.";
    return;
  }
  window.setTimeout(pollUpdateStatus, 700);
}
