import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ICON = { critical: "🚨", warning: "⚠️", suggestion: "💡" };
const ORDER = { critical: 0, warning: 1, suggestion: 2 };

export function renderFindings(review) {
  const lines = [`## ${review.agent}`, "", review.summary, ""];
  const sorted = [...review.findings].sort(
    (a, b) => ORDER[a.severity] - ORDER[b.severity],
  );
  if (sorted.length === 0) lines.push("✅ No issues found.");
  for (const f of sorted) {
    const loc = f.line != null ? `${f.file}:${f.line}` : f.file;
    lines.push(`- ${ICON[f.severity] ?? "•"} **${f.title}** (\`${loc}\`)`, `  ${f.detail}`);
    if (f.suggestion) lines.push(`  _Suggestion:_ ${f.suggestion}`);
  }
  return lines.join("\n");
}

// CLI: node render-findings.mjs findings-x.json
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const review = JSON.parse(readFileSync(process.argv[2], "utf8"));
  process.stdout.write(renderFindings(review) + "\n");
}
