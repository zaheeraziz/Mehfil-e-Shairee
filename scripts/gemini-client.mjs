import { spawnSync } from "node:child_process";

const SUPPORTED_PROVIDERS = new Set(["ai-studio", "vertex"]);

export function getGeminiConfig() {
  const provider = (process.env.GEMINI_PROVIDER || "ai-studio").trim().toLowerCase();
  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new Error(`Unsupported GEMINI_PROVIDER "${provider}". Use "ai-studio" or "vertex".`);
  }

  return {
    provider,
    providerLabel: provider === "vertex" ? "google-vertex-ai" : "google-gemini-ai-studio",
    model,
    projectId: process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "",
    location: process.env.VERTEX_LOCATION || "us-central1"
  };
}

export function assertGeminiConfigured(config = getGeminiConfig()) {
  if (config.provider === "ai-studio" && !process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing. Add it to .env before generating drafts with AI Studio.");
  }

  if (config.provider === "vertex" && !config.projectId) {
    throw new Error("VERTEX_PROJECT_ID is missing. Add it to .env before generating drafts with Vertex AI.");
  }
}

export async function requestGeminiContent({ config = getGeminiConfig(), systemInstruction, prompt, generationConfig }) {
  assertGeminiConfigured(config);

  const target = buildRequestTarget(config);
  const response = await fetch(target.endpoint, {
    method: "POST",
    headers: target.headers,
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig
    })
  });

  const payload = await readJsonResponse(response);
  if (!response.ok) {
    const message = payload?.error?.message || `${config.providerLabel} request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return {
    payload,
    provider: config.providerLabel,
    model: config.model,
    endpoint: target.endpoint
  };
}

function buildRequestTarget(config) {
  if (config.provider === "ai-studio") {
    return {
      endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      }
    };
  }

  const token = getVertexAccessToken();
  const host = config.location === "global"
    ? "aiplatform.googleapis.com"
    : `${config.location}-aiplatform.googleapis.com`;
  const modelPath = [
    "projects",
    encodeURIComponent(config.projectId),
    "locations",
    encodeURIComponent(config.location),
    "publishers",
    "google",
    "models",
    encodeURIComponent(config.model)
  ].join("/");

  return {
    endpoint: `https://${host}/v1/${modelPath}:generateContent`,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  };
}

function getVertexAccessToken() {
  if (process.env.VERTEX_ACCESS_TOKEN?.trim()) return process.env.VERTEX_ACCESS_TOKEN.trim();

  const result = spawnSync("gcloud", ["auth", "print-access-token"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  const token = result.stdout?.trim();
  if (result.status === 0 && token) return token;

  throw new Error([
    "Vertex AI auth is missing.",
    "Install the Google Cloud CLI and run `gcloud auth login`,",
    "or set VERTEX_ACCESS_TOKEN to a short-lived token from `gcloud auth print-access-token`."
  ].join(" "));
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Gemini returned a non-JSON response with HTTP ${response.status}.`);
  }
}
