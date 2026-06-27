# Mehfil-e-Shairee Trial

A dependency-free prototype for reading one complete Iqbal poem each day.

## Run

Open `index.html` directly, or run a local server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

Progress, favorites, theme, and reflection notes are stored in the browser's local storage. The seed reading is from *Bal-e-Jibril*; original Urdu text was checked against Rekhta and Wikisource. Explanations and translations are editorial drafts for the trial and should be reviewed before public release.

## Gemini draft pipeline

Verified source poems live in `content/source-poems.json`. Run `npm run draft:check` to validate sources without making an API request. See `content/README.md` for Gemini setup and the required human-review workflow.
