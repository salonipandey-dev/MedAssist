# Final report: scope and evidence checklist

> Academic reporting aid, reviewed against repository documentation on 4 November 2026; demonstration rows updated 6 November 2026 after the frontend redesign batches (see [FRONTEND_DELIVERY_HANDOFF.md](FRONTEND_DELIVERY_HANDOFF.md)). This checklist is **not** a claim of new implementation or test execution. Recheck source files and run tests before submitting the final report.

## Project focus

**Registered title:** MedAssist: An AI-Assisted Healthcare Triage and Patient Management Platform.

**Revised problem statement (project direction, not completed functionality):**

1. Help people discover and compare healthcare consultations, prioritizing accessible, free or low-cost options when reliable provider information exists.
2. Help people recognize potential medication risks associated with existing conditions, known drug allergies, duplicate active ingredients, and combinations of medicines.

MedAssist should be described as a **healthcare-navigation and decision-support concept**, not as a diagnostic tool, prescribing service, clinical guarantee, or replacement for a doctor or pharmacist. Until validated clinical integrations exist, do not imply that the running prototype gives medication guidance or real provider recommendations.

## Implementation boundary to preserve

The following status reflects the checked-in [README](../Readme.md), [frontend guide](FRONTEND_GUIDE.md), and [verification record](VERIFICATION.md), **not a fresh audit of every source file**.

| Capability | Reporting status | Evidence to inspect |
| --- | --- | --- |
| Responsive public website and patient/doctor/admin demo workspaces | Implemented academic demo with fictional data | `frontend/src/`, [frontend guide](FRONTEND_GUIDE.md), [screenshots](screenshots/README.md) |
| Fictional case, assessment, review, and appointment workflows | Implemented **in-memory mock interactions**; reset on reload | `frontend/src/data/mock/`, frontend tests |
| Sample dashboard analytics and CSV export | Implemented using **synthetic** records | `frontend/src/data/mock/`, frontend tests |
| FastAPI welcome, liveness, OpenAPI, request IDs and CORS configuration | Implemented system-level API only | `backend/app/`, `backend/tests/`, `backend/requests.http` |
| User authentication, server roles, database persistence and private uploads | Not implemented in documented prototype | [frontend guide](FRONTEND_GUIDE.md), [README](../Readme.md) |
| Consultation discovery and comparison (frontend demonstration, added 6 November 2026) | **Demonstration only**: fictional directory, filters and comparison of up to three options with illustrative fees | `frontend/src/features/consultations/`, `frontend/src/data/mock/consultations.ts`, `consultations.test.ts`, e2e test "consultation demo…", [screenshot manifest](SCREENSHOT_MANIFEST.md) SS10 |
| Real provider search, fee/availability comparison, confirmed free or low-cost consultations | Revised project goal; **not implemented** (the demonstration above uses invented data) | Add data source, consent/terms review and tested screenshots if built |
| Medication-information presentation (frontend demonstration, added 6 November 2026) | **Demonstration only**: scripted examples with invented names; possible issues separated from missing information; no input or checking | `frontend/src/features/medications/`, `frontend/src/data/mock/medications.ts`, `medications.test.ts`, e2e test "medication demo…", SS11/SS11b |
| Medication profile and drug interaction/allergy/condition warnings | Revised project goal; **not implemented** (no medicine reference source, rules engine or clinical review) | Add approved source/version, limitations and clinical review if built |
| Trained AI model, diagnosis, prescription or clinically validated triage | **Do not claim implemented or clinically validated** | Would require dataset rights, evaluation, model records and independent safety review |

Historical synopsis, evaluation report and presentation in this repository are **planning documents**, not proof that all proposed features have shipped. If the application has changed since the documentation above, update the table only after inspecting the current code, runtime and tests.

## Collect evidence for each final-report chapter

- [ ] **Introduction / problem statement:** explain affordability, comparison criteria and medication-risk awareness; state patient safety boundaries.
- [ ] **Objectives and scope:** separate original registered title, revised product goals, implemented demo and future work.
- [ ] **Requirements:** include functional/non-functional requirements; mark each as implemented, mock-only, planned or not verified.
- [ ] **Architecture:** draw only components supported by source. Distinguish React in-memory services from the FastAPI system API; do not draw a live database or model as deployed.
- [ ] **Screenshots:** capture application pages with fictional data; name the route, date and whether it is a demo. Compare with `docs/screenshots/`.
- [ ] **Testing:** rerun commands below, record exact date, environment, counts and result. Do not substitute older test totals for new runs.
- [ ] **Safety and limitations:** state no real patient storage, clinical diagnosis or reliable medication decision-making in this prototype.
- [ ] **Future work:** include data provenance for consultation pricing, secure user profiles, interaction-rule validation, clinical review and privacy controls.
- [ ] **References:** cite original, accessible technical/medical sources for any external clinical or pricing claim; do not invent studies, surveys, statistics or user feedback.
- [ ] **Guide review:** reconcile all implemented-versus-planned claims with faculty feedback before submission.

## Reproducible checks (record results separately)

Run from `frontend/` after installing dependencies:

```bash
npm ci
npm run typecheck
npm run build
npm test
npm run format:check
npx playwright install chromium
npm run test:e2e
```

On Windows PowerShell, use `npm.cmd` and `npx.cmd` in place of `npm` and `npx` when script execution is blocked.

Run from `backend/` with its configured virtual environment:

```bash
python -m pip install -r requirements-dev.txt
python -m pip check
python -m unittest discover -s tests -v
```

The [25 October 2026 verification record](VERIFICATION.md) documents earlier results and their limits. It does **not** establish what passed on 4 November or that the revised consultation/medication features work.

## Evidence log template

Copy one row per claim into the report working notes.

| Claim | Status (implemented/mock/planned/unverified) | Code or document path | Test/screenshot | Verified on | Limitations |
| --- | --- | --- | --- | --- | --- |
| Example: sample appointment request | Mock-only | `frontend/src/features/appointments/` | [EVIDENCE REQUIRED: latest run] | [DATE] | No real provider booking |
| Example: medicine interaction checking | Unverified/planned | [EVIDENCE REQUIRED] | [EVIDENCE REQUIRED] | [DATE] | Do not present as usable clinical advice |

**Final reporting rule:** when proof is missing, use `[EVIDENCE REQUIRED]` and a clearly stated limitation instead of inventing implementation or results.
