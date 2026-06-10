// Year-over-year structural diff for rule tables.
// Reads two year files and prints a human-reviewable side-by-side diff of all
// leaf values. Tiny indexation changes look like noise; structural changes pop.
// Usage:  node --experimental-strip-types yoy-diff.ts 2024 2025

import { readRules, type SupportedYear } from './load.ts';

type Leaf = { path: string; value: number | string | boolean | null };

// Metadata fields whose changes are bookkeeping, not behaviour. Hide them so the
// diff signal is purely "did a value change?".
function isNoise(path: string): boolean {
  if (path === 'tax_year' || path === 'settlements_file') return true;
  if (path.startsWith('citations')) return true;
  if (path.startsWith('verification')) return true;
  if (path.endsWith('.cite')) return true;
  if (path.endsWith('.notes')) return true;
  if (/^notes\[\d+\]$/.test(path)) return true;
  return false;
}

function collectLeaves(obj: unknown, path: string, out: Leaf[]): void {
  if (isNoise(path)) return;
  if (obj === null || obj === undefined) {
    out.push({ path, value: null });
    return;
  }
  if (typeof obj !== 'object') {
    out.push({ path, value: obj as Leaf['value'] });
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => collectLeaves(v, `${path}[${i}]`, out));
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    collectLeaves(v, path ? `${path}.${k}` : k, out);
  }
}

function diff(prev: Leaf[], curr: Leaf[]): { changed: Array<[string, unknown, unknown]>; added: Leaf[]; removed: Leaf[] } {
  const prevMap = new Map(prev.map((l) => [l.path, l.value]));
  const currMap = new Map(curr.map((l) => [l.path, l.value]));
  const changed: Array<[string, unknown, unknown]> = [];
  const added: Leaf[] = [];
  const removed: Leaf[] = [];
  for (const { path, value } of curr) {
    if (!prevMap.has(path)) added.push({ path, value });
    else if (prevMap.get(path) !== value) changed.push([path, prevMap.get(path), value]);
  }
  for (const { path, value } of prev) {
    if (!currMap.has(path)) removed.push({ path, value });
  }
  return { changed, added, removed };
}

const args = process.argv.slice(2);
const yearA = Number(args[0]);
const yearB = Number(args[1]);
if (!yearA || !yearB) {
  console.error('usage: yoy-diff.ts <prev-year> <curr-year>   (e.g. 2024 2025)');
  process.exit(2);
}

// Allow diffing unverified scaffolds — that's the whole point of this tool.
const prev = await readRules(yearA as SupportedYear, { requireVerified: false });
const curr = await readRules(yearB as SupportedYear, { requireVerified: false });

const prevLeaves: Leaf[] = [];
const currLeaves: Leaf[] = [];
collectLeaves(prev, '', prevLeaves);
collectLeaves(curr, '', currLeaves);

const { changed, added, removed } = diff(prevLeaves, currLeaves);

const sep = '─'.repeat(72);
console.log(sep);
console.log(`YoY diff: ${yearA} → ${yearB}`);
console.log(sep);
if (changed.length === 0 && added.length === 0 && removed.length === 0) {
  console.log('(no structural changes)');
} else {
  if (changed.length) {
    console.log(`Changed (${changed.length}):`);
    for (const [p, a, b] of changed) console.log(`  ${p}\n      ${yearA}: ${fmt(a)}\n      ${yearB}: ${fmt(b)}`);
  }
  if (added.length) {
    console.log(`\nAdded (${added.length}):`);
    for (const { path, value } of added) console.log(`  + ${path} = ${fmt(value)}`);
  }
  if (removed.length) {
    console.log(`\nRemoved (${removed.length}):`);
    for (const { path, value } of removed) console.log(`  - ${path} = ${fmt(value)}`);
  }
}
console.log(sep);

function fmt(v: unknown): string {
  return v === null ? 'null' : typeof v === 'string' ? JSON.stringify(v) : String(v);
}
