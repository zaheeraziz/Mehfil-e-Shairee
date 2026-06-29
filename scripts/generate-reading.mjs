import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGeminiConfig, requestGeminiContent } from "./gemini-client.mjs";
import { calculateGeminiCost } from "./gemini-pricing.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "content", "source-poems.json");
const cliArgs = process.argv.slice(2);
const dryRun = cliArgs.includes("--dry-run");
const requestedId = cliArgs.find(arg => !arg.startsWith("--"));

await loadEnvFile(path.join(root, ".env"));

const sourceLibrary = JSON.parse(await readFile(sourcePath, "utf8"));
sourceLibrary.readings.push(...await loadReviewedImports());
validateSourceLibrary(sourceLibrary);

const reading = requestedId
  ? sourceLibrary.readings.find(item => item.id === requestedId)
  : sourceLibrary.readings[0];

if (!reading) {
  throw new Error(`Reading not found: ${requestedId}`);
}

if (dryRun) {
  console.log(`Source is valid: ${reading.id} (${reading.verses.length} couplets)`);
  console.log("No API request was made and no draft was written.");
  process.exit(0);
}

const geminiConfig = getGeminiConfig();

const historicalContextSchema = {
  type: "OBJECT",
  required: ["period", "place", "summaryUrdu", "summaryEnglish", "confidence", "sourceNote"],
  properties: {
    period: { type: "STRING" },
    place: { type: "STRING" },
    summaryUrdu: { type: "STRING" },
    summaryEnglish: { type: "STRING" },
    confidence: { type: "STRING", enum: ["verified", "likely", "unknown"] },
    sourceNote: { type: "STRING" }
  }
};

const annotationSchema = {
  type: "OBJECT",
  required: ["verseAnnotations", "reflectionQuestion", "takeaway", "themes", "historicalContext", "editorialWarnings"],
  properties: {
    verseAnnotations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["verseIndex", "explanationUrdu", "englishTranslation", "difficultWords"],
        properties: {
          verseIndex: { type: "INTEGER" },
          explanationUrdu: { type: "STRING" },
          englishTranslation: { type: "STRING" },
          difficultWords: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              required: ["term", "meaningUrdu"],
              properties: {
                term: { type: "STRING" },
                meaningUrdu: { type: "STRING" }
              }
            }
          }
        }
      }
    },
    reflectionQuestion: { type: "STRING" },
    takeaway: { type: "STRING" },
    themes: { type: "ARRAY", items: { type: "STRING" } },
    historicalContext: historicalContextSchema,
    editorialWarnings: { type: "ARRAY", items: { type: "STRING" } }
  }
};

const prompt = `Create a review draft for the verified Iqbal poem supplied as JSON.

Rules:
- Never rewrite, correct, complete, or quote an alternative version of the original Urdu.
- Return exactly one verseAnnotations item for every supplied couplet, in the same order.
- verseIndex is zero-based.
- explanationUrdu must be simple, educational Urdu and must not claim a single definitive interpretation.
- englishTranslation must translate the supplied couplet into clear modern English. Preserve the poetic sense, but do not add ideas not present in the couplet.
- difficultWords may contain only words or phrases that visibly occur in that couplet.
- meaningUrdu must be a concise lexical meaning, not a symbolic interpretation. Do not use "مراد" inside word meanings.
- Put metaphorical or philosophical interpretation only in explanationUrdu, with cautious phrasing.
- Do not invent poem-specific date, place, or biographical context from general knowledge. Use only facts explicitly present in the supplied source metadata.
- historicalContext must be cautious:
  - period should be the poem-specific writing period if supplied; otherwise use the collection publication context if supplied; otherwise "Unknown".
  - place should be the poem-specific writing place if supplied; otherwise "Unknown".
  - confidence must be "verified" only when the supplied metadata contains the exact fact, "likely" for collection-level context, and "unknown" when source metadata is insufficient.
  - summaryUrdu and summaryEnglish must clearly distinguish collection-level context from poem-specific context.
- Put every uncertain interpretation or unsupported claim in editorialWarnings.
- The reflectionQuestion and takeaway must be in clear English.
- This is a draft for human review, never publication-ready content.

Verified source reading:
${JSON.stringify(reading)}`;

const { payload, provider, model, fallbackUsed } = await requestGeminiContent({
  config: geminiConfig,
  systemInstruction: "You are an Urdu literature teaching assistant. Accuracy, textual fidelity, and explicit uncertainty matter more than fluency.",
  prompt,
  generationConfig: {
    temperature: 0.2,
    responseMimeType: "application/json",
    responseSchema: annotationSchema
  }
});
if (fallbackUsed) console.warn(`Draft generation fell back to ${provider}.`);

const rawText = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("");
if (!rawText) {
  throw new Error("Gemini returned no text content.");
}

let annotations;
try {
  annotations = JSON.parse(rawText);
} catch {
  throw new Error("Gemini did not return valid JSON.");
}

validateAnnotations(reading, annotations);

const apiUsage = payload.usageMetadata || {};
const usage = {
  source: "generateContent.usageMetadata",
  inputTokens: apiUsage.promptTokenCount ?? null,
  cachedInputTokens: apiUsage.cachedContentTokenCount ?? 0,
  outputTokens: apiUsage.candidatesTokenCount ?? null,
  thinkingTokens: apiUsage.thoughtsTokenCount ?? 0,
  totalTokens: apiUsage.totalTokenCount ?? null
};
const hasMeasuredUsage = [usage.inputTokens, usage.outputTokens, usage.totalTokens]
  .every(Number.isFinite);
const cost = hasMeasuredUsage ? calculateGeminiCost(model, usage) : null;

const draft = {
  schemaVersion: 1,
  id: reading.id,
  status: "draft",
  generatedAt: new Date().toISOString(),
  generator: { provider, model },
  usage,
  cost,
  source: reading,
  annotations
};

const draftsDir = path.join(root, "content", "drafts");
await mkdir(draftsDir, { recursive: true });
const outputPath = path.join(draftsDir, `${reading.id}.json`);
await writeFile(outputPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");

console.log(`Draft written: ${path.relative(root, outputPath)}`);
console.log("Status: draft. Human review is required before website or email use.");

function validateSourceLibrary(library) {
  if (library?.schemaVersion !== 1 || !Array.isArray(library.readings) || !library.readings.length) {
    throw new Error("source-poems.json must contain a non-empty schemaVersion 1 readings array.");
  }

  const ids = new Set();
  for (const item of library.readings) {
    if (!item.id || ids.has(item.id)) throw new Error(`Missing or duplicate reading id: ${item.id || "(empty)"}`);
    ids.add(item.id);
    if (!item.sourceChecked || !item.sourceUrl) throw new Error(`${item.id} must have a checked source and source URL.`);
    if (!Array.isArray(item.verses) || !item.verses.length) throw new Error(`${item.id} has no verses.`);
    item.verses.forEach((verse, index) => {
      if (!Array.isArray(verse.lines) || verse.lines.length !== 2 || verse.lines.some(line => !line.trim())) {
        throw new Error(`${item.id} verse ${index} must contain exactly two non-empty lines.`);
      }
    });
  }
}

function validateAnnotations(source, result) {
  if (!result || !Array.isArray(result.verseAnnotations)) throw new Error("Draft is missing verseAnnotations.");
  if (result.verseAnnotations.length !== source.verses.length) {
    throw new Error(`Expected ${source.verses.length} annotations, received ${result.verseAnnotations.length}.`);
  }

  result.verseAnnotations.forEach((annotation, index) => {
    if (annotation.verseIndex !== index) throw new Error(`Annotation ${index} has an invalid verseIndex.`);
    if (!annotation.explanationUrdu?.trim()) throw new Error(`Annotation ${index} has no Urdu explanation.`);
    if (!Array.isArray(annotation.difficultWords)) throw new Error(`Annotation ${index} has invalid difficultWords.`);

    const couplet = normalizeUrdu(source.verses[index].lines.join(" "));
    const seenTerms = new Set();
    for (const word of annotation.difficultWords) {
      const term = normalizeUrdu(word?.term || "");
      if (!term || !word?.meaningUrdu?.trim()) throw new Error(`Annotation ${index} contains an incomplete word meaning.`);
      if (!couplet.includes(term)) throw new Error(`Gemini suggested a word not present in couplet ${index + 1}: ${word.term}`);
      if (seenTerms.has(term)) throw new Error(`Duplicate difficult word in couplet ${index + 1}: ${word.term}`);
      seenTerms.add(term);
    }
  });

  for (const key of ["reflectionQuestion", "takeaway"]) {
    if (!result[key]?.trim()) throw new Error(`Draft is missing ${key}.`);
  }
  if (!result.historicalContext?.summaryUrdu?.trim() || !result.historicalContext?.summaryEnglish?.trim()) {
    throw new Error("Draft is missing historicalContext.");
  }
  if (!Array.isArray(result.themes) || !Array.isArray(result.editorialWarnings)) {
    throw new Error("Draft themes or editorialWarnings are invalid.");
  }
}

function normalizeUrdu(value) {
  return value
    .normalize("NFKC")
    .replace(/[ۂۀ]/g, "ہ")
    .replace(/ہ[ٔء]/g, "ہ")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[،؛؟,.!:'"()\[\]{}\sـ-]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک");
}

async function loadEnvFile(filePath) {
  let contents;
  try {
    contents = await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) throw new Error(`Invalid .env line: ${rawLine}`);

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) process.env[key] = value;
  }
}

async function loadReviewedImports() {
  const importsDir = path.join(root, "content", "imports");
  const files = (await readdir(importsDir)).filter(file => file.endsWith(".json")).sort();
  const readings = [];

  for (const file of files) {
    const payload = JSON.parse(await readFile(path.join(importsDir, file), "utf8"));
    if (payload.reviewRequired) continue;
    if (Array.isArray(payload.readings)) readings.push(...payload.readings);
  }

  return readings;
}
