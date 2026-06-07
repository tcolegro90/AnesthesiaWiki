# CPG Admin Combined Report

- Generated at: 2026-06-07T17:58:19.484Z
- Input directory: /Users/trevor/Desktop/Anesthesia Tools/Backups/Reports/input
- JSON files processed: 0
- Records scanned: 0
- Scope: Admin export data provided in input folder (all users represented by supplied files)
- Time windows included: All-time and last 30 days

## Curation: Database Update Candidates

### 1) PMH Typed Entries (Raw)
- All-time unique: 0
- Last 30 days unique: 0
- All-time frequency list:
- None

- Last 30 days frequency list:
- None

### 2) Home Meds Not In Database (Strict Match, Raw)
- All-time unique: 0
- Last 30 days unique: 0
- All-time frequency list:
- None

- Last 30 days frequency list:
- None

### 3) Past Surgeries (Raw)
- All-time unique: 0
- Last 30 days unique: 0
- All-time frequency list:
- None

- Last 30 days frequency list:
- None

## Analytics

### All-time
- CPG unique users: 0
- CPG plans generated: 0
- Clinical Sites usage records: 0
- Typhon Helper web app usage records: 0

### Last 30 Days
- CPG unique users: 0
- CPG plans generated: 0
- Clinical Sites usage records: 0
- Typhon Helper web app usage records: 0

## Action Queue
- Review PMH all-time list for database additions, then apply decisions to PMH source data.
- Review unknown meds list as raw typed entries; classify misspellings vs true new medications.
- Review past surgeries list for new surgery aliases/entries to add.
- Validate app analytics coverage if expected sources are missing from input exports.

## Notes
- Unknown meds are evaluated with strict name matching against current med catalog home meds.
- Raw terms are preserved; no auto-correction or synonym merging is applied in this report.
- If data source exports are partial, report totals reflect only the supplied files.
