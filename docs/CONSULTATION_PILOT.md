# Consultation pilot with verified listings (MA-06)

The pilot lets Find Consultations show a small set of consultation options for one
locality in India, each with the page it was checked against, the date it was last
checked, its fee basis and its eligibility conditions. It is **off by default**.
While it is off, the directory serves only the fictional demo.

**No approved source has been supplied yet**, so this repository contains no real
listing. The importer, the database rules, the API and the screen are proved with a
clearly labelled **fictional test fixture**
(`backend/app/fixtures/consultation_pilot_fixture.json`). Its source, providers,
fees, conditions and URLs are invented. Its URLs use `example.org`, and every name
says "(fictional)". [Candidate source](#candidate-source-and-what-still-needs-review)
below lists what a real dataset still needs before it can be imported.

## Settings

The server reads these settings at startup, so restart FastAPI after you change one.

| Variable | Default | Meaning |
| --- | --- | --- |
| `MEDASSIST_CONSULTATION_PILOT` | `off` | `on` serves imported pilot listings by default. Any other value except `off` or empty stops the server from starting. |
| `MEDASSIST_PILOT_FRESHNESS_DAYS` | `90` | How many days a check stays current (1–365). |
| `MEDASSIST_PILOT_AS_OF` | today in India (Asia/Kolkata) | Pins the date that freshness is judged on. Use it only for tests and demonstrations. |

With the pilot on, `GET /api/v1/consultations` returns pilot listings, and
`?dataset=demo` still returns the fictional demo. With the pilot off, `?dataset=pilot`
returns `404`. The browser never chooses: it shows whatever the server serves and
labels it. The demo badge reads "Fictional demo", and the pilot badge reads "Pilot"
or "Pilot · fictional fixture".

## Freshness window

A check made on day *D* stays **current** through *D* + 90 days, which the API
returns as `recheck_due_on`. From the next day, the listing shows **Needs recheck**:

- The listing is still shown with its last-checked date and source link.
- A listing the source called free is returned with an **unknown** fee and
  `free_label_suppressed: true`. The screen shows "Needs recheck" in place of the
  fee, and the details explain that the Free label is hidden until a recheck.
- SQL applies the same rule. The Free filter never returns a stale listing,
  "Fee not listed" includes it, and "Up to ₹300" leaves it out.

To recheck a listing, confirm it against its source page again, update its
`last_checked_on` (and anything that changed) in the dataset file, and re-import.
The window is 90 days because a fee or eligibility rule set by a public facility
can change with each budget or scheme order. Rechecking each quarter keeps a stale
"Free" from staying visible longer than that.

## Dataset format

The dataset is one UTF-8 JSON file (`"format": "medassist-consultation-pilot/1"`).
`backend/app/consultation_pilot.py` validates it in full before any database work.

```json
{
  "format": "medassist-consultation-pilot/1",
  "source": {
    "id": "stable-source-id",
    "kind": "reviewed_external",
    "name": "…", "version": "…",
    "url": "https://… (the source's home or dataset page)",
    "publisher": "who publishes it",
    "locality": "the one locality the pilot covers",
    "reuse_basis": "the licence or written permission relied on",
    "reuse_basis_url": "https://… (the licence or permission text)"
  },
  "listings": [
    {
      "id": "stable-listing-id",
      "provider_name": "…", "provider_type": "clinic | hospital_outpatient | teleconsultation | community_camp",
      "specialty": "…", "area": "…", "modes": ["in_person", "video", "phone"],
      "fee": {"state": "known", "amount_inr": 10, "basis": "what the source says"},
      "access_conditions": "eligibility, or null",
      "languages": ["…"], "hours": "… or null", "notes": "… or null",
      "source_url": "https://… (the page this listing was checked against)",
      "last_checked_on": "YYYY-MM-DD"
    }
  ]
}
```

The rules:

- **Fee:** `known` needs a positive `amount_inr` and a `basis`. `free` needs a
  `basis` (what the source says) and no amount. `unknown` has neither and is shown
  as **Fee not listed**.
- **IDs:** listing IDs are lowercase and stable (`[a-z0-9-]`, at most 64 characters).
  A file can hold 1–200 unique IDs.
- **URLs:** all URLs are `https://` with no credentials. Check dates cannot be in
  the future.
- **Kinds:** `kind: "pilot_fixture"` is for fictional test data only. Every URL must
  be on `example.org`, `example.com` or `example.net`, and every name must say
  "(fictional)". A `reviewed_external` file may not use those domains. PostgreSQL
  CHECK constraints enforce the same split, so fixture data cannot pass for
  reviewed data.

## Import

```powershell
cd backend
$env:MEDASSIST_DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@localhost:5432/medassist"
.\.venv\Scripts\python.exe -m app.import_consultations app\fixtures\consultation_pilot_fixture.json
```

The importer runs in **one transaction** under a PostgreSQL advisory lock, so two
imports never interleave. It takes these steps:

1. It creates or updates the source row. A source can never change kind.
2. It removes this source's listings that are no longer in the file.
3. It inserts or updates every listing by its stable ID. An ID that already belongs
   to another source stops the import.
4. It records the import (file SHA-256, time and listing count) as the last step.

Importing the same file twice leaves the same rows and IDs. The second run reports
`0 new, 6 updated, 0 removed`. If any step fails, everything rolls back: the
previous dataset, its check dates and its import record stay exactly as they were.
Exit codes:

| Code | Meaning |
| --- | --- |
| `0` | Imported. |
| `1` | Refused or rolled back. "Import refused, nothing changed." covers an invalid file or an ID clash; "Import failed and was rolled back" covers a database error. |
| `2` | Usage error, or `MEDASSIST_DATABASE_URL` is not set. |

`backend/tests/fixtures/consultation_pilot_id_clash.json` is a valid file that is
designed to fail inside the database: it reuses the demo ID `c-01`. CI uses it to
prove the rollback.

## The fictional fixture

Judged on 2026-11-13 with the 90-day window:

| ID | Case | Screen |
| --- | --- | --- |
| `fx-civil-opd` | known fee, checked 2026-11-02 | ₹10 (fixture), eligibility beside it |
| `fx-wellness-free` | free with eligibility, checked 2026-11-02 | Free (fixture), "Free for residents of Ward 4 …" |
| `fx-tele-unknown` | no price at the source | Fee not listed (fixture) |
| `fx-skin-clinic` | known fee, video and in person | ₹250 (fixture) |
| `fx-child-camp` | free, but checked 2026-06-01 (stale) | Needs recheck, no Free label |
| `fx-ent-opd` | known fee, checked 2026-07-01 (stale) | ₹50 (fixture) with a Needs recheck badge |

`frontend/tests/e2e/fixtures/consultations-pilot.json` is the API page for this
fixture. A PostgreSQL test (`test_the_pilot_output_matches_the_frontend_pilot_capture`)
keeps the file identical to real API output, apart from the import time.

## Candidate source and what still needs review

These are candidates found by desk research on 2026-11-13. None is approved, and
nothing from them has been imported.

1. **National Hospital Directory with Geo Code** (published by the National
   Institute of Health and Family Welfare through the Open Government Data platform):
   [data.gov.in catalogue](https://data.gov.in/catalog/hospital-directory-national-health-portal),
   [AIKosh listing](https://aikosh.indiaai.gov.in/home/datasets/details/national_hospital_directory_with_geo_code_and_additional_parameters_updated_till_last_month.html).
   The AIKosh listing names the Government Open Data License – India (GODL), which
   would give a written reuse basis. It lists name, address, locality, pin code,
   category, contact details and specialties. Things to review:
   - **Licence:** the exact GODL attribution wording, and whether it covers showing
     the records inside MedAssist. The data.gov.in catalogue page itself shows no
     licence or date.
   - **Currency:** AIKosh shows conflicting dates ("updated 11 Aug 2026" and
     "10/08/17"). The OpenStreetMap import notes describe the data as published on
     10 August 2017 ([OSM wiki](https://wiki.openstreetmap.org/wiki/India_Health_Facilities_Import)).
     Every record would need a fresh check against a current page.
   - **Fees:** the directory has no fee or eligibility fields. Without a per-listing
     official page that states the fee, every listing would show "Fee not listed".
2. **ABDM Health Facility Registry** ([facility.abdm.gov.in](https://facility.abdm.gov.in)),
   the current national registry of facilities. Its home page states no terms of use
   or data reuse basis and lists no fee fields, so the reuse basis would need
   confirming with the National Health Authority.
3. For a **verified free option**, the national eSanjeevani OPD teleconsultation
   service run by the Ministry of Health and Family Welfare is widely described as
   free, for example in
   [Delhi Health Department's poster](https://health.delhi.gov.in/sites/default/files/Health/circulars-orders/poster_esanjeevni.pdf).
   Its current official page still needs to be read for the exact "free" wording,
   eligibility (such as a mobile number), hours and reuse terms.

Before any real record is imported, the project owner needs to:

- choose **one locality** (a district or city) and **one approved source** for it;
- record that source's **reuse basis** (licence text or written permission) and its URL;
- for each listing, open the official page and record its URL, the date checked,
  the provider, specialty, area, modes, the fee exactly as stated (or unknown) and
  any eligibility conditions;
- mark a fee as **free only if the page explicitly says so**, quoting the basis;
- set `kind` to `reviewed_external`, and keep `example.*` URLs and "(fictional)" names out;
- have a second person compare each record with its source page before importing.

## Turning the pilot on locally (Windows)

1. Set up PostgreSQL, migrate and seed as described in the root
   [Readme](../Readme.md#set-up-the-consultation-directory). `alembic upgrade head`
   now reaches revision `0003`.
2. Import the fixture twice and check that the count stays at 6:

   ```powershell
   cd backend
   $env:MEDASSIST_DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@localhost:5432/medassist"
   $env:MEDASSIST_PILOT_AS_OF = "2026-11-13"
   .\.venv\Scripts\python.exe -m app.import_consultations app\fixtures\consultation_pilot_fixture.json
   .\.venv\Scripts\python.exe -m app.import_consultations app\fixtures\consultation_pilot_fixture.json
   psql -U postgres -d medassist -c "SELECT count(*), string_agg(id, ',' ORDER BY id) FROM consultation_listings WHERE source_kind = 'pilot_fixture'"
   ```

3. Try the failing file. It exits with code 1, and the count, IDs and dates are unchanged:

   ```powershell
   .\.venv\Scripts\python.exe -m app.import_consultations tests\fixtures\consultation_pilot_id_clash.json
   $LASTEXITCODE
   ```

4. Start the API with the pilot **off**, then open
   <http://127.0.0.1:5173/app/patient/consultations>. It shows the nine fictional
   demo listings with a "Fictional demo" badge.
   `curl.exe -s -o NUL -w "%{http_code}" "http://127.0.0.1:8000/api/v1/consultations?dataset=pilot"`
   prints `404`.
5. Stop the API (Ctrl+C), then turn the pilot on and restart it:

   ```powershell
   $env:MEDASSIST_CONSULTATION_PILOT = "on"
   $env:MEDASSIST_PILOT_AS_OF = "2026-11-13"
   .\.venv\Scripts\python.exe -m uvicorn app.main:app
   ```

6. Reload Find Consultations. Six fixture listings appear under "Pilot · fictional
   fixture". The Health and Wellness Centre shows Free with its Ward 4 condition, and
   the Child Health Camp shows **Needs recheck** with no Free label. Choose
   **Details** on a listing to see **Open the source page** and the last-checked
   date. Compare three listings, then narrow the window to a phone width in the
   browser's device toolbar.
7. To switch the pilot off again, close the terminal or run
   `Remove-Item Env:MEDASSIST_CONSULTATION_PILOT`, then restart the API.

## From import to browser

| Step | File |
| --- | --- |
| Dataset file and its rules | `backend/app/fixtures/consultation_pilot_fixture.json`, `backend/app/consultation_pilot.py` |
| Import command (transaction, lock, upserts, import record) | `backend/app/import_consultations.py` |
| Tables and constraints | `backend/migrations/versions/0003_consultation_pilot.py`, `backend/app/models.py` |
| Settings (on/off, window, as-of date) | `backend/app/config.py`, read once in `backend/app/main.py` |
| Query, freshness and Free suppression | `backend/app/consultations.py`, response models in `backend/app/schemas.py` |
| Browser client and response validation | `frontend/src/services/api/consultations.ts` |
| Labels (fee, check date, eligibility row) | `frontend/src/features/consultations/listing.ts` |
| Screen (source bar, badges, details, comparison) | `frontend/src/features/consultations/Consultations.tsx` |
| Tests | `backend/tests/test_consultation_pilot.py`, `backend/tests/test_consultation_pilot_db.py`, `frontend/src/**/consultations*.test.ts(x)`, `frontend/src/features/consultations/listing.test.ts`, `frontend/tests/e2e/consultations-pilot-api.spec.ts`, `frontend/tests/fullstack/consultation-pilot.fullstack.spec.ts`, `.github/workflows/health-profile-fullstack.yml` |
