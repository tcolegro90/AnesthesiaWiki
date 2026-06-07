# VS Code / GitHub Copilot Preferences
*Last updated: June 7, 2026*

---

## Layering Model (Option 1 Active)
- Canonical source: this file stores the full preference set.
- Operational subset: high-impact execution rules are mirrored in memory for automatic in-session behavior.
- Sync rule: when a new high-impact behavior rule is added, update both this file and memory in the same step.

## Workflow Rules
- All edits go to WIP folder first; never edit live directly
- WIP is a sibling of the live folder (e.g. `CarePlanGenerator WIP/` next to `CarePlanGenerator/`)
- Backups save to `Anesthesia Tools/Backups/[ToolName]/` — outside `Anesthesia Wiki/`, never uploaded to server
- When pushing live: copy WIP → live, save backup, **keep WIP** (do not delete it)
- NEVER push live without explicit approval ("push live", "approve", "copy to live")
- Only `Anesthesia Wiki/` gets uploaded to the server (not all of `Anesthesia Tools/`)

## Versioning
- **Extension** (Typhon Helper Extension): bump by +0.01 per change to extension files
- **Web apps** (Typhon, CPG, ClinicalSites): bump by +0.001 per change/session in WIP; when pushing live, carry over the same version (no extra bump)
- Update both the display string in the UI AND all `?v=` cache-bust params on script/CSS tags
- CarePlanGenerator: `v3.00` — shown in desk-topbar + `?v=X.XX` on all local script/CSS tags in `Combined-Care-Plan.html`
- ClinicalSites: `v3.00` — shown in h1 header + `?v=X.XX` on all local script/CSS tags in `Index.html`
- Typhon Helper web app: `v1.001` — shown in hamburger bar + `?v=X.XX` on all local script tags in `TyphonCaseHelper.html`
- Typhon Helper Extension: `v1.70` — version in `manifest.json`, bumped per change

## Shorthand / Aliases
- "Typhon" = Typhon Case Helper (web app)
- "Typhon extension" = Typhon Case Helper browser extension
- "CPG" = Care Plan Generator

## Target Clarification (ALWAYS confirm before editing)
- **Typhon changes**: confirm whether the change applies to desktop layout, mobile layout, or the extension — CSS edits must be scoped correctly
- **CPG changes**: confirm whether the change applies to the input/form version or the print/preview version — they are separate files
- **General**: ask clarifying questions whenever intent is not certain — do not infer and proceed if there's meaningful ambiguity

## Content Rules
- Medication source files stay aligned when med content changes in care plan tooling
- PMH mobile: no horizontal scroll
- Phone number changes → ask if it's a shared default for all devices or local only
- New study articles → always ask for a 1–2 line Clinical Implications statement to use as the tile subtitle
- CPG targeting rule: default issues/features/edits to the main editable/input version; only modify print/preview when explicitly requested
- When pushing live, strip any debug/diagnostic instrumentation before copying files

## Debugging
- Instrument code first (execution markers, diagnostic strings) before attempting fixes
- Avoid query-string cache-busting on `file://` protocol — breaks script loading

## Changelog Workflow
- Separate changelog file per tool in `VS Code Preferences/`: `changelog-careplan.md`, `changelog-clinicalsites.md`, `changelog-typhon.md`
- Append bullet points to the changelog as changes are made in WIP (not just at push time)
- When pushed live, add a banner line: `━━━ PUSHED LIVE — vX.XX | [Date] ━━━`
- New preferences → always ask user if they want them added to `preferences.md`

## Backup Folder Locations
- `Anesthesia Tools/Backups/CarePlanGenerator/`
- `Anesthesia Tools/Backups/Typhon Helper/`
- `Anesthesia Tools/Backups/ClinicalSites/`
