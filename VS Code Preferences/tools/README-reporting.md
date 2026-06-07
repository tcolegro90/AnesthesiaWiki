# Admin Reporting Runner

This folder contains the source-agnostic reporting runner for the combined admin report.

## What It Produces
A single Markdown report with:
1. Curation lists (raw) for:
- PMH typed entries
- Home meds not in med database (strict match)
- Past surgeries
2. Analytics for:
- CPG unique users
- CPG plans generated
- Clinical Sites usage records
- Typhon Helper web app usage records

Each run includes both:
- All-time
- Last 30 days

## Data Source Modes
Default mode is direct Firestore read (all users in configured project):
- Source: `firestore`

Fallback mode (if needed) is JSON export files:
- Source: `json`
- Input folder: `Backups/Reports/input/`
- The script scans recursively for all `.json` files.

## Output
Reports are written to:
- Backups/Reports/

Filename format:
- admin-combined-report-YYYY-MM-DDTHH-MM-SS.md

## Run Command
From workspace root:

```bash
node "VS Code Preferences/tools/generate-admin-report.js"
```

Optional args:
- `--source firestore|json`
- `--input "/custom/input/dir"`
- `--output "/custom/output/dir"`
- `--med-catalog "/path/to/med-catalog.js"`
- `--label "Custom Report Title"`
- `--project "firebase-project-id"`
- `--api-key "firebase-web-api-key"`

Example:

```bash
node "VS Code Preferences/tools/generate-admin-report.js" \
  --source firestore \
  --output "Backups/Reports" \
  --label "CPG Admin Combined Report"
```

JSON fallback example:

```bash
node "VS Code Preferences/tools/generate-admin-report.js" \
  --source json \
  --input "Backups/Reports/input" \
  --output "Backups/Reports"
```

## Notes
- Unknown meds are strict matched against `homeMeds` in `Anesthesia Wiki/CarePlanGenerator WIP/med-catalog.js`.
- Raw values are preserved (no typo correction, no synonym merge).
- If exports are partial, the report reflects only supplied files.
