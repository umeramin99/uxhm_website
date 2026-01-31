# Audit PDF Generator (v1)

Generates a **1-page branded PDF** for the free website audit lead magnet.

## Requirements
- Node.js
- `npm install`

## Usage

1) Create an input JSON (see `sample-input.json`).

2) Run:

```bash
node scripts/audit-pdf/generate-audit-pdf.mjs --in scripts/audit-pdf/sample-input.json --out dist/audits/sample-audit.pdf
```

## Notes
- Uses the in-repo UXHM logo: `src/assets/images/logo-dark.svg`
- Keeps output to **one page** by design (v1). If content overflows, it truncates the lowest-priority sections.
