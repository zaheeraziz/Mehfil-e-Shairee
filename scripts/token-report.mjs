import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const draftsDir = path.join(root, "content", "drafts");
const files = (await readdir(draftsDir)).filter(file => file.endsWith(".json")).sort();
const rows = [];

for (const file of files) {
  const draft = JSON.parse(await readFile(path.join(draftsDir, file), "utf8"));
  rows.push({
    poem: draft.id,
    stage: "draft",
    model: draft.generator?.model || "unknown",
    input: draft.usage?.inputTokens ?? "not recorded",
    output: draft.usage?.outputTokens ?? "not recorded",
    thinking: draft.usage?.thinkingTokens ?? "not recorded",
    total: draft.usage?.totalTokens ?? "not recorded",
    costUsd: draft.cost?.totalUsd ?? null
  });

  if (draft.enrichment?.usage) {
    rows.push({
      poem: draft.id,
      stage: draft.enrichment.purpose || "enrichment",
      model: draft.enrichment.model || "unknown",
      input: draft.enrichment.usage.inputTokens ?? "not recorded",
      output: draft.enrichment.usage.outputTokens ?? "not recorded",
      thinking: draft.enrichment.usage.thinkingTokens ?? "not recorded",
      total: draft.enrichment.usage.totalTokens ?? "not recorded",
      costUsd: draft.enrichment.cost?.totalUsd ?? null
    });
  }
}

console.table(rows);
const measured = rows.filter(row => typeof row.total === "number");
if (!measured.length) {
  console.log("No historical usage was recorded. New Gemini drafts will include exact API usage metadata.");
  process.exit(0);
}

const sum = key => measured.reduce((total, row) => total + row[key], 0);
console.log("\nMeasured totals");
console.log(`Input tokens:    ${sum("input").toLocaleString("en-US")}`);
console.log(`Output tokens:   ${sum("output").toLocaleString("en-US")}`);
console.log(`Thinking tokens: ${sum("thinking").toLocaleString("en-US")}`);
console.log(`Total tokens:    ${sum("total").toLocaleString("en-US")}`);
const measuredCost = measured.filter(row => typeof row.costUsd === "number");
console.log(measuredCost.length
  ? `Estimated cost:  $${measuredCost.reduce((total, row) => total + row.costUsd, 0).toFixed(6)} USD`
  : "Estimated cost:  unavailable for the recorded model");
