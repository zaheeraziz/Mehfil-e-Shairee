# Content generation and review

Gemini creates annotation drafts. It never supplies or edits the original poem and it never publishes content directly.

Iqbal Academy Pakistan is the primary text source. See `SOURCE_POLICY.md` for provenance and verification requirements.

## Add a poem

1. Add the original Urdu to `source-poems.json`, or to a provenance-preserving import file, only after checking it against a named source.
2. Set `sourceChecked` to `true` and retain the exact source URL.
3. Run the local validation:

```bash
npm run draft:check -- poem-id
```

4. Open the local `.env` file and paste your Gemini key after `GEMINI_API_KEY=`. This file is ignored by Git and must never be shared or committed:

```bash
GEMINI_API_KEY=your-key
```

5. Generate a review draft:

```bash
npm run draft -- poem-id
```

For older drafts that predate English translation and structured context, run:

```bash
npm run enrich -- poem-id
```

6. Review the JSON written under `content/drafts/`. Verify every word meaning, explanation, context claim, and the original Urdu before approving it for the website or Gmail script.

7. Add the reviewed draft ID to `approved-readings.json`, then rebuild the
browser and Gmail libraries:

```bash
npm run build:readings
```

The default model is `gemini-3.1-flash-lite` to keep generation costs low. Override it without editing code by setting `GEMINI_MODEL` in the terminal.

## Token economics

Every newly generated draft stores Gemini's exact API usage metadata: input,
cached input, visible output, thinking, and total tokens. It also stores an
estimated paid-tier USD cost using the dated model rates in
`scripts/gemini-pricing.mjs`.

```bash
npm run tokens
```

Estimate the cost of full-book English/context enrichment from the measured
per-couplet usage of already enriched drafts:

```bash
npm run estimate:full-book
```

Drafts created before token instrumentation are reported as `not recorded`.
They are not assigned invented historical counts. Pricing is an estimate; the
Google billing account and free-tier eligibility determine the actual charge.

For full-book processing, generate drafts in small batches and review before
approving. Google lists Batch/Flex pricing for Flash-Lite at roughly half the
standard paid price; the current local scripts use the standard API path, but
the cost table includes a `gemini-3.1-flash-lite-batch` rate so larger future
runs can be estimated separately.
