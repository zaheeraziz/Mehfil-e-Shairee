import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGeminiConfig, requestGeminiContent } from "./gemini-client.mjs";
import { calculateGeminiCost } from "./gemini-pricing.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliArgs = process.argv.slice(2);
const dryRun = cliArgs.includes("--dry-run");
const requestedIds = cliArgs.filter(arg => !arg.startsWith("--"));

await loadEnvFile(path.join(root, ".env"));

const approval = JSON.parse(await readFile(path.join(root, "content", "approved-readings.json"), "utf8"));
const ids = requestedIds.length ? requestedIds : approval.ids;
const geminiConfig = getGeminiConfig();
const model = geminiConfig.model;

for (const id of ids) {
  const draftPath = path.join(root, "content", "drafts", `${id}.json`);
  const draft = JSON.parse(await readFile(draftPath, "utf8"));
  const needsTranslation = draft.annotations.verseAnnotations.some(item => !item.englishTranslation?.trim());
  const needsContext = !draft.annotations.historicalContext?.summaryEnglish?.trim();

  if (!needsTranslation && !needsContext) {
    console.log(`Already enriched: ${id}`);
    continue;
  }

  if (dryRun) {
    console.log(`Would enrich: ${id}`);
    continue;
  }

  const enrichment = await requestEnrichment(draft);
  validateEnrichment(draft, enrichment);

  for (const annotation of draft.annotations.verseAnnotations) {
    const enriched = enrichment.verseTranslations.find(item => item.verseIndex === annotation.verseIndex);
    annotation.englishTranslation = enriched.englishTranslation;
  }

  draft.annotations.historicalContext = enrichment.historicalContext;
  draft.annotations.historicalContext = normalizeHistoricalContext(draft, draft.annotations.historicalContext);
  if (draft.annotations.historicalContextUrdu && !draft.annotations.historicalContext.legacyUrduNote) {
    draft.annotations.historicalContext.legacyUrduNote = draft.annotations.historicalContextUrdu;
  }

  const apiUsage = enrichment.__usage || {};
  draft.enrichment = {
    enrichedAt: new Date().toISOString(),
    provider: apiUsage.provider,
    model,
    usage: apiUsage.usage,
    cost: apiUsage.cost,
    purpose: "english_translation_and_historical_context"
  };
  delete enrichment.__usage;

  await writeFile(draftPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  console.log(`Enriched: ${id}`);
}

function normalizeHistoricalContext(draft, context) {
  if ((draft.source?.collection || "").includes("بالِ جبریل")) {
    return {
      period: "Published in Bal-e-Jibril, 1935",
      place: "Unknown",
      summaryUrdu: "یہ نظم بالِ جبریل میں شامل ہے، جو ۱۹۳۵ میں شائع ہوا۔ اس نظم کا خاص زمانہ اور مقامِ تحریر ابھی مقامی ماخذ میں verified نہیں، اس لیے اسے مجموعے کے عمومی تاریخی پس منظر کے طور پر پڑھیں، نہ کہ poem-specific دعوے کے طور پر۔",
      summaryEnglish: "This poem appears in Bal-e-Jibril, published in 1935. The exact writing date and place for this specific poem are not verified in the local source metadata, so this is collection-level context rather than a poem-specific claim.",
      confidence: "likely",
      sourceNote: "Collection-level publication context only; exact poem-specific writing date and place are unknown."
    };
  }

  return context;
}

async function requestEnrichment(draft) {
  const responseSchema = {
    type: "OBJECT",
    required: ["verseTranslations", "historicalContext"],
    properties: {
      verseTranslations: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          required: ["verseIndex", "englishTranslation"],
          properties: {
            verseIndex: { type: "INTEGER" },
            englishTranslation: { type: "STRING" }
          }
        }
      },
      historicalContext: {
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
      }
    }
  };

  const prompt = `Enrich this reviewed Iqbal reading draft.

Rules:
- Do not alter, correct, or add to the original Urdu.
- Return one verseTranslations item for every couplet, same order, zero-based verseIndex.
- englishTranslation must be clear modern English, faithful to the couplet, and should not add interpretation beyond the text.
- Historical context must not invent poem-specific date/place.
- Use "verified" only if exact poem-specific date/place is present in the supplied metadata.
- Use "likely" for collection-level publication context only.
- Use "unknown" when exact poem-specific writing date/place is not supplied.
- For Bal-e-Jibril collection context, you may say the collection was published in 1935, but do not claim a specific poem was written in 1935 unless supplied.
- The sourceNote must explain whether the context is poem-specific or collection-level.

Draft:
${JSON.stringify({
  id: draft.id,
  source: draft.source,
  annotations: {
    historicalContextUrdu: draft.annotations.historicalContextUrdu,
    verseAnnotations: draft.annotations.verseAnnotations.map(item => ({
      verseIndex: item.verseIndex,
      explanationUrdu: item.explanationUrdu
    }))
  }
})}`;

  const { payload, provider, fallbackUsed } = await requestGeminiContent({
    config: geminiConfig,
    systemInstruction: "You are an Urdu literature translation assistant. Be faithful, cautious, and explicit about uncertainty.",
    prompt,
    generationConfig: {
      temperature: 0.15,
      responseMimeType: "application/json",
      responseSchema
    }
  });
  if (fallbackUsed) console.warn(`Enrichment fell back to ${provider}.`);

  const rawText = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("");
  if (!rawText) throw new Error("Gemini returned no text content.");

  const result = JSON.parse(rawText);
  const usage = readUsage(payload.usageMetadata || {});
  result.__usage = {
    provider,
    usage,
    cost: [usage.inputTokens, usage.outputTokens, usage.totalTokens].every(Number.isFinite)
      ? calculateGeminiCost(model, usage)
      : null
  };
  return result;
}

function validateEnrichment(draft, enrichment) {
  if (!Array.isArray(enrichment.verseTranslations)) throw new Error(`${draft.id}: missing translations.`);
  if (enrichment.verseTranslations.length !== draft.source.verses.length) {
    throw new Error(`${draft.id}: expected ${draft.source.verses.length} translations, received ${enrichment.verseTranslations.length}.`);
  }

  enrichment.verseTranslations.forEach((item, index) => {
    if (item.verseIndex !== index) throw new Error(`${draft.id}: invalid verseIndex ${item.verseIndex}.`);
    if (!item.englishTranslation?.trim()) throw new Error(`${draft.id}: missing English translation for verse ${index + 1}.`);
  });

  const context = enrichment.historicalContext;
  if (!context?.summaryUrdu?.trim() || !context.summaryEnglish?.trim() || !context.sourceNote?.trim()) {
    throw new Error(`${draft.id}: incomplete historical context.`);
  }
  if (!["verified", "likely", "unknown"].includes(context.confidence)) {
    throw new Error(`${draft.id}: invalid historical confidence.`);
  }
}

function readUsage(apiUsage) {
  return {
    source: "generateContent.usageMetadata",
    inputTokens: apiUsage.promptTokenCount ?? null,
    cachedInputTokens: apiUsage.cachedContentTokenCount ?? 0,
    outputTokens: apiUsage.candidatesTokenCount ?? null,
    thinkingTokens: apiUsage.thoughtsTokenCount ?? 0,
    totalTokens: apiUsage.totalTokenCount ?? null
  };
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
