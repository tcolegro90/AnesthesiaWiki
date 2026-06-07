# CPG Admin Reporting Spec
*Created: June 7, 2026*

## Purpose
Single recurring report that combines:
1. Database update candidates from Care Plan Generator entries
2. Usage analytics summary

The report should be runnable on demand from natural language requests (no exact trigger phrase required).

## Default Scope
- Data scope: all users (admin-accessible data)
- Time windows in every run:
  - All-time
  - Last 30 days
- Output style: one combined report
- Data treatment for curation lists: raw entries (no autocorrection, no spelling judgments)

## Required Curation Sections
Include these three raw lists with counts and frequency:
1. PMH typed entries (database update candidates)
2. Home meds typed that are not currently in med database (strict match rule)
3. Past surgeries entered (database update candidates)

## Required Analytics Sections
Include, at minimum:
1. Unique users using CPG
2. Total plans generated
3. Usage counts for other apps (as available from tracked data)

## Output Contract (One Report)
Use this order every time:
1. Scope + timestamp + data source notes
2. Curation section
   - PMH raw list + count + frequency
   - Home meds not-in-database raw list + count + frequency
   - Past surgeries raw list + count + frequency
3. Analytics section
   - All-time metrics
   - Last-30-days metrics
4. Action queue
   - Suggested database updates to review next
   - Any ambiguous items needing human decision

## Notes / Constraints
- Keep PMH and surgery terms as entered unless explicitly asked to normalize.
- Keep unknown meds as entered; do not auto-merge spelling variants.
- If data for "other apps" is incomplete, still report what is available and list gaps.
- If admin-wide export is unavailable in a run, explicitly report fallback scope and why.

## Future Extensibility
This spec can be extended with additional metrics (for example: per-site usage, per-day trend lines, or app-specific funnels) while keeping the same top-level report structure.
