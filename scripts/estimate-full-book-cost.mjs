import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { calculateGeminiCost } from "./gemini-pricing.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const model = process.argv[2] || "gemini-3.1-flash-lite";
const fullImport = JSON.parse(await readFile(path.join(root, "content", "imports", "bal-e-jibril-academy-full.json"), "utf8"));
const draftsDir = path.join(root, "content", "drafts");
const draftFiles = (await readdir(draftsDir)).filter(file => file.endsWith(".json"));

const measured = [];
for (const file of draftFiles) {
  const draft = JSON.parse(await readFile(path.join(draftsDir, file), "utf8"));
  const couplets = draft.source?.verses?.length || 0;
  const usage = draft.enrichment?.usage;
  if (!couplets || !usage?.totalTokens) continue;
  measured.push({ couplets, usage });
}

const totalCouplets = fullImport.readings.reduce((total, reading) => total + reading.verses.length, 0);
const measuredCouplets = measured.reduce((total, item) => total + item.couplets, 0);

if (!measuredCouplets) {
  throw new Error("No measured enrichment usage is available for estimating.");
}

const avg = key => measured.reduce((total, item) => total + (item.usage[key] || 0), 0) / measuredCouplets;
const estimatedUsage = {
  source: "estimated_from_existing_enrichment_usage",
  inputTokens: Math.round(avg("inputTokens") * totalCouplets),
  cachedInputTokens: 0,
  outputTokens: Math.round(avg("outputTokens") * totalCouplets),
  thinkingTokens: Math.round(avg("thinkingTokens") * totalCouplets),
  totalTokens: Math.round(avg("totalTokens") * totalCouplets)
};

const cost = calculateGeminiCost(model, estimatedUsage);

console.log({
  model,
  fullBookEntries: fullImport.readings.length,
  fullBookVerseBlocks: totalCouplets,
  measuredSampleVerseBlocks: measuredCouplets,
  estimateBasis: "English translation + historical context enrichment only. New full annotation drafts may cost more.",
  estimatedUsage,
  estimatedCostUsd: cost?.totalUsd ?? null
});
