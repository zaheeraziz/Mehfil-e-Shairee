# Text source policy

## Primary source

Use the Unicode Urdu text published by Iqbal Academy Pakistan at:

`https://www.allamaiqbal.com/works/poetry/urdu/bal/text/contents.htm`

Every imported poem must retain its exact Iqbal Academy poem URL in `sourceUrl`.

## Verification sources

- Rekhta may be used to compare punctuation, diacritics, poem boundaries, and wording.
- The local scanned PDF may be used for visual comparison with the printed page.
- The Internet Archive generated EPUB must not be used as text; its OCR is unusable.

## Import rules

1. Preserve the original wording and line order.
2. Normalize character encoding only when the visible Urdu letter is equivalent, such as legacy Arabic yeh to Urdu yeh.
3. Do not silently resolve a disagreement between sources. Record it for review.
4. Never allow Gemini to produce, correct, or complete original poem text.
5. Set `sourceChecked` to `true` only after a human comparison.
6. Full-book imports from Academy HTML must stay `reviewRequired: true` until
   poem boundaries, line pairing, and title metadata are checked. They are not
   eligible for website/Gmail approval by import alone.
