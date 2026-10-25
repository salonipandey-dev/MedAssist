# MedAssist product frontend

A working React/TypeScript academic demonstration of connected patient, doctor and administrator workflows. All people, documents, appointments and metrics are fictional. The fixed demo date is **25 October 2026**; appointment slots run through December 2026. Reloading or resetting the demo restores the seed records.

## Run on your computer

Install Node.js **22.12 or newer** (Node 22 or 24 LTS recommended) and Git. From the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Keep the terminal open. Use `Ctrl+C` to stop.

The backend is **optional** for the frontend demonstration. Do not open the new `frontend/index.html` directly from your file manager; Vite must process its TypeScript modules. The preserved original HTML demo can be opened directly at `frontend/public/legacy/index.html`, or at `/legacy/index.html` while Vite is running.

For a production build and local preview:

```bash
npm run build
npm run preview
```

Preview runs at **http://127.0.0.1:4173**. These servers bind to loopback by default. A production static host must serve `frontend/dist/` and return `index.html` for application/public routes that do not match static files. Preserve `/legacy/index.html` and static assets. Hosting below a URL subdirectory requires configuring both Vite's base and the router basename; the current configuration assumes the domain root.

## Choose a demonstration

Start at `/demo`. The accounts are fictional and require no credentials:

| Perspective | Fictional account | Start route |
| --- | --- | --- |
| Patient | Mira Chen | `/app/patient` |
| Doctor | Dr. Avery Morgan | `/app/doctor` |
| Administrator | Jordan Ellis | `/app/admin` |

The header role selector changes perspective without discarding in-memory changes. It does not authenticate or authorize anyone. The patient overview filters to the sample patient; the doctor view filters to assigned sample cases. Those frontend filters are demonstrations, not server access controls.

## A useful demonstration sequence

1. Open the public homepage and try the four workflow stages. Explore platform previews and their patient/doctor/admin selectors.
2. Enter the patient demo. Edit the fictional display alias; try an invalid value and cancel/save. No real patient details are requested.
3. Open Assessments and follow the six-step predefined sample. Submission adds a case with workflow status **Submitted**, with no medical evaluation.
4. Open Appointments, select a future weekday and a sample time, confirm a request, then inspect and cancel it. Reserved slots become unavailable until cancellation.
5. Switch to Doctor. Open the review queue and a split-panel case review. Confirm the fictional-review checkbox, select a predefined note, and record a Reviewed or Closed workflow state. Professional review is separate from future AI predictions.
6. Switch to Administrator. Inspect the same case, filter analytics by month, export fictional aggregate CSV data, search/sort/page through users, and pause/resume sample availability with confirmation. Review the resulting sample event in Audit Activity.
7. Try dark mode, mobile navigation, document previews and the deliberately unavailable upload explanation. Reset the demonstration in Settings.

## Route architecture

| Experience | Routes |
| --- | --- |
| Public | `/`, `/platform`, `/how-it-works`, `/patients`, `/professionals`, `/security`, `/about`, `/demo` |
| Access aliases | `/sign-in` and `/app` redirect to `/demo` |
| Patient | `/app/patient`, `/profile`, `/history`, `/assessments`, `/cases`, `/cases/:caseId`, `/appointments`, `/reports`, `/notifications`, `/settings` (suffixes relative to `/app/patient`) |
| Doctor | `/app/doctor`, `/cases`, `/cases/:caseId`, `/patients`, `/reviews`, `/reviews/:caseId`, `/appointments`, `/schedule`, `/activity`, `/settings` (suffixes relative to `/app/doctor`) |
| Administrator | `/app/admin`, `/users`, `/doctors`, `/cases`, `/cases/:caseId`, `/appointments`, `/reports`, `/analytics`, `/audit`, `/settings` (suffixes relative to `/app/admin`) |
| Preserved prototype | `/legacy/index.html` |

Unknown pages and missing sample cases have useful fallback states. Role workspaces use separate navigation, visual accents and workflow compositions. The public website has its own layout and footer.

## Component and service organization

```text
frontend/
  public/legacy/             Original HTML/CSS/JS, preserved unchanged
  src/
    app/                    Providers, lazy routes, route announcements, error boundary
    components/
      layout/               Public and role workspace shells
      ui/                   Tailored Radix/shadcn-style primitives, tables, dialogs, notices
      charts/               Recharts trends/distributions and accessible data tables
    features/
      auth/                 Fictional role access and settings (no authentication)
      patient/              Overview, history, notifications and validated profile preferences
      doctor/               Review queue, split-panel review, patient context and schedule
      admin/                User directory, analytics and sample audit viewer
      appointments/         Calendar, slot constraints, requests and detail dialogs
      cases/                Shared case tables, details and drawers
      assessments/          Six-step read-only fictional walkthrough
      reports/              Safe document previews and unavailable-upload explanation
    pages/public/           Public content, coded UI previews and SVG artwork
    data/mock/              Typed seed, pure reducer and derived analytics
    services/api/           Existing read-only FastAPI liveness client only
    hooks/                  Responsive media-query hook
    types/                  Shared domain contracts
    styles/                 Tokens, light/dark themes, responsive compositions
    utils/                  Formatting and class-name helpers
  tests/                    Legacy safeguards, modern boundary checks, browser workflows
```

The React context owns temporary state. The pure reducer centralizes mutation rules, including slot conflicts, permitted review transitions and sample resets. Aggregates are computed from those same records. There is no browser-storage persistence or automatic mock-to-API fallback. All fonts are bundled locally. Motion respects the device's reduced-motion preference. Accessible primitives provide dialog trapping/restoration, status announcements, focus outlines, labeled controls and keyboard navigation.

`components.json`, the `@/` alias and Tailwind v4 integration support extending the local Radix/shadcn-style component system. Bespoke CSS supplies the product compositions and design tokens. The requested teal/indigo colors remain accents; darker text/button variants meet small-text contrast requirements.

## Real, mocked and unfinished

| Capability | Working today | Boundary / unfinished work |
| --- | --- | --- |
| Responsive public site | All eight public pages, coded previews, workflow interactions | Academic product explanation, no deployment claims |
| Theme / navigation | Light/dark themes, collapsible sidebar, mobile focus management, role switching | Memory-only theme and demo roles |
| Patient profile | React Hook Form + Zod validation; edit/save/cancel for fictional alias and language preference | No editable personal contact or health data; language preference does not translate the UI |
| Health history | Fixed fictional context and connected sample event timeline | Not an actual medical record |
| Assessment | Six predefined steps; submit sample case in memory | No symptom input, medical classification, diagnosis or advice |
| Case coordination | Search/filter/sort/page, detail drawers, event chronology and attachment references | No API persistence or real assignment process |
| Professional review | Independent sample review records, predefined notes, Reviewed/Closed workflow changes | No real clinical conclusions or free-text clinical collection |
| Appointments | Fictional calendar/slots, conflict prevention, request/confirmation/cancellation and history | No real availability, booking or external notifications |
| Reports | Metadata filters and safe built-in HTML previews | Type/page metadata is illustrative; original PDF/TXT downloads and real upload are unavailable |
| Administration | Searchable/sortable/paginated users, drawers, reversible availability controls | Pausing changes a sample label and future demo doctor choices, not access permissions |
| Analytics | Date-filtered charts, tooltips, accessible summaries and synthetic CSV export | Sample Data only; no real hospital metrics |
| Audit activity | Searchable chronological sample and session events | Not a secure, immutable production audit trail |
| System API | Optional GET `/health` with no-store, timeout, response validation and request ID | Liveness only, not database readiness |
| Authentication / storage | Explicit unavailable states | No credentials, sessions, JWT, database or private file storage |
| AI / SHAP | Nonfunctional conceptual panel, proposed labels and unavailable provenance | Dataset permission, training, evaluation, integration and appropriate validation required |

## Optional connection to the actual FastAPI service

Only the already implemented system endpoint is wired. Mock profiles, appointments, cases and reviews never call the backend.

1. In `frontend`, copy `.env.example` to `.env.local` (`Copy-Item` in PowerShell, `cp` in Unix). Set `VITE_API_BASE_URL=http://127.0.0.1:8000`. Vite must be restarted after configuration changes; rebuild for production preview.
2. Start the existing backend from `backend`, following the root README. Set `MEDASSIST_CORS_ORIGINS` to the exact browser origin, e.g. `http://127.0.0.1:5173` for Vite or `http://127.0.0.1:4173` for preview.
3. In Administrator → System Settings, select **Check API liveness**. Errors explain missing configuration or an unavailable service. Success displays the service version and exposed `X-Request-ID`.

The client rejects invalid origins and credential-bearing URLs. It sends a credential-free GET to `/health`, with `cache: no-store` and a five-second timeout. It validates `{ status: 'ok', service: 'medassist-api', version: string }`. There are no invented patient, JWT, Express or ML endpoints. All FastAPI files remain unchanged.

## Verification commands

Run from `frontend`:

```bash
npm ci
npm run typecheck
npm run build
npm test
npx playwright install chromium
npm run test:e2e
npm run format:check
```

On Linux CI or a minimal container, use `npx playwright install --with-deps chromium` to install required browser system libraries as well. Playwright is pinned and its core dependency is aligned to keep browser tooling reproducible.

`npm test` runs the four unchanged legacy-safety behaviors, modern source-boundary checks and Vitest reducer/API-contract checks. Browser tests exercise the actual compiled build, all 34 public/workspace entry routes at five widths, light/dark automated accessibility checks on eight representative screens, and critical workflows. Automated accessibility checks support review; they do not establish certification or replace manual assistive-technology testing.

From `backend`, run its existing `.venv` Python:

```bash
python -m unittest discover -s tests -v
python -m pip check
```

See [VERIFICATION.md](VERIFICATION.md) for the commands and results recorded for this delivery.

## Backend integration sequence

1. Decide with the faculty guide whether to extend the existing FastAPI application or add the synopsis's proposed application API separately. Do not silently replace FastAPI.
2. Define relational users/profiles/cases/assessments/reviews/appointments/report metadata, migrations and ownership rules.
3. Implement secure authentication, server-enforced roles and record-level authorization before enabling real inputs. Test cross-patient and unassigned-doctor denials.
4. Replace one mock capability at a time with a documented, validated service adapter. Implement the patient submission → persisted case → authorized independent doctor review workflow first; add reload-based persistence tests.
5. Implement transactional appointment conflict handling, private report storage, file validation/authorized downloads, server audit events and controlled notifications.
6. Finalize a permitted, meaningful labeled dataset, evaluate a baseline and candidate pipelines, document limitations and version the evaluated pipeline. Introduce a separate prediction contract only after integration and appropriate validation. Unavailable inference must never default to Routine.
7. Complete security and clinical reviews appropriate to the intended setting before any real healthcare use or compliance claim.
