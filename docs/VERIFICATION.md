# Delivery verification

Local verification performed on 25 October 2026. These results describe the academic frontend and existing system API; they are not clinical validation, compliance certification or a production-security assessment.

## Commands actually executed

| Location | Command | Recorded result |
| --- | --- | --- |
| `frontend` | `npm ci` | Installed 215 packages from the lockfile successfully |
| `frontend` | `npm run typecheck` | Passed strict TypeScript checks, including unused locals/parameters |
| `frontend` | `npm run build` | Passed TypeScript and Vite production compilation; route chunks emitted without bundle-size warnings |
| `frontend` | `npm test` | 8 Node safety checks and 12 Vitest service/contract tests passed |
| `frontend` | `npm run test:e2e` | 20 compiled-browser tests passed |
| `frontend` | `npm run format:check` | Passed Prettier verification |
| `frontend` | `npm run screenshots` | Captured five screenshots from the compiled build |
| `backend` | `.venv/bin/python -m unittest discover -s tests -v` | 23 existing backend tests passed |
| `backend` | `.venv/bin/python -m pip check` | No broken dependency requirements |
| Repository root | `git diff --check` | Passed |
| Repository root | Compare original files to `frontend/public/legacy/` | Original HTML, CSS and JavaScript identical byte-for-byte |
| Repository root | `git diff 5758cf6 -- backend` | No backend changes |

Runtime: Node.js 24.22.1. Browser: Playwright-pinned Chromium 141. The GitHub workflow uses Node 22 on Ubuntu 24.04 and repeats the frontend build, tests, formatting and browser checks. The first hosted run passed installation, formatting, build and unit/safety tests, then exposed that `ubuntu-latest` selected unsupported Ubuntu 26.04 for pinned Playwright 1.56.1. The runner was pinned to supported Ubuntu 24.04; hosted CI results must be read from the actual workflow run.

## Browser coverage

- All **34 public/workspace entry routes** rendered without horizontal page overflow or JavaScript errors at **320, 375, 768, 1024 and 1440px** (170 route/viewport combinations). Wide tables scroll inside their own containers.
- Eight representative screens passed automated WCAG A/AA checks in **light and dark** themes: homepage, demo access, profile, appointment request, doctor review, administrator overview, user directory and detailed analytics.
- Dark profile and review validation-error states also passed automated accessibility checks.
- Profile invalid input, save, cancel and reload reset were exercised.
- The six-step assessment used predefined fictional content and created a trackable Submitted case without any clinical inference.
- Fictional appointment creation, selected-professional consistency in the patient overview, duplicate-slot prevention, detail view and confirmed cancellation were exercised. The professional-preview regression was observed failing before its source lookup was corrected.
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

---

## 6 November 2026: frontend redesign session (separate from the record above)

Scope: batches F1–F4 on branch `docs/frontend-redesign-f0`. These were the shared minimal design, restyled screens, consultation and medication-information demonstrations, and screenshot tooling. Environment: a cloud session with Node.js 22.23.4 and no access to the npm registry (`npm view` → `ENOTFOUND registry.npmjs.org`). The project's dependencies therefore **could not be installed**, and the project's own scripts could not run.

**Not executed in this session:** `npm ci`, `npm run typecheck`, `npm run build`, Vitest through `npm test`, `npm run test:e2e` (Playwright and axe), `npm run format:check` with the pinned Prettier, `npm run screenshots:report`, and the backend `unittest` suite (no backend files were changed). These must be run, and their results recorded here with date, commit, OS, Node and browser versions, before they are cited.

Checks that were executed, with substitutes named:

| Check | How it was run | Outcome |
| --- | --- | --- |
| Node source-boundary tests | `node --test tests/nonclinical-demo.test.cjs tests/modern-safeguards.test.cjs` (the Node half of `npm test`) | 10 passed, 0 failed (8 existing + 2 new for the F3 demonstrations) |
| Vitest unit files | Each file bundled with esbuild 0.28.2 against a minimal `describe`/`it`/`expect` stand-in and run with `node --test` (Vitest itself unavailable). `system.test.ts` was not run because it needs `vi` mocks. | `service.test.ts` 8/8, `consultations.test.ts` 3/3, `medications.test.ts` 3/3 |
| Formatting | Prettier 3.8.1 (project pins 3.9.10): `prettier --check "src/**/*.{ts,tsx,css}" tests/e2e` | All files pass |
| Partial type check | TypeScript 6.0.3 on `frontend/src` with third-party modules declared as `any` and `noUnusedLocals`/`noUnusedParameters` on, compared against the same check on `ea3e137` | No new errors (cannot check props passed to third-party components) |
| Rendered review | A preview bundle of the real `src/` built with esbuild and Tailwind 4.3.3. Router, Radix, lucide icons, sonner, motion, recharts and react-hook-form are replaced by local stand-ins. Viewed in Chromium. | Screens inspected at 1440 × 900 and 390 × 844, light and dark. Icons appear as placeholders in these renders, so they are not report evidence. |
| Route sweep (preview bundle) | All 36 routes from `tests/e2e/workflows.spec.ts` at 320/375/768/1024/1440 px: horizontal overflow, one `h1`, no page errors | Clean after fixing two regressions found during F1 |
| Workflow replays (preview bundle) | The e2e scenarios for homepage → demo → patient, profile validation, mobile navigation focus trap, public mobile menu, consultation filters and comparison limit, and medication information states, with a minimal polling `expect` | 6/6 passed |
| Text contrast | Script measuring the WCAG ratio of visible text against its composited background, light and dark, on F1–F3 screens | No app text below 4.5:1 (3:1 for large text) |
| Screenshot script | `capture-report-screenshots.mjs --base-url=<preview bundle> --out=<scratch> --allow-dirty` | All 13 states and 3 crops reached. The images were discarded because the preview bundle is not the real build. |

### Real CI execution on GitHub Actions (6 November 2026)

These results come from running the project's actual commands, not the substitutes above. Pull request [#4](https://github.com/salonipandey-dev/MedAssist/pull/4), commit `961d532b7a963654daf24693605a63008c8279c8` (F0–F4 plus the screenshot workflow), workflow run [42258488918](https://github.com/salonipandey-dev/MedAssist/actions/runs/42258488918), 17:06–17:17 UTC. Runner image `ubuntu-24.04`, version 20261101.360.1; Node.js v22.23.4; Playwright-pinned Chromium 141.0.7390.37.

| Step | Command | Outcome |
| --- | --- | --- |
| Install | `npm ci` | 215 packages installed |
| Formatting | `npm run format:check` | All matched files use Prettier code style |
| Typecheck and build | `npm run build` (`tsc --noEmit && vite build`, Vite 8.3.5) | Passed |
| Unit and source tests | `npm test` | Node: 10 passed, 0 failed. Vitest: 4 files, 18 tests passed |
| Browser workflows, 36 routes at five widths, light/dark accessibility checks | `npm run test:e2e` | 22 passed (2.0 min), including the two new consultation and medication scenarios |

An earlier run on `5b280fc` ([42258264713](https://github.com/salonipandey-dev/MedAssist/actions/runs/42258264713)) passed install, formatting, build and `npm test`. It was cancelled during the browser step when the next push superseded it.

Report screenshots were captured from the production build of `961d532` by the `Report screenshots` workflow ([run 42258489108](https://github.com/salonipandey-dev/MedAssist/actions/runs/42258489108)): 13 screenshots and 3 crops, uploaded as the `report-screenshots` artifact. They are added to `docs/screenshots/report/` only after visual inspection.

Not covered: Firefox and Safari, manual screen-reader testing, and the backend suite (no backend files changed).

### Follow-up pull request #5: screenshots and a mobile fix (6 November 2026)

Pull request [#4](https://github.com/salonipandey-dev/MedAssist/pull/4) was merged into `main` (`138a9c6`), and CI passed on `main` after the merge ([run 42261177461](https://github.com/salonipandey-dev/MedAssist/actions/runs/42261177461)). Follow-up work is in pull request [#5](https://github.com/salonipandey-dev/MedAssist/pull/5).

- Inspecting a first set of real screenshots showed two problems. At 400 px and below, the demo-role selector clipped its label ("Patient dem"); the CSS was fixed in `71876a9`. A confirmation toast covered the recorded review in SS07; from `b83b015`, the capture script closes toasts and refuses to capture over one. Both early sets were discarded.
- CI on `b83b015` ([run 42267504081](https://github.com/salonipandey-dev/MedAssist/actions/runs/42267504081)) ran `npm ci`, the format check, the typecheck and build, `npm test` and `npm run test:e2e`. All passed.
- The report screenshots were captured from the production build of `b83b015` by [run 42267504146](https://github.com/salonipandey-dev/MedAssist/actions/runs/42267504146) (Chromium 141.0.7390.37) and published to the `report-screenshots/b83b015` review branch. All 13 screenshots and 5 crops were inspected before being committed to `docs/screenshots/report/`. Capture details are in [SCREENSHOT_MANIFEST.md](SCREENSHOT_MANIFEST.md).

