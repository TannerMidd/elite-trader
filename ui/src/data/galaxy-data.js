/* Static Powerplay 2.0 knowledge and pure Galaxy-page helpers.
 * Native ESM with no global/window side effects and no network dependency.
 */

/**
 * @typedef {{label: string, className: "bad"|"dim"|"good"}} ReputationBand
 * @typedef {{controlling?: string|null, powers?: string[]}} SystemPowerplay
 * @typedef {{name?: string|null, influence?: number|string|null, state?: string|null}} FactionInput
 * @typedef {{
 *   controlling?: string|null,
 *   state?: string|null,
 *   control_progress?: number|string|null,
 *   reinforcement?: number|string|null,
 *   undermining?: number|string|null,
 * }} PowerplaySystemInput
 * @typedef {{name?: string|null, won_days?: number|null}} ConflictFactionInput
 * @typedef {{
 *   war_type?: string|null,
 *   status?: string|null,
 *   faction1?: ConflictFactionInput|null,
 *   faction2?: ConflictFactionInput|null,
 * }} ConflictInput
 * @typedef {{
 *   controlling_faction?: string|null,
 *   factions?: FactionInput[],
 *   pp_system?: PowerplaySystemInput|null,
 *   conflicts?: ConflictInput[],
 * }} GalaxySnapshotInput
 * @typedef {{name: string|null, influence: number|null, state: string|null}} FactionObservation
 * @typedef {{
 *   controlling: string|null,
 *   state: string|null,
 *   control_progress: number|null,
 *   reinforcement: number|null,
 *   undermining: number|null,
 * }} PowerplayObservation
 * @typedef {{
 *   type: string|null,
 *   status: string|null,
 *   faction1: [string|null|undefined, number|null|undefined]|null,
 *   faction2: [string|null|undefined, number|null|undefined]|null,
 * }} ConflictObservation
 * @typedef {{
 *   system: string,
 *   observed_at: string,
 *   controlling_faction: string|null,
 *   factions: FactionObservation[],
 *   powerplay: PowerplayObservation|null,
 *   conflicts: ConflictObservation[],
 *   signature: string,
 * }} GalaxyObservation
 * @typedef {{
 *   module: string,
 *   rank: number,
 *   unlocked: boolean,
 * }} ModuleUnlock
 * @typedef {{
 *   canonicalPower: string|null,
 *   unlockedCount: number,
 *   complete: boolean,
 *   nextRank: number|null,
 *   nextModule: string|null,
 *   targetMerits: number|null,
 *   remainingMerits: number|null,
 *   fraction: number|null,
 *   order: ModuleUnlock[],
 * }} ModuleProgress
 * @typedef {{name: string|null, delta: number, influence: number}} FactionDelta
 */

const DATA_AS_OF = "2026-07";
/** @type {readonly number[]} */
const MODULE_RANKS = Object.freeze([34, 39, 44, 50, 57, 63, 70, 76, 83, 88, 91, 97]);
/** @type {Readonly<Record<number, number>>} */
const MODULE_MERITS = Object.freeze({
  34: 247000,
  39: 287000,
  44: 327000,
  50: 375000,
  57: 431000,
  63: 479000,
  70: 535000,
  76: 583000,
  83: 639000,
  88: 679000,
  91: 703000,
  97: 751000,
});

// Each Power grants its signature module first at rank 34. All twelve are
// available by rank 97; only their order differs between Powers.
/** @type {Readonly<Record<string, readonly string[]>>} */
const POWER_MODULES = Object.freeze({
  "Aisling Duval": [
    "Prismatic Shield Generator",
    "Imperial Hammer",
    "Advanced Plasma Accelerator",
    "Mining Lance",
    "Retributor",
    "Concord Cannon",
    "Pack-Hound Missile Rack",
    "Containment Missile",
    "Enforcer Cannon",
    "Pulse Disruptor",
    "Pacifier Frag-Cannon",
    "Cytoscrambler",
  ],
  "Archon Delaine": [
    "Cytoscrambler",
    "Containment Missile",
    "Pacifier Frag-Cannon",
    "Pulse Disruptor",
    "Advanced Plasma Accelerator",
    "Pack-Hound Missile Rack",
    "Mining Lance",
    "Enforcer Cannon",
    "Prismatic Shield Generator",
    "Concord Cannon",
    "Imperial Hammer",
    "Retributor",
  ],
  "Arissa Lavigny-Duval": [
    "Imperial Hammer",
    "Advanced Plasma Accelerator",
    "Mining Lance",
    "Prismatic Shield Generator",
    "Enforcer Cannon",
    "Pack-Hound Missile Rack",
    "Retributor",
    "Concord Cannon",
    "Containment Missile",
    "Cytoscrambler",
    "Pulse Disruptor",
    "Pacifier Frag-Cannon",
  ],
  "Denton Patreus": [
    "Advanced Plasma Accelerator",
    "Mining Lance",
    "Imperial Hammer",
    "Prismatic Shield Generator",
    "Pack-Hound Missile Rack",
    "Containment Missile",
    "Retributor",
    "Enforcer Cannon",
    "Concord Cannon",
    "Pacifier Frag-Cannon",
    "Pulse Disruptor",
    "Cytoscrambler",
  ],
  "Edmund Mahon": [
    "Retributor",
    "Concord Cannon",
    "Pack-Hound Missile Rack",
    "Enforcer Cannon",
    "Prismatic Shield Generator",
    "Containment Missile",
    "Pulse Disruptor",
    "Advanced Plasma Accelerator",
    "Mining Lance",
    "Imperial Hammer",
    "Pacifier Frag-Cannon",
    "Cytoscrambler",
  ],
  "Felicia Winters": [
    "Pulse Disruptor",
    "Pacifier Frag-Cannon",
    "Retributor",
    "Concord Cannon",
    "Prismatic Shield Generator",
    "Pack-Hound Missile Rack",
    "Containment Missile",
    "Enforcer Cannon",
    "Advanced Plasma Accelerator",
    "Imperial Hammer",
    "Mining Lance",
    "Cytoscrambler",
  ],
  "Jerome Archer": [
    "Pacifier Frag-Cannon",
    "Pulse Disruptor",
    "Containment Missile",
    "Enforcer Cannon",
    "Pack-Hound Missile Rack",
    "Concord Cannon",
    "Advanced Plasma Accelerator",
    "Cytoscrambler",
    "Prismatic Shield Generator",
    "Imperial Hammer",
    "Retributor",
    "Mining Lance",
  ],
  "Li Yong-Rui": [
    "Pack-Hound Missile Rack",
    "Enforcer Cannon",
    "Retributor",
    "Concord Cannon",
    "Pulse Disruptor",
    "Prismatic Shield Generator",
    "Containment Missile",
    "Imperial Hammer",
    "Mining Lance",
    "Cytoscrambler",
    "Pacifier Frag-Cannon",
    "Advanced Plasma Accelerator",
  ],
  "Nakato Kaine": [
    "Concord Cannon",
    "Retributor",
    "Pack-Hound Missile Rack",
    "Pulse Disruptor",
    "Enforcer Cannon",
    "Containment Missile",
    "Prismatic Shield Generator",
    "Imperial Hammer",
    "Advanced Plasma Accelerator",
    "Pacifier Frag-Cannon",
    "Cytoscrambler",
    "Mining Lance",
  ],
  "Pranav Antal": [
    "Enforcer Cannon",
    "Pack-Hound Missile Rack",
    "Containment Missile",
    "Pulse Disruptor",
    "Mining Lance",
    "Retributor",
    "Concord Cannon",
    "Cytoscrambler",
    "Pacifier Frag-Cannon",
    "Prismatic Shield Generator",
    "Imperial Hammer",
    "Advanced Plasma Accelerator",
  ],
  "Yuri Grom": [
    "Containment Missile",
    "Pack-Hound Missile Rack",
    "Advanced Plasma Accelerator",
    "Enforcer Cannon",
    "Pacifier Frag-Cannon",
    "Pulse Disruptor",
    "Prismatic Shield Generator",
    "Imperial Hammer",
    "Retributor",
    "Concord Cannon",
    "Mining Lance",
    "Cytoscrambler",
  ],
  "Zemina Torval": [
    "Mining Lance",
    "Advanced Plasma Accelerator",
    "Imperial Hammer",
    "Prismatic Shield Generator",
    "Containment Missile",
    "Pack-Hound Missile Rack",
    "Enforcer Cannon",
    "Pacifier Frag-Cannon",
    "Retributor",
    "Cytoscrambler",
    "Pulse Disruptor",
    "Concord Cannon",
  ],
});

/** @param {unknown} value */
function normalized(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** @type {Record<string, string>} */
const POWER_ALIASES = {};
Object.keys(POWER_MODULES).forEach((name) => {
  POWER_ALIASES[normalized(name)] = name;
});
POWER_ALIASES[normalized("A. Lavigny-Duval")] = "Arissa Lavigny-Duval";
POWER_ALIASES[normalized("Li Yong Rui")] = "Li Yong-Rui";

/**
 * @param {unknown} power
 * @returns {string|null}
 */
function canonicalPower(power) {
  return POWER_ALIASES[normalized(power)] || null;
}

/**
 * @param {unknown} reputation
 * @returns {ReputationBand|null}
 */
function reputationBand(reputation) {
  if (reputation == null || !Number.isFinite(Number(reputation))) return null;
  const rep = Number(reputation);
  // Journal Manual bands are lower-inclusive: -90 is Unfriendly, -35 is
  // Neutral, +4 is Cordial, +35 is Friendly, and +90 is Allied.
  if (rep < -90) return { label: "HOSTILE", className: "bad" };
  if (rep < -35) return { label: "UNFRIENDLY", className: "bad" };
  if (rep < 4) return { label: "NEUTRAL", className: "dim" };
  if (rep < 35) return { label: "CORDIAL", className: "dim" };
  if (rep < 90) return { label: "FRIENDLY", className: "good" };
  return { label: "ALLIED", className: "good" };
}

/**
 * @param {SystemPowerplay|null|undefined} systemPowerplay
 * @returns {string[]}
 */
function contestingPowers(systemPowerplay) {
  const sys = /** @type {SystemPowerplay} */ (systemPowerplay || {});
  const controller = normalized(sys.controlling);
  const seen = new Set();
  return (sys.powers || []).filter((power) => {
    const key = normalized(power);
    if (!key || key === controller || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * @param {unknown} power
 * @param {unknown} rank
 * @param {unknown} merits
 * @returns {ModuleProgress}
 */
function moduleProgress(power, rank, merits) {
  const numericRank =
    rank != null && rank !== "" && Number.isFinite(Number(rank)) ? Number(rank) : null;
  const numericMerits =
    merits != null && merits !== "" && Number.isFinite(Number(merits)) ? Number(merits) : null;
  const canonical = canonicalPower(power);
  const order = canonical ? POWER_MODULES[canonical] || null : null;
  const unlockedCount =
    numericRank == null ? 0 : MODULE_RANKS.filter((milestone) => numericRank >= milestone).length;
  const nextIndex = Math.min(unlockedCount, MODULE_RANKS.length - 1);
  const complete = unlockedCount >= MODULE_RANKS.length;
  const nextRank = complete ? null : /** @type {number} */ (MODULE_RANKS[nextIndex]);
  const previousRank = unlockedCount ? /** @type {number} */ (MODULE_RANKS[unlockedCount - 1]) : 0;
  const previousMerits = unlockedCount ? MODULE_MERITS[previousRank] || 0 : 0;
  const targetMerits = nextRank == null ? null : MODULE_MERITS[nextRank] || null;
  let fraction = null;
  if (!complete && numericMerits != null) {
    const span = Math.max(1, /** @type {number} */ (targetMerits) - previousMerits);
    fraction = Math.max(0, Math.min(1, (numericMerits - previousMerits) / span));
  } else if (!complete && numericRank != null) {
    const span = Math.max(1, /** @type {number} */ (nextRank) - previousRank);
    fraction = Math.max(0, Math.min(1, (numericRank - previousRank) / span));
  }
  return {
    canonicalPower: canonical,
    unlockedCount,
    complete,
    nextRank,
    nextModule: !complete && order ? /** @type {string} */ (order[nextIndex]) : null,
    targetMerits,
    remainingMerits:
      targetMerits == null || numericMerits == null
        ? null
        : Math.max(0, targetMerits - numericMerits),
    fraction,
    order: order
      ? order.map((moduleName, index) => ({
          module: moduleName,
          rank: /** @type {number} */ (MODULE_RANKS[index]),
          unlocked:
            numericRank != null && numericRank >= /** @type {number} */ (MODULE_RANKS[index]),
        }))
      : [],
  };
}

/**
 * @param {unknown} system
 * @param {GalaxySnapshotInput|null|undefined} galaxy
 * @param {string|null|undefined} observedAt
 * @returns {GalaxyObservation|null}
 */
function observation(system, galaxy, observedAt) {
  const gal = /** @type {GalaxySnapshotInput} */ (galaxy || {});
  if (
    !system ||
    (!(gal.factions || []).length && !gal.pp_system && !(gal.conflicts || []).length)
  ) {
    return null;
  }
  /** @type {GalaxyObservation} */
  const entry = {
    system: String(system),
    observed_at: observedAt || new Date().toISOString(),
    controlling_faction: gal.controlling_faction || null,
    factions: (gal.factions || []).map((faction) => ({
      name: faction.name || null,
      influence: faction.influence == null ? null : Number(faction.influence),
      state: faction.state || null,
    })),
    powerplay: gal.pp_system
      ? {
          controlling: gal.pp_system.controlling || null,
          state: gal.pp_system.state || null,
          control_progress:
            gal.pp_system.control_progress == null ? null : Number(gal.pp_system.control_progress),
          reinforcement:
            gal.pp_system.reinforcement == null ? null : Number(gal.pp_system.reinforcement),
          undermining: gal.pp_system.undermining == null ? null : Number(gal.pp_system.undermining),
        }
      : null,
    conflicts: (gal.conflicts || []).map((conflict) => ({
      type: conflict.war_type || null,
      status: conflict.status || null,
      faction1: conflict.faction1 ? [conflict.faction1.name, conflict.faction1.won_days] : null,
      faction2: conflict.faction2 ? [conflict.faction2.name, conflict.faction2.won_days] : null,
    })),
    signature: "",
  };
  entry.signature = JSON.stringify([
    entry.system,
    entry.controlling_faction,
    entry.factions,
    entry.powerplay,
    entry.conflicts,
  ]);
  return entry;
}

/**
 * @param {GalaxyObservation[]|null|undefined} history
 * @param {GalaxyObservation|null|undefined} entry
 * @param {unknown} [maxEntries]
 * @returns {GalaxyObservation[]}
 */
function appendObservation(history, entry, maxEntries) {
  const entries = Array.isArray(history) ? history.filter((item) => item && item.system) : [];
  if (!entry) return entries;
  const last = entries[entries.length - 1];
  if (last && last.system === entry.system && last.signature === entry.signature) return entries;
  const limit = Math.max(10, Number(maxEntries) || 300);
  return entries.concat(entry).slice(-limit);
}

/**
 * @param {GalaxyObservation|null|undefined} current
 * @param {GalaxyObservation|null|undefined} previous
 * @returns {FactionDelta[]}
 */
function factionDeltas(current, previous) {
  if (!current || !previous) return [];
  const before = new Map((previous.factions || []).map((faction) => [faction.name, faction]));
  return (current.factions || [])
    .map((faction) => {
      const old = before.get(faction.name);
      if (!old || old.influence == null || faction.influence == null) return null;
      return {
        name: faction.name,
        delta: (faction.influence - old.influence) * 100,
        influence: faction.influence * 100,
      };
    })
    .filter((item) => item !== null)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

const GalaxyData = Object.freeze({
  DATA_AS_OF,
  MODULE_RANKS,
  MODULE_MERITS,
  POWER_MODULES,
  canonicalPower,
  reputationBand,
  contestingPowers,
  moduleProgress,
  observation,
  appendObservation,
  factionDeltas,
});

export {
  DATA_AS_OF,
  MODULE_RANKS,
  MODULE_MERITS,
  POWER_MODULES,
  canonicalPower,
  reputationBand,
  contestingPowers,
  moduleProgress,
  observation,
  appendObservation,
  factionDeltas,
};
export default GalaxyData;
