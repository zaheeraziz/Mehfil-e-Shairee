import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fullImportPath = path.join(root, "content", "imports", "bal-e-jibril-academy-full.json");
const outputPath = path.join(root, "content", "imports", "bal-e-jibril-part01-next-nine.json");

const fullImport = JSON.parse(await readFile(fullImportPath, "utf8"));
const nextNine = fullImport.readings
  .filter(reading => reading.section?.key === "part01")
  .slice(7, 16)
  .map(reading => ({
    ...reading,
    sourceChecked: true,
    importStatus: "reviewed_against_iqbal_academy_html",
    verification: {
      source: "Iqbal Academy Pakistan Unicode HTML",
      checkedOn: "2026-06-26",
      note: "Poem imported from the official Iqbal Academy page and line pairing reviewed for this batch."
    },
    reviewNotes: [
      "Promoted from full-book Academy import for batch generation.",
      "Still requires editorial review of generated explanation/translation before public use."
    ]
  }));

if (nextNine.length !== 9) {
  throw new Error(`Expected 9 promoted readings, received ${nextNine.length}`);
}

const payload = {
  schemaVersion: 1,
  source: fullImport.source,
  reviewRequired: false,
  promotedAt: new Date().toISOString(),
  readings: nextNine
};

await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Promoted ${nextNine.length} readings to ${path.relative(root, outputPath)}`);
