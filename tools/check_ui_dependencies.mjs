import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceRoot = path.join(root, "ui", "src");
const failures = [];

const layerRank = new Map([
  ["core", 0],
  ["data", 0],
  ["api", 1],
  ["features", 2],
  ["shell", 2],
  ["bootstrap", 3],
  ["main.js", 4],
]);

/**
 * Direction exceptions must identify one exact edge and explain why inversion
 * is unavoidable. Keep this empty unless composition cannot remove the edge.
 *
 * @type {Map<string, string>}
 */
const directionExceptions = new Map();

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(target);
    return entry.isFile() && target.endsWith(".js") && !target.endsWith(".test.js") ? [target] : [];
  });
}

/** @param {string} filename */
function sourceRelative(filename) {
  return path.relative(sourceRoot, filename).split(path.sep).join("/");
}

/** @param {string} relative */
function sourceLayer(relative) {
  return relative === "main.js" ? "main.js" : relative.split("/")[0];
}

/** @param {string} source */
function importSpecifiers(source) {
  const specifiers = new Set();
  for (const declaration of source.matchAll(/^\s*import\b[\s\S]*?;\s*$/gmu)) {
    const match =
      declaration[0].match(/\bfrom\s*["']([^"']+)["']/u) ??
      declaration[0].match(/^\s*import\s*["']([^"']+)["']/u);
    if (match) specifiers.add(match[1]);
  }
  for (const declaration of source.matchAll(
    /^\s*export\s+(?:\*|\{)[\s\S]*?\bfrom\s*["'][^"']+["']\s*;\s*$/gmu,
  )) {
    const match = declaration[0].match(/\bfrom\s*["']([^"']+)["']/u);
    if (match) specifiers.add(match[1]);
  }
  for (const match of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu)) {
    specifiers.add(match[1]);
  }
  return [...specifiers];
}

const files = walk(sourceRoot);
const fileSet = new Set(files.map((filename) => path.normalize(filename)));
/** @type {Map<string, string[]>} */
const graph = new Map();
let edgeCount = 0;

for (const filename of files) {
  const relative = sourceRelative(filename);
  const layer = sourceLayer(relative);
  const rank = layerRank.get(layer);
  if (rank === undefined) {
    failures.push(`${relative} belongs to an unclassified architecture layer.`);
    continue;
  }

  const dependencies = [];
  const source = fs.readFileSync(filename, "utf8");
  for (const specifier of importSpecifiers(source)) {
    if (!specifier.startsWith(".")) {
      failures.push(
        `${relative} imports runtime package "${specifier}"; the UI must stay self-contained.`,
      );
      continue;
    }

    const target = path.normalize(path.resolve(path.dirname(filename), specifier));
    if (!target.startsWith(`${path.normalize(sourceRoot)}${path.sep}`) || !fileSet.has(target)) {
      failures.push(`${relative} imports missing or out-of-graph module "${specifier}".`);
      continue;
    }

    const targetRelative = sourceRelative(target);
    const targetLayer = sourceLayer(targetRelative);
    const targetRank = layerRank.get(targetLayer);
    dependencies.push(targetRelative);
    edgeCount += 1;

    const edge = `${relative} -> ${targetRelative}`;
    if (targetRank !== undefined && targetRank > rank && !directionExceptions.has(edge)) {
      failures.push(
        `${edge} reverses dependency direction (${layer} may not depend on ${targetLayer}).`,
      );
    }
    if (relative === "main.js" && targetLayer !== "bootstrap") {
      failures.push(`${edge} bypasses the bootstrap composition boundary.`);
    }
  }
  graph.set(relative, dependencies);
}

/** @param {string[]} cycle */
function canonicalCycle(cycle) {
  const nodes = cycle.slice(0, -1);
  let first = 0;
  for (let index = 1; index < nodes.length; index += 1) {
    if (nodes[index] < nodes[first]) first = index;
  }
  const rotated = nodes.slice(first).concat(nodes.slice(0, first));
  return rotated.concat(rotated[0]).join(" -> ");
}

const visitState = new Map();
const stack = [];
const cycles = new Set();

/** @param {string} node */
function visit(node) {
  visitState.set(node, 1);
  stack.push(node);
  for (const dependency of graph.get(node) ?? []) {
    const state = visitState.get(dependency) ?? 0;
    if (state === 0) {
      visit(dependency);
    } else if (state === 1) {
      const start = stack.indexOf(dependency);
      cycles.add(canonicalCycle(stack.slice(start).concat(dependency)));
    }
  }
  stack.pop();
  visitState.set(node, 2);
}

for (const node of graph.keys()) {
  if (!visitState.has(node)) visit(node);
}
for (const cycle of [...cycles].sort()) {
  failures.push(`circular dependency: ${cycle}.`);
}

if (failures.length) {
  process.stderr.write(`UI dependency check failed:\n  ${failures.join("\n  ")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `UI dependencies OK: ${files.length} modules, ${edgeCount} edges, one-way layers, no cycles.\n`,
  );
}
