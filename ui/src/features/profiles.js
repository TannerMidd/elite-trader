/** @import {CommanderProfile, ProfileOverview} from "../api/contracts/profiles.js" */
import { profilesApi } from "../api/profiles.js";
import { requireById } from "../core/dom.js";
import { clear, html, render } from "../core/html.js";
import { appStore } from "../core/store.js";
import { securityStatus } from "./security.js";

let profileRequest = 0;

/** @param {string} id @returns {HTMLElement} */
function element(id) {
  return /** @type {HTMLElement} */ (requireById(id));
}

/** @param {unknown} error */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function loadProfiles() {
  const request = ++profileRequest;
  const identity = appStore.identity();
  const identityIsCurrent = () => !identity.commanderId || appStore.isCurrent(identity);
  const card = element("profiles-card");
  const status = /** @type {{scopes?: string[]}|null} */ (securityStatus);
  const admin = Boolean(status?.scopes?.includes("admin"));
  card.classList.toggle("hidden", !admin);
  if (!admin) return;
  const list = element("profiles-list");
  const bucket = element("profiles-unattributed");
  try {
    const data = await profilesApi.listProfiles();
    if (request !== profileRequest || !identityIsCurrent()) return;
    renderProfiles(data, list, bucket);
  } catch (error) {
    if (request !== profileRequest || !identityIsCurrent()) return;
    list.classList.add("dim");
    list.textContent = errorMessage(error);
  }
}

/**
 * @param {ProfileOverview} data
 * @param {HTMLElement} list
 * @param {HTMLElement} bucket
 */
function renderProfiles(data, list, bucket) {
  const profiles = data.profiles || [];
  const named = profiles.filter((profile) => profile.id !== "default");
  bucket.classList.toggle("hidden", !(data.unattributed?.rows > 0));
  clear(bucket);
  if (data.unattributed?.rows > 0 && named.length) {
    renderUnattributedHistory(data.unattributed.rows, named, bucket);
  }

  list.classList.remove("dim");
  clear(list);
  if (!named.length) {
    list.classList.add("dim");
    list.textContent =
      "No commander seen yet — profiles appear after your first login with the game running.";
    return;
  }
  for (const profile of named) list.appendChild(profileRow(profile));
}

/**
 * @param {number} rows
 * @param {CommanderProfile[]} profiles
 * @param {HTMLElement} bucket
 */
function renderUnattributedHistory(rows, profiles, bucket) {
  const info = document.createElement("div");
  info.className = "device-main";
  render(
    info,
    html`<div class="device-name">
        UNASSIGNED HISTORY · ${Number(rows).toLocaleString()} records
      </div>
      <div class="dim">
        Trades, earnings and watches saved before this machine knew your commander name. If all of
        it is yours, assign it — it merges safely (duplicates are skipped).
      </div>`,
  );
  const select = document.createElement("select");
  for (const profile of profiles) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    option.selected = profile.active;
    select.appendChild(option);
  }
  const assign = document.createElement("button");
  assign.type = "button";
  assign.className = "hb hb-primary hb-sm";
  assign.textContent = "ASSIGN";
  assign.addEventListener("click", async () => {
    const target = profiles.find((profile) => profile.id === select.value);
    if (
      !window.confirm(
        `Give all unassigned history to ${target?.name || "this commander"}? ` +
          "Only do this if no other person's account has used this machine.",
      )
    ) {
      return;
    }
    assign.disabled = true;
    try {
      await profilesApi.assignUnattributed(select.value);
    } catch (error) {
      window.alert(errorMessage(error) || "Could not assign the history.");
    } finally {
      if (assign.isConnected) assign.disabled = false;
      void loadProfiles();
    }
  });
  bucket.append(info, select, assign);
}

/** @param {CommanderProfile} profile */
function profileRow(profile) {
  const row = document.createElement("div");
  row.className = "paired-device";
  const main = document.createElement("div");
  main.className = "device-main";
  const mode = profile.galaxy_mode === "legacy" ? " · LEGACY galaxy" : "";
  render(
    main,
    html`<div class="device-name">
        ${profile.name}${profile.active ? html`<span class="chip">ACTIVE</span>` : false}
      </div>
      <div class="dim">
        ${Number(profile.rows || 0).toLocaleString()} local records${mode} · last seen
        ${(profile.last_seen_at || "never").slice(0, 16).replace("T", " ")}
      </div>`,
  );
  row.appendChild(main);
  if (profile.active) return row;

  const activate = document.createElement("button");
  activate.type = "button";
  activate.className = "hb hb-utility";
  activate.textContent = "ACTIVATE";
  const gameRunning = appStore.getSnapshot()?.game_running === true;
  activate.disabled = gameRunning;
  activate.title = gameRunning
    ? "Close Elite Dangerous before viewing another commander's local data."
    : "Show this commander's data now. The live journal restores its profile when the game resumes.";
  activate.addEventListener("click", async () => {
    activate.disabled = true;
    try {
      await profilesApi.activateProfile(profile.id);
    } catch (error) {
      window.alert(errorMessage(error) || "Could not activate the commander profile.");
    } finally {
      if (activate.isConnected) {
        activate.disabled = appStore.getSnapshot()?.game_running === true;
      }
      void loadProfiles();
    }
  });

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "hb hb-utility hb-danger";
  remove.textContent = "DELETE";
  remove.title =
    "Remove this profile and every local record it owns. In-game progress is never affected.";
  remove.addEventListener("click", async () => {
    if (
      !window.confirm(
        `Delete ${profile.name} and its ${Number(profile.rows || 0).toLocaleString()} local records? ` +
          "This cannot be undone (a backup is kept in data/backups).",
      )
    ) {
      return;
    }
    remove.disabled = true;
    try {
      await profilesApi.deleteProfile(profile.id);
    } catch (error) {
      window.alert(errorMessage(error) || "Could not delete the profile.");
    } finally {
      if (remove.isConnected) remove.disabled = false;
      void loadProfiles();
    }
  });
  row.append(activate, remove);
  return row;
}
