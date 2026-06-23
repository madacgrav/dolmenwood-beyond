import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ORDER = { critical: 0, warning: 1, suggestion: 2 };
const ICON = { critical: "🚨", warning: "⚠️", suggestion: "💡" };
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function synthesize(reviews) {
  const byKey = new Map();
  for (const r of reviews) {
    for (const f of r.findings) {
      const key = `${f.file}:${f.line}:${norm(f.title)}`;
      const cur = byKey.get(key);
      if (!cur) byKey.set(key, { ...f, agents: [r.agent] });
      else {
        cur.agents.push(r.agent);
        if (ORDER[f.severity] < ORDER[cur.severity]) cur.severity = f.severity;
      }
    }
  }
  const merged = [...byKey.values()].sort(
    (a, b) => ORDER[a.severity] - ORDER[b.severity],
  );
  const lines = ["## 🤖 Consolidated Review", ""];
  if (merged.length === 0) lines.push("✅ No issues raised by any reviewer.");
  for (const f of merged) {
    const loc = f.line != null ? `${f.file}:${f.line}` : f.file;
    lines.push(
      `- ${ICON[f.severity]} **${f.title}** (\`${loc}\`) — _${[...new Set(f.agents)].join(", ")}_`,
      `  ${f.detail}`,
    );
    if (f.suggestion) lines.push(`  _Suggestion:_ ${f.suggestion}`);
  }
  return lines.join("\n");
}

// CLI: node synthesize-findings.mjs <dir-of-findings-json>
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2] ?? ".";
  const reviews = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")));
  process.stdout.write(synthesize(reviews) + "\n");
}
