import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const uiRoot = path.join(root, "ui");
const sourceRoot = path.join(uiRoot, "src");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(target);
    return entry.isFile() && target.endsWith(".js") && !target.endsWith(".test.js") ? [target] : [];
  });
}

const markupSources = [path.join(uiRoot, "index.html"), ...walk(sourceRoot)];
const declared = new Map();
for (const filename of markupSources) {
  const source = fs.readFileSync(filename, "utf8");
  for (const match of source.matchAll(/\bid\s*=\s*["']([^"'<>]+)["']/gu)) {
    const id = match[1];
    if (id.includes("${")) continue;
    const locations = declared.get(id) ?? [];
    locations.push(path.relative(root, filename));
    declared.set(id, locations);
  }
}

const duplicateIds = [...declared]
  .filter(([, locations]) => locations.length > 1)
  .map(([id, locations]) => `${id}: ${locations.join(", ")}`);

const referenced = new Map();
for (const filename of walk(sourceRoot)) {
  const source = fs.readFileSync(filename, "utf8");
  const patterns = [
    /\$\(\s*["']([^"']+)["']\s*\)/gu,
    /\b(?:byId|requireById)\(\s*["']([^"']+)["']/gu,
    /\bgetElementById\(\s*["']([^"']+)["']\s*\)/gu,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const id = match[1];
      const locations = referenced.get(id) ?? [];
      locations.push(path.relative(root, filename));
      referenced.set(id, locations);
    }
  }
}

const missingIds = [...referenced]
  .filter(([id]) => !declared.has(id))
  .map(([id, locations]) => `${id}: ${[...new Set(locations)].join(", ")}`);

if (duplicateIds.length || missingIds.length) {
  if (duplicateIds.length) {
    process.stderr.write(`Duplicate UI ids:\n  ${duplicateIds.join("\n  ")}\n`);
  }
  if (missingIds.length) {
    process.stderr.write(`Missing literal UI ids:\n  ${missingIds.join("\n  ")}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(
    `UI DOM contract OK: ${declared.size} unique ids, ${referenced.size} literal references.\n`,
  );
}
