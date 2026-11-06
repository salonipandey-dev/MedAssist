# MedAssist frontend redesign: F0 audit and screenshot plan

Working note, 6 November 2026 (IST). This is an editorial and engineering control note. It is not report prose. No application code was changed in F0.

## 1 Baseline and what was actually done

| Item | Value |
| --- | --- |
| Repository | `salonipandey-dev/MedAssist`, branch `main` |
| Inspected commit | `ea3e137961cebaefc0315f9dd3f906cd69daf37d` ("docs: add final report scope and evidence checklist", 4 Nov 2026 23:24:19 IST). This matches the Batch 0 baseline. |
| Inputs read | Batch 0 control packet, F-batch instructions, `Readme.md`, `docs/FRONTEND_GUIDE.md`, `docs/FINAL_REPORT_EVIDENCE_CHECKLIST.md`, `docs/VERIFICATION.md`, `docs/screenshots/README.md`, `frontend/package.json`, the routes (`App.tsx`), provider, layouts, shared UI, styles, the mock seed/reducer, the feature screens, the source-boundary tests, the browser tests and the existing capture script |
| Images inspected | `home.png`, `patient.png`, `patient-mobile.png` and `doctor-review.png` were opened and viewed. `admin-dark.png` was not opened. |

Commands actually run in this session:

| Command | Outcome |
| --- | --- |
| `git clone https://github.com/salonipandey-dev/MedAssist.git` | Succeeded |
| `git log -3` | HEAD = `ea3e137…` |
| `npm view react version` | **Failed**: `ENOTFOUND registry.npmjs.org`. The npm registry cannot be reached from this session. |
| `python3 -c "import fastapi"` | **Failed**: FastAPI is not installed, and pip has no network access. |
| `node -e "require('playwright')"` | Succeeded. A global Playwright and Chromium are available. |

No build, typecheck, unit test, browser test or screenshot capture was run in F0.

**Execution constraint.** `npm ci` needs the registry, so this session cannot install the frontend dependencies. Vite, React and the other pinned packages are not present. F1 to F3 edits can be written here, but they cannot be typechecked, built, tested or captured until one of these happens:
- package installs are enabled for the account, which takes effect in a new chat; or
- F4 is run on your own computer using the commands in section 7.

## 2 Audit: real, demonstration only, proposed

This applies the Batch 0 status vocabulary, checked against source.

| Area | Status | Source evidence | Note for the redesign |
| --- | --- | --- | --- |
| Public site: 8 pages plus `/demo` | Implemented interface | `App.tsx`, `pages/public/Pages.tsx`, `PublicLayout.tsx` | Restyle only. Keep "Healthcare" in the homepage h1 because the browser test asserts it. |
| Role selection (`/demo`, header select) | Demonstration only | `DemoAccess.tsx`, `AppLayout.tsx` | Keep "This is demonstration access, not authentication." |
| In-memory state and reset | Demonstration only | `Provider.tsx` (`useReducer(createSeed)`), `data/mock/service.ts` | No storage APIs are used, and `tests/modern-safeguards.test.cjs` enforces this. No change. |
| Profile (alias and language label) | Demonstration only | `Profile.tsx` (React Hook Form + Zod) | No health fields. Language is not translation. |
| Six-step assessment | Demonstration only | `Assessment.tsx` (no `<input/textarea/select>`; the test enforces this) | Submission creates a **Submitted** workflow case. There is no urgency output. |
| Cases and chronology | Demonstration only | `Cases.tsx` | "Case progress describes workflow, not medical urgency" stays. |
| Professional review | Demonstration only | `Doctor.tsx` `ReviewWorkspace` | Predefined notes and a required checkbox. There is no clinical conclusion. |
| Appointments | Demonstration only | `Appointments.tsx`, reducer slot conflict | Fixed demo clock of 25 Oct 2026. No message is sent. |
| Reports | Demonstration only | `Reports.tsx` | HTML previews only. No file picker is rendered (the test enforces this). |
| Admin users, analytics, CSV, audit | Demonstration only | `Admin.tsx`, `data/mock/analytics.ts`, `Charts.tsx` | Synthetic counts only. |
| Themes, responsive layout, focus handling | Implemented | `Provider.tsx`, `AppLayout.tsx`, `styles/` | Must survive the restyle: skip links, mobile nav focus trap, `:focus-visible` outline. |
| System liveness client | Implemented client; runtime not verified | `services/api/system.ts`, `Settings.tsx` | A screenshot of a successful check needs a running backend. |
| AI concept panel | Proposed (nonfunctional concept) | `components/ui/AIConcept.tsx` | Keep "AI assistance not yet available" (tests rely on it). |
| Consultation comparison, medication-risk screens | Proposed; **no route or code exists** | — | See section 5 (F3). |
| Authentication, database, uploads, model | Proposed | — | Not touched by this redesign. |

## 3 Gaps against the requested minimal design

| Request | Current state (evidence) | Planned change |
| --- | --- | --- |
| Teal `#0F766E`, text `#0F172A`, border `#E2E8F0`, very light grey background | Tokens are `--teal #0d9488`, `--text #172033`, `--border #e7edf3`, `--bg #f7f9fc`, plus an **indigo** second accent and amber (`global.css` lines 9–28) | Replace the tokens. Remove indigo as an accent. Keep amber and red only as **status** colours (Awaiting review, error), because status labels need to be distinguishable. |
| One accent, good contrast | Measured ratios: `#0F766E` on white is 5.47:1, on `#F8FAFC` 5.23:1, and white on `#0F766E` 5.47:1. Text `#0F172A` on white is 17.85:1. A proposed muted text colour, `#475569`, is 7.24:1 on `#F8FAFC`. | Pass AA for body text. **`#E2E8F0` is only 1.23:1 against white**, which is fine for card dividers but not for form-control outlines (WCAG 1.4.11 needs 3:1). Use `#64748B` (4.76:1) for input, select and checkbox borders. Recheck everything with the existing axe browser checks in F4. |
| Locally bundled sans-serif, consistent type sizes | Inter (body) plus Manrope (headings, letter-spacing −0.035em) via `@fontsource`. Headings range from 15 to 32px with ad hoc sizes in `product.css`. | Use Inter for everything. Type scale 12/14/16/20/24/30 px with weights 400/500/600. Stop importing Manrope in `main.tsx`. The package stays in `package.json`, so the lockfile does not change. |
| 8 px spacing scale, about 24 px section gaps | Mixed values | Add `--space-1…6` (8, 16, 24, 32, 40, 48) and use `--space-3` between sections. |
| 8–12 px radii | 25 rules use radii above 12 px or pill shapes | Use `--radius-sm 8px`, `--radius 10px`, `--radius-lg 12px`. Keep full rounding only for avatars and status dots. |
| No gradients, glass or animation | Header `backdrop-filter: blur(12px)` (`public.css:10`), hero linear and radial gradients (`public.css:50,131`), overlay blur (`global.css:736`), skeleton shimmer gradient (`global.css:791`), fade-in keyframes, `motion` scroll reveals on the homepage (`Pages.tsx:23–40`), hero "orbit" rings and floating cards | Remove all of them. Dialog overlays become a flat semi-opaque scrim. The skeleton becomes static. Keep the loading spinner, which is functional, only under `prefers-reduced-motion: no-preference`. `Reveal` renders a plain `div`. |
| Simple header, uncluttered sidebar | The sidebar has a marketing card ("Thoughtfully connected. Explore a more considered healthcare experience.") and a workspace label with a **chevron that implies a menu but is not interactive** (`AppLayout.tsx`). The public header has two links to `/demo` ("Demo access" and "Explore demo"). | Remove the card. Remove the misleading chevron. Use one "Explore demo" action in the public header. Keep the "Sample Data" badge, the demo ribbon, the role select, the theme toggle, the activity link, "Back to website" and collapse. |
| One primary action per screen; excessive cards | The patient overview has a dark navy banner with an illustration (`CareIllustration`), 4 stat cards, 5 panels and 2 extra "next action" cards. The admin overview has a decorative banner ("Good data tells a clear story."). | Remove the banner, the illustration and the duplicate next-action cards. Flatten the stat cards (no coloured icon tiles). Keep one primary button per page heading. |
| Copy about the task the person is doing | Eyebrows such as "YOUR SPACE, THOUGHTFULLY ORGANIZED", "MAKE ROOM FOR WHAT MATTERS", "A CONSIDERED VIEW OF YOUR DAY"; headings such as "Context first. Your review, independent." and "Your platform, at a glance." | Use plain task labels (for example "Patient · Profile preferences", "Record a sample review", "Administrator overview"). Truthful boundary sentences are kept word-for-word. |
| Readable at report-column width | Full-page captures are 1440 px wide with 11–13 px secondary text. When scaled to a 6-inch column, that text renders at about 6 pt. | Use a 14 px minimum for table and secondary text in workspaces. Capture at device scale factor 2 and add focused element crops (section 6). |

These defects were found in the existing evidence and should be fixed or noted:
- `patient.png` and `doctor-review.png`: the fixed sidebar ends at about 1000 px in full-page captures. Below that, the page background shows where the sidebar should continue (`.sidebar { position: fixed }` at a height of 100dvh). This is a capture artifact, not a layout bug, and the new plan avoids it by using viewport captures and element crops. F1 also makes the sidebar column's background extend the full page height.
- The patient overview shows "Sample visit summary" twice. The seed alternates two names (`seed.ts:85`), so two rows look identical. F1 shows the date and case ID beside each document name; the seed is not changed.
- **Correction to Batch 0 SS05:** after viewing the pixels, `patient-mobile.png` is in the **light** theme. The script's `page.goto` reloads the app and the theme resets from `colorScheme: 'light'`. The "theme needs pixel verification" item in the Batch 0 packet can be closed.

## 4 Constraints the restyle must preserve

The browser suite (`tests/e2e/workflows.spec.ts`) and the source checks depend on the following. If any of them changes, the matching test is updated in the same batch and the change is noted.

- Headings: home h1 contains "Healthcare"; demo h1 contains "Choose your perspective"; patient h1 is exactly "Welcome back, Mira."; "Review the predefined sample."; "A new sample case, ready to follow."; the new case's h1 is "Sample assessment walkthrough"; the alias heading is "Mira Chen (Demo)".
- Accessible names: "Explore Demo", "Explore patient demo", "Edit profile", "Save demo profile", "Fictional display alias", "Begin sample walkthrough", "Continue", "Submit predefined sample", "Next sample month", "Request sample appointment", "Confirm sample request", "Cancel sample appointment", "Confirm cancellation", "Record sample review", "Demo role", "Switch to dark mode", "Upload unavailable", "Back to website", "MedAssist home", "System Settings", "Audit Activity", and the table names "users", "cases", "appointments", "audit events".
- Class hooks: `.stat` (the 2nd stat's `strong` = 36, or 16 for October), `.segmented button.active`, `.chart-data summary`, `.workflow-caption`, `.case-id-row .badge`, `.review-record`, `.ai-concept`, `.appointment-doctor`, `#alias-error`.
- Notice text: "No file picker is rendered", "No appointment message is sent", "SAMPLE · NOT A MEDICAL RECORD", "predefined fictional information", "No health information can be entered", "AI assistance not yet available", "No clinical conclusion".
- The axe WCAG A/AA checks on 8 screens in light and dark, and the no-horizontal-overflow sweep of all 34 routes at 320/375/768/1024/1440 px. The dark theme stays supported; only its accent tokens are updated.
- No dependency changes: the lockfile cannot be regenerated or verified from this session.

## 5 Selected routes and batch scope

| Batch | Routes | Screens in scope |
| --- | --- | --- |
| F1 | `/`, `/demo`, `/app/patient`, `/app/patient/profile`, plus the shared shell on every route | Tokens, public header and footer, workspace shell, homepage, demo access, patient overview, profile |
| F2 | `/app/patient/assessments`, `/app/patient/cases`, `/app/patient/cases/:id`, `/app/doctor`, `/app/doctor/reviews/MA-2402`, `/app/patient/appointments`, `/app/admin`, `/app/admin/analytics`, `/app/patient/reports` | Assessment, case tracking, review, appointments, admin overview and analytics, reports dialog |
| F3 | **Skip by default.** | The ProjectBrief records consultation comparison and medication-risk awareness as *proposed design goals*, says formal acceptance of the revised scope is not established, and lists SS11 and SS12 as "only if subsequently built". It does not put them in an agreed frontend scope, so the instruction ("only add … if the ProjectBrief includes them") means they are not added. If you instruct otherwise, they would be new `Demonstration only` routes with fictional providers, illustrative fees and scripted medication examples. ER19–ER24 would remain `Proposed` for the real capability. |
| F4 | All of the above | Build, test, inspect and capture |

Other routes (`/platform`, `/how-it-works`, `/security`, `/about`, `/patients`, `/professionals`, history, notifications, settings, users, audit, schedule) get the shared tokens and shell automatically. They receive only copy and eyebrow clean-up where a shared component changes; there is no bespoke redesign.

## 6 Proposed file changes

All paths are under `frontend/`. Backend files, `public/legacy/`, `package.json` and `package-lock.json` will not be modified.

**F1: shared visual system, homepage, demo access, patient overview and profile**

| File | Change |
| --- | --- |
| `src/styles/global.css` | New light and dark tokens (accent `#0F766E`, text `#0F172A`, muted `#475569`, border `#E2E8F0`, control border `#64748B`, background `#F8FAFC`, surface `#FFFFFF`, tint `#F0FDFA`); spacing, radius and type-scale tokens; Inter for headings; remove the blur, shimmer and fade animations; normalise base form controls and focus outline (3 px, accent, 2 px offset); sidebar column background extends the full page height |
| `src/styles/public.css` | Flat header (no blur), hero without gradients, orbits or floating cards, tighter section rhythm, footer simplified |
| `src/styles/product.css` | Remove styles for the sidebar help card, the patient welcome banner and the next-actions cards; flat stat tiles; panel and card radii at 10–12 px; table and secondary text at 14 px minimum; remove indigo surfaces |
| `src/main.tsx` | Drop the Manrope imports; keep Inter 400/500/600/700 |
| `src/components/ui/index.tsx` | `PageHeading`: smaller, neutral eyebrow. `Stat`: icon optional and neutral. `Badge`/`Status`: teal, neutral, amber and red tones only. |
| `src/components/layout/AppLayout.tsx` | Remove the "Thoughtfully connected" card and the non-interactive chevron; plain footer ("MedAssist academic prototype · Fictional records · No clinical decision support · Demo clock 25 Oct 2026") |
| `src/components/layout/PublicLayout.tsx` | One header action ("Explore demo"); a "Demo access" link stays inside the mobile menu |
| `src/pages/public/Pages.tsx` (`Home`, `Workflow`, `FinalCTA`, `Reveal`) | Static `Reveal`; hero with one primary and one secondary action and a single labelled illustrative preview; remove decorative feature art and the duplicate patient and doctor showcase previews; keep the workflow stepper and the AI boundary section |
| `src/pages/public/ProductPreview.tsx` | Flatten the styling. `CareIllustration` is no longer used by the patient overview. |
| `src/features/auth/DemoAccess.tsx` | Task-focused card copy ("View sample cases, try the fixed assessment walkthrough and request fictional appointments."); one primary button (patient); notice unchanged |
| `src/features/patient/Patient.tsx` (`PatientOverview`) | Remove the banner, illustration and next-actions cards; description becomes "Your sample cases, appointments and documents."; document rows show the date and case ID |
| `src/features/patient/Profile.tsx` | Plain eyebrow; single-column form at a readable width; validation message text kept |

**F2: existing workflow screens**

| File | Change |
| --- | --- |
| `src/features/assessments/Assessment.tsx` | Plain eyebrow; step list and content panel restyled; all wording about predefined content kept |
| `src/features/cases/Cases.tsx`, `src/components/ui/DataTable.tsx` | Readable table density (14 px, 48 px rows), clear empty state, status labels with text and colour |
| `src/features/doctor/Doctor.tsx` | Review heading "Record a sample review"; two-column layout kept; AI concept panel visually de-emphasised but present |
| `src/features/appointments/Appointments.tsx` | Calendar and slot buttons restyled with clear disabled and selected states; dialogs flattened |
| `src/features/admin/Admin.tsx`, `src/components/charts/Charts.tsx` | Replace the decorative banner with a single-line sample-data notice; chart palette uses teal plus neutral greys (no indigo); keep the period selector, Compare control, accessible data summary and CSV export |
| `src/features/reports/Reports.tsx`, `src/features/auth/Settings.tsx` | Copy and eyebrow clean-up; notices unchanged |
| `tests/e2e/workflows.spec.ts` | Change only if a heading listed in section 4 is deliberately reworded (currently not planned) |

**F4: verification and capture (new files)**

| File | Change |
| --- | --- |
| `scripts/capture-report-screenshots.mjs` (new) | Builds nothing itself; starts `vite preview` on port 4175, drives the reproducible states below in a fresh browser context per shot (seeded state, `colorScheme: 'light'`, `reducedMotion: 'reduce'`, `deviceScaleFactor: 2`), saves PNGs as `../evidence/screenshots/ssNN-<name>.png` for the agreed IDs in section 7, and writes `manifest.json`. The manifest records the commit SHA, whether the tree was dirty, the capture time with timezone, the Chromium version, the viewport, the route, the steps and the crop selector. Dirty tree captures are refused unless `--allow-dirty` is passed, in which case they are marked. |
| `package.json` | **Not changed.** The script runs as `node scripts/capture-report-screenshots.mjs`, so the manifest and lockfile stay untouched. |
| `docs/VERIFICATION.md` | A new, separately dated section with the commands actually run. The 25 October record is left as is. |
| `docs/FRONTEND_GUIDE.md` | Update the "teal/indigo" design note (line 95) to the new tokens |

`docs/screenshots/*` and `scripts/capture-screenshots.mjs` stay untouched, because they are the evidence behind the 25 October record (now H01–H05) and the README image.

## 7 Screenshot plan (ScreenshotManifest, agreed IDs)

Agreed list of 6 November 2026. **It replaces the SS IDs in the Batch 0 packet.** To avoid two meanings for the same ID, the five historical captures in `docs/screenshots/` (25 October record) are now called **H01–H05** (`home`, `patient`, `doctor-review`, `admin-dark`, `patient-mobile`). They are not reused as report figures, and the Batch 0 manifest table should be relabelled to match.

Defaults:
- Light theme, a fresh seeded state for each shot, a 1440 × 900 viewport, device scale factor 2, a viewport capture (not full page) and `reducedMotion: 'reduce'`.
- Files are saved as `evidence/screenshots/ssNN-<name>.png`. An optional focused crop is saved as `ssNN-<name>-crop.png`.
- Every row is **pending capture**. The script fills in the capture time (IST), commit SHA, dirty-tree flag and Chromium version.
- Draft captions are finalised only after the actual pixels are viewed.

| ID | File | Route and reproducible state | Draft caption | Status | What the caption must make clear |
| --- | --- | --- | --- | --- | --- |
| SS01 | `ss01-home.png` | `/`, initial viewport | Public homepage of the MedAssist academic prototype (interface only; not a deployed clinical service). | Implemented interface | Public prototype interface |
| SS02 | `ss02-demo-access.png` | `/demo` | Demo access page for choosing a fictional patient, doctor or administrator perspective. This is not registration, login or authentication. | Demonstration only | Fictional role selection; not registration or login |
| SS03 | `ss03-patient-overview.png` | `/app/patient`, fresh seed | Patient overview summarising fictional cases, an appointment and documents held in page memory. | Demonstration only | Fictional summary |
| SS04 | `ss04-profile.png` | `/app/patient/profile` → **Edit profile** (edit mode: alias field with the hint "Use a fictional name ending in (Demo)…", plus the language-label select) | Profile editor in edit mode. Only a fictional display alias and a language-preference label can be changed. No personal, contact or medical details are collected, and the language label does not translate the interface. | Demonstration only | Demonstrated fields and limits of editable data |
| SS05 | `ss05-assessment.png` | `/app/patient/assessments` → Begin sample walkthrough → Continue ×3 (step 5, "Review the predefined sample.", whose text states that no symptom analysis or urgency assessment will run) | Review step of the fixed assessment walkthrough. All content is predefined, and no symptom analysis, urgency classification or advice is produced. | Demonstration only | Fixed walkthrough; no clinical inference |
| SS06 | `ss06-cases.png` | `/app/patient/cases`, fresh seed (the "Changes reset on reload" ribbon is in view) | Case tracking with temporary sample records. Statuses describe workflow progress, and changes are lost on reload. | Demonstration only | Temporary sample records |
| SS07 | `ss07-doctor-review.png` (+ crop of review panel) | `/app/doctor/reviews/MA-2402`. MA-2402 is a seeded case assigned to the fictional Dr. Avery Morgan, so the route is valid. Tick the confirmation → Record sample review (status becomes Reviewed and `.review-record` is visible). | Demonstration review recorded for fictional case MA-2402 with a predefined note. It is recorded separately from the unavailable AI concept and is not a clinical conclusion. | Demonstration only | Independent demonstration review |
| SS08 | `ss08-appointments.png` | `/app/patient/appointments` → Next sample month → Monday 2 Nov 2026 → 09:00 → Request sample appointment (dialog: "Fictional availability · Not a real healthcare booking" and "No appointment message is sent") | Confirmation step for a fictional appointment request. The slot is illustrative, nothing is booked and no message is sent. | Demonstration only | Fictional request, not live booking |
| SS09 | `ss09-admin-analytics.png` (+ crop of charts) | `/app/admin/analytics`, All months (the sample-data notice "not real hospital statistics" is in view) | Administrator analytics computed from synthetic sample records. The figures are not real patient or hospital statistics. | Demonstration only | Synthetic aggregates |
| SS10 | `ss10-consultation-comparison.png` | **Conditional: only if F3 adds the route.** Not captured otherwise. | Illustrative consultation comparison with fictional providers and example fees. Not sourced listings, not real availability and not a booking. | Demonstration only, if added | Illustrative data; source and availability limits |
| SS11 | `ss11-medication-awareness.png` | **Conditional: only if F3 adds the route.** Not captured otherwise. | Scripted medication-awareness demonstration with fixed fictional examples. No clinical check is performed and no assurance of safety is given. | Demonstration only, if added | Scripted demonstration; no clinical assurance |
| SS12 | `ss12-patient-overview-mobile.png` | `/app/patient` at 390 × 844, light, fresh seed | Patient overview at a 390 × 844 mobile viewport, showing the prototype's responsive layout (Chromium emulation, not a physical-device test). | Demonstration only (content); Implemented (responsive layout) | Responsive layout of the prototype |

Not in the agreed list, so these are not captured unless requested: profile validation error, assessment submitted state, cancelled appointment, upload-unavailable dialog, system liveness. Their behaviour remains covered by the browser tests and can be cited in Chapter 5 as test evidence rather than as figures.

If SS10 and SS11 are not added, the report keeps their numbers out of the figure list. Final figure numbers follow insertion order, so they do not need to stay contiguous with the SS IDs.

Run steps for F4 (Linux or macOS shown; on Windows PowerShell use `npm.cmd`/`npx.cmd`):

```bash
cd frontend
npm ci
npm run typecheck && npm run build && npm test && npm run format:check
npx playwright install chromium
npm run test:e2e
node scripts/capture-report-screenshots.mjs        # writes ../evidence/screenshots/ + manifest.json
```

## 8 Decisions needed before F1

1. **F3 scope (decides SS10 and SS11).** The default is to skip, because the brief does not include these screens in an agreed scope. Say so if you want illustrative consultation and medication demonstration screens anyway.
2. **Where to run.** Either enable package installs (a new chat picks up the change), so builds, tests and captures run here after each batch, or run section 7 on your own computer and share the output. Until then, F1–F2 code is unverified.
3. **Delivery.** The default is complete changed files plus a single `git` patch. Alternatively, commit to a branch and open a pull request, which needs push access to be granted to this session.
