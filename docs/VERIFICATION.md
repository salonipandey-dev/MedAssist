# Delivery verification

Local verification performed on 25 October 2026. These results describe the academic frontend and existing system API; they are not clinical validation, compliance certification or a production-security assessment.

## Commands actually executed

| Location | Command | Recorded result |
| --- | --- | --- |
| `frontend` | `npm ci` | Installed 215 packages from the lockfile successfully |
| `frontend` | `npm run typecheck` | Passed strict TypeScript checks, including unused locals/parameters |
| `frontend` | `npm run build` | Passed TypeScript and Vite production compilation; route chunks emitted without bundle-size warnings |
| `frontend` | `npm test` | 8 Node safety checks and 12 Vitest service/contract tests passed |
| `frontend` | `npm run test:e2e` | 19 compiled-browser tests passed |
| `frontend` | `npm run format:check` | Passed Prettier verification |
| `frontend` | `npm run screenshots` | Captured five screenshots from the compiled build |
| `backend` | `.venv/bin/python -m unittest discover -s tests -v` | 23 existing backend tests passed |
| `backend` | `.venv/bin/python -m pip check` | No broken dependency requirements |
| Repository root | `git diff --check` | Passed |
| Repository root | Compare original files to `frontend/public/legacy/` | Original HTML, CSS and JavaScript identical byte-for-byte |
| Repository root | `git diff 5758cf6 -- backend` | No backend changes |

Runtime: Node.js 24.22.1. Browser: Playwright-pinned Chromium 141. The GitHub workflow uses Node 22 and repeats the frontend build, tests, formatting and browser checks; hosted CI results must be read from the actual workflow run.

## Browser coverage

- All **34 public/workspace entry routes** rendered without horizontal page overflow or JavaScript errors at **320, 375, 768, 1024 and 1440px** (170 route/viewport combinations). Wide tables scroll inside their own containers.
- Eight representative screens passed automated WCAG A/AA checks in **light and dark** themes: homepage, demo access, profile, appointment request, doctor review, administrator overview, user directory and detailed analytics.
- Dark profile and review validation-error states also passed automated accessibility checks.
- Profile invalid input, save, cancel and reload reset were exercised.
- The six-step assessment used predefined fictional content and created a trackable Submitted case without any clinical inference.
- Fictional appointment creation, duplicate-slot prevention, detail view and confirmed cancellation were exercised.
- Professional review required confirmation and produced a separate review record, visible in the shared administrator case view.
- User search, empty state, filter, sorting, pagination, detail drawer, availability confirmation and resulting sample event were exercised.
- Analytics date changes recalculated the underlying aggregates; chart comparison controls, accessible data summaries and sample CSV export worked.
- Built-in document previews worked. No file picker existed. Closing the modal restored focus to its originating button.
- Mobile navigation contained keyboard focus, closed with Escape, restored focus and navigated to the selected screen.
- JavaScript-disabled root and legacy pages retained the nonclinical explanation and unavailable triage notice.
- Mock workflows produced no network mutations, system API calls or browser-storage writes. Missing API configuration produced an honest error state.

## Unit and source-boundary coverage

The shared seed has consistent user/case/report references. Derived counts agree with source records and date filters. Reducer checks reject duplicate appointments, invalid dates, unsupported doctors and invalid review transitions/templates. Reset restores the original seed. The API client rejects malformed origins/contracts and uses only the implemented credential-free, no-store GET `/health` request.

The four original legacy safety behaviors remain intact. Four additional checks guard the modern assessment, absent file picker, isolated API access, no persistent storage and JavaScript-disabled shell. UI source renders user-controlled aliases through React text, not HTML injection.

## Visual review

The homepage, patient overview, split-panel review, administrator dark theme and mobile patient overview were inspected as rendered browser screenshots. Contrast issues, viewport overflow and modal focus restoration found during verification were corrected before delivery. The final screenshots are in [screenshots/](screenshots/README.md).

## Limits and next evidence

- Browser automation was run in Chromium; Safari/Firefox and manual screen-reader testing remain useful follow-up checks.
- No real backend workflow, authentication, database, private upload storage, external calendar, notification service, trained model or clinical validation was added.
- The manual system API adapter is covered with response-contract tests; existing FastAPI endpoints retain their 23 HTTP/configuration tests.
- Production hosting must supply SPA route fallback. This delivery contains runnable source and build instructions, not a production deployment.
