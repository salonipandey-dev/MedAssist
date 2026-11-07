# Frontend evidence handoff for the report writer

**Status as of 7 November 2026.**

## 1 Code versions

| Item | Value |
| --- | --- |
| Repository | <https://github.com/salonipandey-dev/MedAssist> |
| Original redesign merge on `main` | [`138a9c6`](https://github.com/salonipandey-dev/MedAssist/commit/138a9c6102f51898aee1ebf7cdc987b49fc21a17), the merge of [pull request #4](https://github.com/salonipandey-dev/MedAssist/pull/4) (redesign batches F0–F4), merged 6 Nov 2026 17:23 UTC |
| Merged frontend and report assets on `main` | `5f1e12d` includes the demo-role selector fix for widths of 400 px and below, the screenshot workflow and capture-script fixes, and the inspected report images and manifest. [Merge commit](https://github.com/salonipandey-dev/MedAssist/commit/5f1e12d96a9b7d4eb48ecdc23e54833ba416a52f) · [Pull request #5](https://github.com/salonipandey-dev/MedAssist/pull/5) |
| Screenshot build | `b83b015` is the capture source recorded in the manifest. [Capture commit](https://github.com/salonipandey-dev/MedAssist/commit/b83b0151b2c0ca4d321f59805b7d72a15d8556e5) |

The `frontend/` tree is identical at `b83b015` and `5f1e12d`. [Commit comparison](https://github.com/salonipandey-dev/MedAssist/compare/b83b0151b2c0ca4d321f59805b7d72a15d8556e5...5f1e12d96a9b7d4eb48ecdc23e54833ba416a52f)

Commits in PR #4: [`c0e7d94`](https://github.com/salonipandey-dev/MedAssist/commit/c0e7d94) F0 audit · [`8d92a2a`](https://github.com/salonipandey-dev/MedAssist/commit/8d92a2a) F1 shared design, homepage, demo access, patient overview, profile · [`a878097`](https://github.com/salonipandey-dev/MedAssist/commit/a878097) F2 workflow and public screens · [`a9893fd`](https://github.com/salonipandey-dev/MedAssist/commit/a9893fd) F3 consultation and medication demonstrations · [`5b280fc`](https://github.com/salonipandey-dev/MedAssist/commit/5b280fc) F4 screenshot tooling and docs · [`961d532`](https://github.com/salonipandey-dev/MedAssist/commit/961d532) screenshot workflow · [`92cb5c8`](https://github.com/salonipandey-dev/MedAssist/commit/92cb5c8) CI results recorded.

Commits in PR #5: [`2cceb20`](https://github.com/salonipandey-dev/MedAssist/commit/2cceb20), [`d3b814a`](https://github.com/salonipandey-dev/MedAssist/commit/d3b814a) review-branch publishing · [`71876a9`](https://github.com/salonipandey-dev/MedAssist/commit/71876a9) selector fix · [`b83b015`](https://github.com/salonipandey-dev/MedAssist/commit/b83b015) toast handling in the capture script · [`d82fb84`](https://github.com/salonipandey-dev/MedAssist/commit/d82fb84) screenshots and manifest · [`c3bfab7`](https://github.com/salonipandey-dev/MedAssist/commit/c3bfab7e4c859683ff4c37b2600c00374ba56284) evidence handoff.

## 2 Verification (actual CI runs)

All runs used GitHub Actions on `ubuntu-24.04` with Node.js v22.23.4, run from `frontend/`. Browser checks ran in Playwright-pinned Chromium 141.0.7390.37. The runs in the table recorded the following command results.

| Command | Result |
| --- | --- |
| `npm ci` | 215 packages installed |
| `npm run format:check` | All files pass |
| `npm run build` (`tsc --noEmit && vite build`, Vite 8.3.5) | Passed |
| `npm test` | Node source tests 10/10; Vitest 4 files, 18/18 |
| `npm run test:e2e` | 22/22 passed (about 2 minutes): critical workflows, all 36 routes at 320/375/768/1024/1440 px, light/dark automated accessibility checks on representative screens, and the consultation and medication scenarios |

| Run | Commit | Date (UTC) | Outcome |
| --- | --- | --- | --- |
| [42261177461](https://github.com/salonipandey-dev/MedAssist/actions/runs/42261177461) | `main` `138a9c6` (push after merge) | 6 Nov 17:23–17:26 | Success |
| [42258488918](https://github.com/salonipandey-dev/MedAssist/actions/runs/42258488918) | `961d532` (PR #4) | 6 Nov 17:06–17:17 | Success |
| [42267504081](https://github.com/salonipandey-dev/MedAssist/actions/runs/42267504081) | `b83b015` (PR #5, screenshot source) | 6 Nov 18:05–18:07 | Success |
| [42267995886](https://github.com/salonipandey-dev/MedAssist/actions/runs/42267995886) | `d82fb84` (PR #5) | 6 Nov 18:08–18:11 | Success |

The frontend workflow also passed on `main` at `5f1e12d` after PR #5 merged. [Post-merge frontend run](https://github.com/salonipandey-dev/MedAssist/actions/runs/42277306257)

Not covered: Firefox and Safari, manual screen-reader testing, and the backend suite (no backend files changed). The automated accessibility checks support review; they are not certification.

## 3 Screenshots

The screenshots were captured from the production build of `b83b015` by [run 42267504146](https://github.com/salonipandey-dev/MedAssist/actions/runs/42267504146) between 2026-11-06 18:05:56 and 18:06:05 UTC. Each was taken in Chromium 141.0.7390.37 in a fresh browser context, with fictional seeded records, the light theme and device scale factor 2, from a clean tree. All were inspected before commit and are available on `main`. [Report screenshots](screenshots/report/) · [Screenshot manifest](SCREENSHOT_MANIFEST.md) · [Capture metadata](screenshots/report/manifest.json)

| ID | File(s) | Route | State | Status |
| --- | --- | --- | --- | --- |
| SS01 | `ss01-home.png` | `/` | Initial view | Implemented interface |
| SS02 | `ss02-demo-access.png` | `/demo` | Initial view | Demonstration only |
| SS03 | `ss03-patient-overview.png` | `/app/patient` | Seeded state | Demonstration only |
| SS04 | `ss04-profile.png` | `/app/patient/profile` | Edit mode | Demonstration only |
| SS05 | `ss05-assessment.png` | `/app/patient/assessments` | Step 5 of 6 | Demonstration only |
| SS06 | `ss06-cases.png` | `/app/patient/cases` | Seeded state | Demonstration only |
| SS07 | `ss07-doctor-review.png`, `-crop.png` | `/app/doctor/reviews/MA-2402` | Review recorded | Demonstration only |
| SS08 | `ss08-appointments.png` | `/app/patient/appointments` | 2 Nov 2026 09:00, confirmation dialog | Demonstration only |
| SS09 | `ss09-admin-analytics.png`, `-crop.png` | `/app/admin/analytics` | All months | Demonstration only |
| SS10 | `ss10-consultation-comparison.png`, `-crop.png` | `/app/patient/consultations` | Three options compared | Demonstration only |
| SS11 | `ss11-medication-information.png`, `-crop.png` | `/app/patient/medications` | "Same ingredient in two products" | Demonstration only |
| SS11b | `ss11b-medication-incomplete.png`, `-crop.png` | `/app/patient/medications` | "Incomplete information" | Demonstration only |
| SS12 | `ss12-patient-overview-mobile.png` | `/app/patient` | 390 × 844 | Demonstration only |

Two earlier capture sets (from `d3b814a` and `71876a9`) were discarded after inspection. In one, a confirmation toast covered SS07; in the other, the mobile selector was clipped. They exist only on CI review branches named `report-screenshots/*`; none of those branches is evidence and all can be deleted. The 25 October captures in `docs/screenshots/*.png` (H01–H05) predate the redesign and are kept unchanged.

## 4 Status of each capability

| Capability | Status | Where |
| --- | --- | --- |
| Minimal visual design, responsive layouts, light/dark themes, keyboard and focus behaviour | **Implemented interface** | `frontend/src/styles/`, `components/layout/` |
| Public site (8 pages) and demo access | Implemented interface; role selection is **demonstration only** (not sign-in) | `pages/public/`, `features/auth/DemoAccess.tsx` |
| Patient overview, profile, history, assessment walkthrough, cases, appointments, documents, notifications | **Demonstration only.** Fictional in-memory records that reset on reload. The assessment has predefined content with no symptom analysis. Appointments are not bookings. Documents are built-in previews, not uploads. | `features/` |
| Doctor review and administrator accounts, analytics, CSV and audit | **Demonstration only.** Predefined notes and no clinical conclusion. Analytics come from synthetic records. The audit view is not a secure log. | `features/doctor/`, `features/admin/` |
| Consultation discovery and comparison (`/app/patient/consultations`) | **Demonstration only.** Invented providers, illustrative or "not listed" fees, compare up to three, no availability, contact or booking. | `features/consultations/`, `data/mock/consultations.ts` |
| Medication information (`/app/patient/medications`) | **Demonstration only.** Six scripted examples with invented names. Possible issues are kept separate from missing information. No input and no checking; the absence of a notice is not a safety statement. | `features/medications/`, `data/mock/medications.ts` |
| System API liveness client | **Implemented** (unchanged; liveness only) | `services/api/system.ts`, `backend/app/` |
| Real provider data, verified free services, medicine reference source, interaction/allergy/duplicate/condition checking | **Proposed, not implemented** | — |
| Authentication, server roles, database persistence, private uploads, trained AI model | **Proposed, not implemented** | — |

Report-relevant corrections made in the code:
- The About page no longer names a faculty guide (the guide field is unresolved).
- The admin demo label is now "Administrator workspace".
- The patient sidebar now includes "Find Consultations" and "Medication Info".

## 5 Remaining items

1. Optionally delete the CI review branches named `report-screenshots/*`. Optionally remove the unused `@fontsource/manrope` dependency.
2. The screenshot workflow has `contents: write` so that it can publish review branches. This applies only to same-repository pull requests and manual runs. Remove the publishing step if it is no longer wanted.
3. Real data sources, clinical review, authentication and persistence remain outside this frontend delivery.

## Historical records (not current status)

- [VERIFICATION.md](VERIFICATION.md), 25 October 2026 record: earlier local verification, kept unchanged.
- VERIFICATION.md, 6 November "frontend redesign session" table: substitute checks run while npm and push access were unavailable. They were superseded the same day by the CI sections that follow it.
- [FRONTEND_REDESIGN_F0.md](FRONTEND_REDESIGN_F0.md) and [FRONTEND_REDESIGN_F1.md](FRONTEND_REDESIGN_F1.md): working notes. Their statements that pushing was refused, that tests were not run, or that screenshots were pending describe the situation when they were written.
