# MedAssist frontend audit and migration

Audit baseline: `5758cf63c301887db8bdb35735e83204c1e1ad04` on `main` (25 October 2026).

## Evidence reviewed

- All tracked repository files, including the original HTML/CSS/JS demo and its four regression tests.
- `docs/MedAssist SYNOPSIS (Saloni Pandey).pdf` (10 pages), the evaluation report and presentation.
- `Readme.md`, contributor instructions, backend configuration, middleware, schemas, HTTP examples, all three backend test modules and both CI workflows.

## What actually exists

The FastAPI application has GET `/`, GET/HEAD `/health`, OpenAPI/Swagger/ReDoc, exact-origin opt-in CORS and server-owned request IDs. Liveness returns `Cache-Control: no-store`, including conditional GET/HEAD. Tests cover these contracts, client errors, unexpected failures and configuration. There is no patient, authentication, appointment, storage, case or inference service.

The original frontend has sample registration in a temporary table, navigation anchors and a static triage-unavailable notice. It sends no data and produces no risk results. Its four existing safeguard tests must continue to pass, including JavaScript-disabled behavior and safe text rendering.

The synopsis proposes React/Tailwind, Node/Express as an application layer, PostgreSQL and FastAPI inference. The evaluation report explicitly records these as proposed work, with dataset selection, training and measurement pending. It separates Submitted/Assigned/Reviewed/Closed workflow states from proposed Routine/Needs Medical Review/Urgent Review urgency labels. SHAP is a future possibility, not an implemented explanation system.

## Migration decision

Preserve the original prototype byte-for-byte at `frontend/public/legacy/`; point its existing tests there. Vite serves it at `/legacy/index.html`. Build a separate typed React application in `frontend/src/` with role-specific routes, reusable accessible primitives and an in-memory synthetic data service. Keep every backend file and HTTP contract unchanged. Do not create an Express service.

Public routes explain the product and current status. Role routes demonstrate different patient, doctor and administrator workflows, without pretending to authenticate or enforce server permissions. Reloading resets all demo mutations. Only a manually requested system-liveness check may contact FastAPI; mock services never fall back to a real API.

## Boundaries and risks

| Capability | Implementation boundary |
| --- | --- |
| Profiles | Fictional display alias and interface preferences only; no editable health/contact data |
| Assessment | Six-step walkthrough of predefined fictional text; no health-input controls, inference or advice |
| Cases / reviews | Memory-only workflow changes; professional-review records separate from future predictions |
| Appointments | Fictional dates/slots, duplicate-slot checks and reversible sample requests |
| Reports | Built-in safe document preview; real upload input absent/disabled |
| Analytics | Computed from shared synthetic records; visibly labeled Sample Data |
| Administration | Demonstration controls; no security or production audit claims |
| Authentication / ML | Explicitly unavailable; no credentials, predictions, scores or invented accuracy |

Clinical safety, real authentication/authorization, storage access, persistence, deployment security and a permitted labeled dataset remain backend integration work. A frontend role switch is not an access boundary. Dates use a fixed sample clock so an academic presentation remains reproducible.

## Delivery verification

Run strict TypeScript and production build, existing legacy safeguards, mock-state and API-boundary tests, browser workflows and responsive checks. Include keyboard/dialog handling, no-JavaScript notice, no clinical input/file controls, no storage writes or mock network requests, sample-data consistency, theme rendering and missing-route behavior. Preserve the backend test suite.
