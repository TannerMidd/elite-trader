"""Static Galaxy-page correctness: PP2 rewards, BGS reputation and local history."""
import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
MODULE = ROOT / "ui" / "galaxy-data.js"
APP = ROOT / "ui" / "app.js"
INDEX = ROOT / "ui" / "index.html"


def run_node(source):
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, capture_output=True, text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


run_node(f"""
const assert = require('assert');
const galaxy = require({json.dumps(str(MODULE))});

assert.strictEqual(Object.keys(galaxy.POWER_MODULES).length, 12);
assert.strictEqual(galaxy.DATA_AS_OF, '2026-07');
for (const modules of Object.values(galaxy.POWER_MODULES)) {{
  assert.strictEqual(modules.length, 12);
  assert.strictEqual(new Set(modules).size, 12);
}}
assert.strictEqual(galaxy.canonicalPower('A. Lavigny-Duval'), 'Arissa Lavigny-Duval');
assert.strictEqual(galaxy.canonicalPower('li yong rui'), 'Li Yong-Rui');

// Journal Manual bands are lower-inclusive at -90, -35, +4, +35 and +90.
assert.strictEqual(galaxy.reputationBand(-90.01).label, 'HOSTILE');
assert.strictEqual(galaxy.reputationBand(-90).label, 'UNFRIENDLY');
assert.strictEqual(galaxy.reputationBand(-35).label, 'NEUTRAL');
assert.strictEqual(galaxy.reputationBand(4).label, 'CORDIAL');
assert.strictEqual(galaxy.reputationBand(35).label, 'FRIENDLY');
assert.strictEqual(galaxy.reputationBand(90).label, 'ALLIED');

assert.deepStrictEqual(
  galaxy.contestingPowers({{
    controlling: 'A. Lavigny-Duval',
    powers: ['A. Lavigny-Duval', 'Aisling Duval', 'Aisling Duval'],
  }}),
  ['Aisling Duval'],
);

let rewards = galaxy.moduleProgress('Aisling Duval', 33, 246000);
assert.strictEqual(rewards.unlockedCount, 0);
assert.strictEqual(rewards.nextRank, 34);
assert.strictEqual(rewards.nextModule, 'Prismatic Shield Generator');
assert.strictEqual(rewards.remainingMerits, 1000);
rewards = galaxy.moduleProgress('Aisling Duval', 34, 247000);
assert.strictEqual(rewards.unlockedCount, 1);
assert.strictEqual(rewards.nextRank, 39);
assert.strictEqual(rewards.nextModule, 'Imperial Hammer');
rewards = galaxy.moduleProgress('Aisling Duval', 97, 751000);
assert.strictEqual(rewards.complete, true);
assert.strictEqual(rewards.unlockedCount, 12);
rewards = galaxy.moduleProgress('Aisling Duval', null, null);
assert.strictEqual(rewards.nextRank, 34);
assert.strictEqual(rewards.fraction, null);

const baseGalaxy = {{
  controlling_faction: 'Faction A',
  factions: [{{name: 'Faction A', influence: 0.40, state: 'Boom'}}],
  pp_system: {{controlling: 'Aisling Duval', state: 'Fortified', control_progress: 0.45}},
  conflicts: [],
}};
const first = galaxy.observation('Test', baseGalaxy, '2026-01-01T00:00:00Z');
let history = galaxy.appendObservation([], first);
history = galaxy.appendObservation(history, galaxy.observation(
  'Test', baseGalaxy, '2026-01-02T00:00:00Z'));
assert.strictEqual(history.length, 1); // polling/reload does not invent a change
const changed = galaxy.observation('Test', {{
  ...baseGalaxy,
  factions: [{{name: 'Faction A', influence: 0.415, state: 'Boom'}}],
}}, '2026-01-03T00:00:00Z');
history = galaxy.appendObservation(history, changed);
assert.strictEqual(history.length, 2);
assert.ok(Math.abs(galaxy.factionDeltas(changed, first)[0].delta - 1.5) < 1e-9);
""")

for script in (MODULE, APP):
    result = subprocess.run(
        ["node", "--check", str(script)], cwd=ROOT, capture_output=True, text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr

index = INDEX.read_text(encoding="utf-8")
app = APP.read_text(encoding="utf-8")
assert "twelve Powers" in index and "eleven Powers" not in index
assert index.index('src="galaxy-data.js"') < index.index('src="app.js"')
assert "latest local system snapshot" in index
assert "LOCAL VISIT HISTORY" in index
assert "rating 3+" not in app.lower()
assert "conflict_progress" in app
assert "Elections have no conflict zones or combat bonds" in app
assert "contestingPowers(sys)" in app

print("galaxy UI OK: 12 Powers, PP2 milestones, reputation bands, contenders, conflict progress/history")
