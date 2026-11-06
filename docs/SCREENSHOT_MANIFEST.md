# Screenshot manifest

**Status: pending capture.** No report screenshot has been captured from the redesigned application yet. The capture session could not install the project's dependencies. Run, from `frontend/` on a committed tree:

```bash
npm ci && npm run build && npx playwright install chromium && npm run screenshots:report
```

The script regenerates this file from the actual run. It fills in the capture time, time zone, commit and Chromium version, and writes the images to `docs/screenshots/report/`. Each shot uses a fresh browser context, fictional seeded records, the light theme, reduced motion and device scale factor 2.

Screenshots show interface states. They cannot prove authentication, persistence, clinical accuracy, real availability or production readiness.

| ID | File(s) | Route | Visible state | Viewport | Draft caption | Status and limitation |
| --- | --- | --- | --- | --- | --- | --- |
| SS01 | `ss01-home.png` | `/` | Initial viewport | 1440 × 900 | Public homepage of the MedAssist academic prototype. | Implemented interface. Not a deployed clinical service. |
| SS02 | `ss02-demo-access.png` | `/demo` | Initial viewport | 1440 × 900 | Demo access page for choosing a fictional patient, doctor or administrator view. | Demonstration only. Not registration, login or authentication. |
| SS03 | `ss03-patient-overview.png` | `/app/patient` | Fresh seeded state | 1440 × 900 | Patient overview summarising fictional cases, an appointment and documents. | Demonstration only. In page memory; resets on reload. |
| SS04 | `ss04-profile.png` | `/app/patient/profile` | Edit profile opened | 1440 × 900 | Profile editor: only a fictional alias and a language-preference label can be changed. | Demonstration only. No personal, contact or medical details; no translation. |
| SS05 | `ss05-assessment.png` | `/app/patient/assessments` | Step 5, "Review the predefined sample." | 1440 × 900 | Review step of the fixed assessment walkthrough. | Demonstration only. No symptom analysis, urgency or advice. |
| SS06 | `ss06-cases.png` | `/app/patient/cases` | Fresh seeded state | 1440 × 900 | Case tracking with temporary sample records. | Demonstration only. Status is workflow, not urgency. |
| SS07 | `ss07-doctor-review.png`, `-crop.png` | `/app/doctor/reviews/MA-2402` | Confirmation ticked, review recorded | 1440 × 900 | Demonstration review recorded for fictional case MA-2402. | Demonstration only. No authenticated clinician or clinical conclusion. |
| SS08 | `ss08-appointments.png` | `/app/patient/appointments` | 2 Nov 2026, 09:00, confirmation dialog | 1440 × 900 | Confirmation step for a fictional appointment request. | Demonstration only. Nothing booked; no message sent. |
| SS09 | `ss09-admin-analytics.png`, `-crop.png` | `/app/admin/analytics` | All months | 1440 × 900 | Administrator analytics from synthetic sample records. | Demonstration only. Not real hospital statistics. |
| SS10 | `ss10-consultation-comparison.png`, `-crop.png` | `/app/patient/consultations` | Three options compared | 1440 × 900 | Comparison of three fictional consultation options with illustrative fees. | Demonstration only. Invented providers and fees; no availability or booking. |
| SS11 | `ss11-medication-information.png` | `/app/patient/medications` | "Same ingredient in two products" | 1440 × 900 | Scripted medication-information example with invented names. | Demonstration only. Nothing checked; no notice ≠ safe. |
| SS11b | `ss11b-medication-incomplete.png` | `/app/patient/medications` | "Incomplete information" | 1440 × 900 | Missing information shown separately from possible issues. | Demonstration only. "Not recorded" differs from "none". |
| SS12 | `ss12-patient-overview-mobile.png` | `/app/patient` | Fresh seeded state | 390 × 844 | Patient overview at a mobile viewport. | Demonstration only. Chromium emulation, not a device test. |

## Historical captures

`docs/screenshots/home.png`, `patient.png`, `doctor-review.png`, `admin-dark.png` and `patient-mobile.png` belong to the 25 October 2026 verification record (H01–H05 in the report control packet). They predate the redesign and are kept unchanged.
