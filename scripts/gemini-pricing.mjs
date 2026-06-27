export const GEMINI_PRICING = {
  "gemini-3.1-flash-lite": {
    currency: "USD",
    tier: "paid-standard",
    inputPerMillionTokens: 0.25,
    cachedInputPerMillionTokens: 0.025,
    outputPerMillionTokens: 1.50,
    outputIncludesThinking: true,
    checkedOn: "2026-06-25",
    sourceUrl: "https://ai.google.dev/gemini-api/docs/pricing"
  },
  "gemini-3.1-flash-lite-batch": {
    currency: "USD",
    tier: "paid-batch",
    inputPerMillionTokens: 0.125,
    cachedInputPerMillionTokens: 0.0125,
    outputPerMillionTokens: 0.75,
    outputIncludesThinking: true,
    checkedOn: "2026-06-25",
    sourceUrl: "https://ai.google.dev/gemini-api/docs/pricing"
  },
  "gemini-2.5-flash": {
    currency: "USD",
    tier: "paid-standard",
    inputPerMillionTokens: 0.30,
    cachedInputPerMillionTokens: 0.03,
    outputPerMillionTokens: 2.50,
    outputIncludesThinking: true,
    checkedOn: "2026-06-19",
    sourceUrl: "https://ai.google.dev/gemini-api/docs/pricing"
  }
};

export function calculateGeminiCost(model, usage) {
  const pricing = GEMINI_PRICING[model];
  if (!pricing) return null;

  const billableInputTokens = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  const cachedInputTokens = Math.max(0, usage.cachedInputTokens);
  const billableOutputTokens = usage.outputTokens + usage.thinkingTokens;
  const uncachedInputUsd = billableInputTokens / 1_000_000 * pricing.inputPerMillionTokens;
  const cachedInputUsd = cachedInputTokens / 1_000_000 * pricing.cachedInputPerMillionTokens;
  const outputUsd = billableOutputTokens / 1_000_000 * pricing.outputPerMillionTokens;
  return {
    currency: pricing.currency,
    tier: pricing.tier,
    inputUsd: uncachedInputUsd + cachedInputUsd,
    uncachedInputUsd,
    cachedInputUsd,
    outputUsd,
    totalUsd: uncachedInputUsd + cachedInputUsd + outputUsd,
    rates: {
      inputPerMillionTokens: pricing.inputPerMillionTokens,
      cachedInputPerMillionTokens: pricing.cachedInputPerMillionTokens,
      outputPerMillionTokens: pricing.outputPerMillionTokens,
      outputIncludesThinking: pricing.outputIncludesThinking
    },
    pricingCheckedOn: pricing.checkedOn,
    pricingSourceUrl: pricing.sourceUrl
  };
}
