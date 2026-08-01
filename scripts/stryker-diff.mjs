import { execFileSync, spawnSync } from "node:child_process";

const base = process.argv[2] ?? "dev";
const diff = execFileSync(
  "git",
  ["diff", "--unified=0", "--diff-filter=ACMRTUXB", `${base}...HEAD`, "--", "src"],
  { encoding: "utf8" }
);

const ranges = [];
let file;
for (const line of diff.split("\n")) {
  if (line.startsWith("+++ b/")) {
    file = line.slice(6);
    continue;
  }
  const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
  if (!file || !hunk) continue;
  if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue;
  if (/\.(test|spec|d)\.(ts|tsx|js|jsx)$/.test(file)) continue;
  const start = Number(hunk[1]);
  const count = Number(hunk[2] ?? 1);
  if (count > 0) ranges.push(`${file}:${start}-${start + count - 1}`);
}

if (ranges.length === 0) {
  console.log(`No changed production lines found against ${base}.`);
  process.exit(0);
}

console.log(`Mutation scope against ${base}:\n${ranges.join("\n")}`);
const result = spawnSync(
  "pnpm",
  ["exec", "stryker", "run", "--mutate", ranges.join(",")],
  { stdio: "inherit" }
);
process.exit(result.status ?? 1);
