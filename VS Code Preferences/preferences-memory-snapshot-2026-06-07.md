# Preferences + Memory Snapshot
Date: 2026-06-07
Purpose: point-in-time backup before Option 1 alignment changes.

---

## Source A: User Memory (/memories/patterns.md)

- Before bulk creating files, list target directories first to avoid create_file collisions on existing files.
- User preference: when changing medication content in care plan tooling, keep medication source files aligned/updated as well.

- User preference: references to issues/features should be treated as main/editable version unless user explicitly says print version.


- User preference: keep PMH mobile no-horizontal-scroll change in mind; when user asks for the to-do list, proactively ask whether they want this mobile layout preference applied to other Care Plan pages.

- User preference: when asked to change a phone number, explicitly ask whether it should be a code-level shared default for everyone/devices or only local data.

- WIP workflow — CRITICAL: NEVER promote WIP → live without user EXPLICITLY saying "approve", "push live", "copy to live", or equivalent. Phrases like "apply to X" or "use on desktop" do NOT count as approval.

- WIP workflow (ALWAYS apply when user says "I want to work on X"):
  1. Copy live folder → timestamped backup saved to `Anesthesia Tools/Backups/[ToolName]/` (NOT inside Anesthesia Wiki — only Anesthesia Wiki/ is uploaded to server)
  2. If NO WIP folder exists: copy live → `[Tool] WIP/` (sibling of live folder). If WIP ALREADY EXISTS: do NOT overwrite it — just work in the existing WIP as-is.
  3. ALL edits go to the WIP folder, never the live folder
  4. When user approves → copy WIP files over live folder. Do NOT delete WIP after.
  5. This is a standing default — do not wait to be asked, do not skip it
  6. Do NOT narrate "I'm editing WIP" or ask the user to confirm WIP edits — just do it silently.

- User preference: every code/content change must be made in WIP only by default (never edit live directly unless user explicitly asks to push/copy live).

- Clinical Sites guardrail: never hardcode RRH org labels in contact export; for non-RRH sites, auto-export ORG as "<Hospital> <Role>" regardless of stale memo data.

- User preference: when adding/uploading a new study article, always ask for a 1-2 line Clinical Implications statement and use that as the tile subtitle.
- User preference: preferences are also saved at `Anesthesia Tools/VS Code Preferences/preferences.md`. After establishing any new preference, ask the user if they want it added to that file.

- Browser debugging: when headless tests pass but real browser fails, instrument the code first (execution markers, diagnostic strings in error messages) before attempting fixes. Avoid query-string cache-busting on file:// protocol — it breaks script loading.
- When promoting WIP → live, strip any diagnostic/debug instrumentation (execution markers, debug console.log, diagnostic strings) before copying files.

- Typhon Helper Extension: bump manifest.json version by 0.01 on every change to the extension (content.js, background.js, popup.js, app.*, etc.).
- Typhon Helper Extension packaging: after every WIP → live promotion, run `cd '/Users/trevor/Desktop/Anesthesia Tools' && bash package-extension.sh` — user wants this done automatically as part of the promotion step.
- CPG/Typhon version bumping: version display uses `vX.XXX` (no `=`), script tags use `?v=X.XXX`. Use `s/X\.XXX/X.YYY/g` (without leading `v`) to catch both in one sed pass.

- WIP versioning (web apps: Typhon, CPG, ClinicalSites):
  - Bump version by +0.001 each time a change/session is made in WIP (e.g., v1.00 → v1.001 → v1.002)
  - When pushing live: carry over the same WIP version — no additional bump at push time
  - Update both the display string in the header AND all `?v=` cache-bust params on script tags

- Batching edits: User prefers NOT batching many unrelated edits in one message — it increases error rate. Handle edits one logical change at a time, or small tight groups of closely related changes only.
  - Typhon changes: confirm whether the change applies to desktop layout, mobile layout, or the extension. CSS edits must be scoped correctly.
  - CPG changes: confirm whether the change applies to the input/form version or the print/preview version — they are separate files.
- Ask clarifying questions whenever intent is not certain — do not infer and proceed if there is meaningful ambiguity.
- Shorthand: "Typhon" = Typhon Case Helper (web app); "Typhon extension" = browser extension; "CPG" = Care Plan Generator.
- Typhon Helper Extension download zip (in wiki WIP section): ONLY update when user explicitly says to push a new version live, AND the new version number is higher than the current zip.

---

## Source B: Workspace Preferences (VS Code Preferences/preferences.md)

# VS Code / GitHub Copilot Preferences
*Last updated: May 23, 2026*

---

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
- References to issues/features = main/editable version unless user explicitly says "print version"
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
