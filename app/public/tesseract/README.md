# Tesseract assets (same-origin)

LeaseGuard's CSP is `default-src 'self'`, so every OCR asset must be
served from this directory — no CDN fetches are allowed at runtime.

## Files

- `worker.min.js`, `tesseract-core.wasm`, `tesseract-core.wasm.js` —
  the tesseract.js runtime, copied from `node_modules` on `postinstall`.
- `*.traineddata.gz` — language data files. Manually placed; not
  installed automatically. Each one corresponds to a tesseract language
  code (e.g. `eng.traineddata.gz`).
- `languages.json` — the manifest the OCR language picker reads at
  runtime. Schema: `leaseguard.tesseract.languages.v1`.

## Adding a new OCR language

1. Download the `<code>.traineddata.gz` file from the upstream
   tesseract data repo (only `tessdata_fast` is supported by
   tesseract.js v5). Place it in this directory (`app/public/tesseract/`).
2. Append a corresponding entry to `languages.json`:

   ```json
   {
     "schema": "leaseguard.tesseract.languages.v1",
     "languages": [
       { "code": "eng", "label": "English" },
       { "code": "spa", "label": "Spanish" }
     ]
   }
   ```

3. Rebuild the app. The picker will surface the new language
   automatically; no code changes are required.

## Removing a language

Delete both the `*.traineddata.gz` file and its entry in
`languages.json`. If only one language remains, the picker renders a
static label rather than a dropdown.

## Manifest contract

- `schema` MUST be the literal string `leaseguard.tesseract.languages.v1`.
- `languages` MUST be an array of `{ code: string, label: string }`.
  `code` is the tesseract language code (3-letter ISO 639-2/T).
- An empty array hides the picker entirely.
- A missing or malformed `languages.json` is treated the same as an
  empty manifest — OCR still works in English by default, but no
  picker UI is shown.
