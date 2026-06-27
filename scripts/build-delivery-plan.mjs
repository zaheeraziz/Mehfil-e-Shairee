import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const approval = JSON.parse(await readFile(path.join(root, "content", "approved-readings.json"), "utf8"));

if (approval?.schemaVersion !== 1 || !Array.isArray(approval.ids)) {
  throw new Error("approved-readings.json must contain a schemaVersion 1 ids array.");
}

const readings = [];
for (const [index, id] of approval.ids.entries()) {
  const draft = JSON.parse(await readFile(path.join(root, "content", "drafts", `${id}.json`), "utf8"));
  readings.push({
    sequence: index + 1,
    id,
    title: draft.source.title,
    transliteration: draft.source.transliteration || "",
    collection: draft.source.collection,
    sourceUrl: draft.source.sourceUrl,
    status: "planned"
  });
}

await writeFile(
  path.join(root, "content", "delivery-plan.json"),
  `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: "content/approved-readings.json",
    totalReadings: readings.length,
    readings
  }, null, 2)}\n`,
  "utf8"
);

console.log(`Wrote ${readings.length} planned readings to content/delivery-plan.json.`);
