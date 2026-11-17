# Reviewed consultation listings for Mathura

This is the first real dataset for the [consultation pilot](CONSULTATION_PILOT.md). It
holds **seven consultation options that a patient in Mathura, Uttar Pradesh can use**,
recorded by hand from official pages on **17 November 2026**. With the pilot on, Find
Consultations shows each one with its source, check date, fee and eligibility.

MedAssist does not book, triage or recommend. Every listing says what its source said
on the day it was checked; the patient confirms with the provider before relying on it.

## What a patient can find

| Listing ID | Service | Where it happens | Mode | Fee shown | Eligibility and access |
| --- | --- | --- | --- | --- | --- |
| `mathura-esj-up-general-opd` | eSanjeevani OPD: Uttar Pradesh General OPD | Online, from home | Video | **Free** | Register with a mobile number; device with camera and internet; ABHA ID requested. Mon–Sat 9:00–17:00 |
| `mathura-esj-up-gmc-paediatrics` | eSanjeevani OPD: Government Medical Colleges (U.P.) Paediatrics | Online, from home | Video | **Free** | As above. Mon–Sat 9:00–14:00 |
| `mathura-esj-up-gmc-dermatology` | … Dermatology | Online, from home | Video | **Free** | As above. Mon–Sat 9:00–14:00 |
| `mathura-esj-up-gmc-obstetrics-gynaecology` | … Obstetrics and Gynaecology | Online, from home | Video | **Free** | As above. Mon–Sat 9:00–14:00 |
| `mathura-esj-up-gmc-psychiatry` | … Psychiatry | Online, from home | Video | **Free** | As above. Mon–Sat 9:00–14:00 |
| `mathura-tele-manas-helpline` | Tele MANAS mental health helpline | National phone line | Phone, video | **Fee not listed** | Anyone with a mental health concern, family, or ASHAs calling for someone. Not an emergency service |
| `mathura-esic-dispensary-sadar` | ESI Dispensary, Mathura | Badhpura, Sadar, Mathura | In person | **Free** | Only ESI insured persons and their families (retired/disabled insured persons and spouses: ₹600 a year) |

Six options are online or by phone and one is in person in Mathura city. The table says
so on every card ("Online video OPD … used from home in Mathura", "National phone
helpline, callable from Mathura"), so nobody mistakes a teleconsultation for a local clinic.

**Unknown on purpose** (shown as *Not listed* or *Fee not listed* until a source states it):
Tele MANAS hours and fee; ESI dispensary hours and services; languages for every listing.
No phone number, availability or booking is shown for any listing.

## Sources, evidence and reuse basis

Each source is its own file in `backend/app/datasets/mathura/`, so each keeps its own
publisher, version and reuse basis.

| File (source ID) | Pages checked on 2026-11-17 | What they support |
| --- | --- | --- |
| `esanjeevani-up.json` (`mathura-esanjeevani-up`) | [OPD Timings](https://esanjeevani.mohfw.gov.in/#/opd-timing) → Uttar Pradesh; [FAQs](https://esanjeevani.mohfw.gov.in/#/faq); [home](https://esanjeevani.mohfw.gov.in/) | UP State General OPD Mon–Sat 9 AM–5 PM; Government Medical Colleges (U.P.) speciality OPDs Mon–Sat 9 AM–2 PM. FAQ 1: "No, you don't have to pay anything to anybody for using National Telemedicine Service." FAQ 7–8: device with camera and internet; Patient ID linked to the mobile number. Home banner: provide an ABHA ID in all consultations |
| `tele-manas.json` (`mathura-tele-manas`) | [home](https://telemanas.mohfw.gov.in/home); [FAQs](https://telemanas.mohfw.gov.in/faq) | Toll-free numbers 14416 and 1-800 891 4416. FAQ 4: tele-counselling and tele-consultation. FAQ 5: who can call. FAQ 9: emergencies need hospital doctors. FAQ 10: video consultations with e-prescriptions. **No fee statement**, so the fee stays unknown: a toll-free call is not the same as a free consultation |
| `esic.json` (`mathura-esic`) | [Dispensary directory](https://esic.gov.in/dispensaries) (Uttar Pradesh, entry 73); [Benefits](https://esic.gov.in/information-benefits) (reviewed 2026-10-09); [Copyright Policy](https://esic.gov.in/copyright-policy) | "ESI Dispensary, Mathura, Badhpura Sadar Mathura". Benefits page: Medical Benefit is free medical care for insured persons and their families from the first day of insurable employment; retired and permanently disabled insured persons and spouses pay ₹600 a year |

**Reuse basis.** None of these sites publishes an open licence for its content.

- **ESIC**: the Copyright Policy (reviewed 2024-07-01) forbids reproducing its contents
  without permission and asks any website that refers to them to acknowledge the source.
- **eSanjeevani**: the footer reads "© 2026 eSanjeevani. All rights reserved." The
  Website Policy file linked from the home page could not be opened on 2026-11-17.
- **Tele MANAS**: the home and FAQ pages link only a Privacy Policy.

So every file records the same basis: **facts and a link, with credit**. MedAssist copies
no text, images or logos. It states a few facts in its own words (service name, published
OPD days and hours, who may use it, what the page says about payment), links to the page
each fact came from and names the publisher. The only quoted words are the short
eSanjeevani FAQ sentence that the Free label rests on. Each listing's details dialog shows
the source, publisher, version, a link to the source page, the reuse basis and, for ESIC,
a link to its copyright policy. **The project owner should accept this basis** (or obtain
written permission) before showing the listings outside a local demonstration.

**Considered and left out**

- *Ramakrishna Mission Sevashrama Charitable Hospital, Vrindavan* publishes department pages
  and an online consultation booking charge (₹200 general, ₹300 super specialty, no currency
  symbol shown). Its Terms & Conditions forbid copying and also forbid using its name
  when linking to the site without permission, and warn about the Emblems and Names Act.
  It is left out until written permission is obtained (hospital@rkmsvrind.org).
- *District hospitals and PHCs/CHCs in Mathura*: no official page reachable on 2026-11-17
  states their OPD fee, hours or eligibility. The Mathura district website lists only private
  hospitals, mostly without details. PM-JAY and ABDM registries were not checked because the
  hospital search could not be opened in this session; they also carry no fee fields.
- *eSanjeevani CGHS and ESIC specialist OPDs*: CGHS OPDs need a CGHS beneficiary card;
  the ESIC OPDs listed for Uttar Pradesh are run from other cities. Left out to keep the set small.

## Turn the pilot on with these listings (Windows)

Use a database you can reset, set up as in the root [Readme](../Readme.md#set-up-the-consultation-directory)
(`alembic upgrade head`, then `python -m app.seed`). In PowerShell, from `backend`:

```powershell
$env:MEDASSIST_DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@localhost:5432/medassist"

# Only if you imported the fictional fixture before: the pilot shows every pilot source,
# so remove the fixture first or the page is labelled "Pilot · fictional fixture".
psql -U postgres -d medassist -c "DELETE FROM consultation_listings WHERE source_kind = 'pilot_fixture'" -c "DELETE FROM consultation_sources WHERE kind = 'pilot_fixture'"

Get-ChildItem app\datasets\mathura\*.json | ForEach-Object {
  .\.venv\Scripts\python.exe -m app.import_consultations $_.FullName
}
psql -U postgres -d medassist -c "SELECT id, version, listing_count FROM consultation_sources WHERE kind = 'reviewed_external' ORDER BY id"

$env:MEDASSIST_CONSULTATION_PILOT = "on"
.\.venv\Scripts\python.exe -m uvicorn app.main:app
```

Each import prints `Imported N listings from <source> (reviewed): …`. Running the loop a
second time prints `0 new, N updated, 0 removed` for each file and changes nothing.
Leave `MEDASSIST_PILOT_AS_OF` unset so freshness is judged on today's date in India.

In another terminal start the frontend with `VITE_API_BASE_URL=http://127.0.0.1:8000`
(see the Readme) and open <http://127.0.0.1:5173/app/patient/consultations>. The source bar
reads "Pilot · Pilot listings for Mathura, Uttar Pradesh from 3 sources: …". Each card shows
its fee, eligibility, source and check date; **Details** opens the source link and reuse basis.
To switch the pilot off, run `Remove-Item Env:MEDASSIST_CONSULTATION_PILOT` and restart the API.

## Recheck and update the records

The freshness window is 90 days. Checks made on 2026-11-17 stay current **through
2027-02-15**. From 2027-02-16 every listing shows **Needs recheck**, the six Free labels
are hidden (the fee reads *Needs recheck*) and the Free filter returns nothing. Recheck
each quarter, or sooner if a source page changes.

1. **Open each page** in the evidence table above. For eSanjeevani, open *OPD Timings*,
   expand **Uttar Pradesh**, and read FAQ 1 and 7–8. For ESIC, choose *Uttar Pradesh* in the
   dispensary search and find the Mathura entry; reopen the Benefits and Copyright pages.
2. **Compare field by field**: provider name, area, modes, hours, the fee wording and the
   eligibility. Change only what the page now says. If a page no longer states something,
   set it to `null` (or the fee to `{"state": "unknown"}`); never keep an old value.
3. **Keep Free honest**: `"state": "free"` only with the page's words in `basis` and any
   condition in `access_conditions`. A toll-free number is not a free consultation.
4. **Re-read the terms** (copyright or website policy). If they now forbid even facts and
   links, remove that source's listings (delete the listing from the file; the importer
   removes it) and record why in this document.
5. **Update the dates**: set every rechecked listing's `last_checked_on` and the file's
   `source.version` to the check date. Keep every `id` unchanged; a new service gets a new
   `mathura-…` ID.
6. **Validate and import**: run `python -m unittest tests.test_consultation_mathura -v`
   (update the expected values there for the change), then the import loop above. A file
   that fails validation or clashes changes nothing.
7. **Second person check**: have someone compare each changed record with its page before
   you push. Update the evidence table and the capture
   (`frontend/tests/e2e/fixtures/consultations-mathura.json`); the PostgreSQL test
   `test_the_output_matches_the_frontend_capture` fails until the capture matches.

## From the dataset to the browser

| Step | File |
| --- | --- |
| Reviewed records, one file per source | `backend/app/datasets/mathura/esanjeevani-up.json`, `tele-manas.json`, `esic.json` |
| File rules (fee states, HTTPS, no `example.*`, no future dates) | `backend/app/consultation_pilot.py` |
| Import: validate, one transaction, advisory lock, upsert by ID, import record | `backend/app/import_consultations.py` |
| Tables and CHECK constraints (`consultation_sources`, `consultation_listings`) | `backend/app/models.py`, `backend/migrations/versions/0003_consultation_pilot.py` |
| Pilot switch, freshness window, "today" | `backend/app/config.py` (`MEDASSIST_CONSULTATION_PILOT`, `MEDASSIST_PILOT_FRESHNESS_DAYS`, `MEDASSIST_PILOT_AS_OF`) |
| Query, filters, freshness and Free suppression in SQL, JSON response | `backend/app/consultations.py`, `backend/app/schemas.py` |
| Browser request and Zod validation of every listing | `frontend/src/services/api/consultations.ts` |
| Fee, check-date and source labels | `frontend/src/features/consultations/listing.ts` |
| Source bar, cards, details dialog, comparison | `frontend/src/features/consultations/Consultations.tsx` |
| Tests | `backend/tests/test_consultation_mathura.py` (file rules), `backend/tests/test_consultation_mathura_db.py` (PostgreSQL import, rollback, API, capture), `frontend/src/features/consultations/*.test.ts(x)`, `frontend/tests/fullstack/consultation-mathura.fullstack.spec.ts`, phase 7 of `.github/workflows/health-profile-fullstack.yml` |
| Invalid update used to prove rollback | `backend/tests/fixtures/consultation_mathura_id_clash.json` (changes a real row, then reuses the demo ID `c-01`) |
