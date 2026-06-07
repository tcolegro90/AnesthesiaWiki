# Typhon Helper — Changelog

## Notes
This covers both the **web app** (TyphonCaseHelper.html) and the **VS Code browser extension** (manifest.json versioned separately).

---

## Web App — v1.001
━━━ PUSHED LIVE — v1.001 | May 23, 2026 ━━━

- Hamburger sidebar button removed from `#hamburger-bar`
- Tab label changed to "Case Log Entry" (drawer label + initial current-tab-label)
- Global single-column layout: `.chk-grid` and `.two-col` changed to `1fr` (desktop only; mobile unchanged)
- Procedure counts: grid layout `1fr auto auto`, stepper sized 44×44px / 64px wide, `?` button order fixed to far right
- Anatomical category (`#grp-anat`): COA tooltips added to all 16 buttons; desktop single-column via `.coa-row { flex: 1 1 100% }` (mobile 2-col restored)
- General Anesthesia: `#sec-general .chk-grid` 2-col base rule removed (desktop now single-column); mobile 2-col override preserved; COA tooltips added to all 12 items
- MAC: COA tooltip added to sec-header
- Moderate / Deep Sedation: COA tooltip added to sec-header
- Medications: COA tooltips added to all 6 items
- Regional — Management: COA tooltip added
- Regional — Peripheral Sub-options Upper/Lower: COA tooltips added

---

## Extension

### v1.70
- Last known version as of May 23, 2026

