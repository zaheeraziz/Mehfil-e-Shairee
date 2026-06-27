import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = "https://www.allamaiqbal.com/works/poetry/urdu/bal/text/";
const contentsUrl = `${baseUrl}contents.htm`;
const outputPath = path.join(root, "content", "imports", "bal-e-jibril-academy-full.json");

const contentsHtml = await fetchText(contentsUrl);
const links = extractContentsLinks(contentsHtml);
const readings = [];

for (const [index, link] of links.entries()) {
  const pageUrl = new URL(link.href, contentsUrl).href;
  const html = await fetchText(pageUrl);
  const parsed = parsePoemPage(html);
  const section = sectionForHref(link.href);
  const id = makeId(link.href, parsed.title || link.title || `bal-e-jibril-${index + 1}`);
  const lines = parsed.lines.length ? parsed.lines : splitTitleLines(link.title);
  const verses = toVerses(lines, section);

  readings.push({
    id,
    title: normalizeUrdu(parsed.title || link.title),
    sourceUrl: pageUrl,
    legacySourceUrl: pageUrl,
    sequence: index + 1,
    section,
    collection: section.collection,
    sourceChecked: false,
    importStatus: "academy_text_imported_review_required",
    reviewNotes: [
      "Imported automatically from Iqbal Academy Unicode HTML.",
      "Original Urdu text and poem boundaries require human review before approval.",
      ...verses.notes
    ],
    verses: verses.items.map(lines => ({ lines: lines.map(normalizeUrdu) }))
  });
}

const payload = {
  schemaVersion: 1,
  source: {
    publisher: "Iqbal Academy Pakistan",
    contentsUrl,
    collection: "Bal-e-Jibril"
  },
  reviewRequired: true,
  importedAt: new Date().toISOString(),
  readings
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Imported ${readings.length} Academy entries to ${path.relative(root, outputPath)}`);
console.log("Status: review required. New entries are not approved for website/email until sourceChecked is true.");

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  return response.text();
}

function extractContentsLinks(html) {
  const links = [];
  const seen = new Set();
  const linkPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkPattern.exec(html))) {
    const href = match[1];
    if (!/^part\d{2}\/\d{2}\.htm$/i.test(href) || seen.has(href)) continue;
    seen.add(href);
    links.push({ href, title: normalizeUrdu(htmlToPlainText(match[2]).join(" ")) });
  }
  return links;
}

function parsePoemPage(html) {
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(match => match[1]);
  const titleHtml = paragraphs.find(paragraph => /#AC0000/i.test(paragraph)) || "";
  const poemHtml = paragraphs.find(paragraph => /#006600/i.test(paragraph)) || "";
  return {
    title: normalizeUrdu(htmlToPlainText(titleHtml).join(" ")),
    lines: htmlToPlainText(poemHtml)
      .map(normalizeUrdu)
      .filter(line => line && line !== " ")
  };
}

function htmlToPlainText(html) {
  return decodeEntities(html)
    .replace(/<br\s*\/?>/gi, "%%LINE_BREAK%%")
    .replace(/<\/p>/gi, "%%LINE_BREAK%%")
    .replace(/[\r\n]+/g, " ")
    .replace(/<[^>]+>/g, " ")
    .split(/%%LINE_BREAK%%+/)
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function toVerses(lines, section) {
  const clean = lines.filter(Boolean);
  const notes = [];

  if (section.kind === "rubai" && clean.length % 4 === 0) {
    return {
      items: Array.from({ length: clean.length / 4 }, (_, index) => clean.slice(index * 4, index * 4 + 4)),
      notes
    };
  }

  if (clean.length % 2 !== 0) {
    notes.push(`Odd number of imported lines (${clean.length}); last line requires review.`);
  }

  return {
    items: Array.from({ length: Math.floor(clean.length / 2) }, (_, index) => clean.slice(index * 2, index * 2 + 2)),
    notes
  };
}

function sectionForHref(href) {
  const part = href.split("/")[0];
  const sections = {
    part01: { key: "part01", kind: "ghazal", collection: "بالِ جبریل · حصہ اول" },
    part02: { key: "part02", kind: "ghazal", collection: "بالِ جبریل · حصہ دوم" },
    part03: { key: "part03", kind: "qita", collection: "بالِ جبریل · قطعہ" },
    part04: { key: "part04", kind: "rubai", collection: "بالِ جبریل · رباعیات" },
    part05: { key: "part05", kind: "qita", collection: "بالِ جبریل · قطعہ" },
    part06: { key: "part06", kind: "poem", collection: "بالِ جبریل · منظومات" },
    part07: { key: "part07", kind: "qita", collection: "بالِ جبریل · قطعہ" },
    part08: { key: "part08", kind: "qita", collection: "بالِ جبریل · قطعہ" }
  };
  return sections[part] || { key: part, kind: "poem", collection: "بالِ جبریل" };
}

function makeId(href, title) {
  const stem = href.replace("/", "-").replace(".htm", "");
  return `bal-e-jibril-${stem}-${slugify(title).slice(0, 45)}`.replace(/-+$/g, "");
}

function slugify(value) {
  return normalizeUrdu(value)
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .trim()
    .split(/\s+/)
    .slice(0, 7)
    .join("-")
    .toLowerCase();
}

function splitTitleLines(title) {
  return title ? [title] : [];
}

function normalizeUrdu(text) {
  return String(text || "")
    .normalize("NFC")
    .replaceAll("ي", "ی")
    .replaceAll("ى", "ی")
    .replaceAll("ك", "ک")
    .replace(/\s+([،؛؟!])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, "\"")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}
