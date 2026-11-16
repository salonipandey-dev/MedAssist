# Release candidate and demo readiness (MA-07)

This is the setup, the checks and the demo script for the MedAssist release
candidate. Everything shown is fictional: the nine consultation listings, the two
patient accounts, the medicines and the medication rules. MedAssist gives no
diagnosis and no prescription, and nothing can be booked.

## Which build

- **Base:** `715706a` on `main`, which contains MA-03 (#10), MA-04 (#11), MA-05 (#12)
  and MA-06 (#13). No pull request was pending when the candidate was chosen.
- **Release candidate:** the head of `chore/release-candidate`. It changes no
  application code. It adds this document and release-candidate checks to the
  full-stack workflow. The pull request lists the exact commit and its CI results.

## Clean setup on Windows (PowerShell)

You need Python 3.10 or later, Node.js 22, PostgreSQL 16 or 17 and Git. Replace
`YOUR_PASSWORD` with your local PostgreSQL password. If it contains `@`, `:` or `/`,
percent-encode it in the URLs. The variables last only for the terminal they are
set in, so keep both terminals open.

### Terminal 1: database and API

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt

$env:PGPASSWORD = "YOUR_PASSWORD"
psql -U postgres -c "DROP DATABASE IF EXISTS medassist_rc"
psql -U postgres -c "CREATE DATABASE medassist_rc"

$env:MEDASSIST_DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@localhost:5432/medassist_rc"
$env:MEDASSIST_CORS_ORIGINS = "http://127.0.0.1:4173"
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic current
```

`alembic current` prints `0003 (head)`. Now run the fictional seed twice and count
the rows. The count is `9|1` both times:

```powershell
.\.venv\Scripts\python.exe -m app.seed
psql -U postgres -d medassist_rc -Atc "SELECT (SELECT count(*) FROM consultation_listings), (SELECT count(*) FROM consultation_sources)"
.\.venv\Scripts\python.exe -m app.seed
psql -U postgres -d medassist_rc -Atc "SELECT (SELECT count(*) FROM consultation_listings), (SELECT count(*) FROM consultation_sources)"
```

Create the two fictional patients, then start the API. Run the account command
only on a local demo or test database: its passwords are public.

```powershell
$env:MEDASSIST_ALLOW_DEMO_ACCOUNTS = "1"
.\.venv\Scripts\python.exe -m app.seed_demo_accounts
Remove-Item Env:MEDASSIST_ALLOW_DEMO_ACCOUNTS
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

| Account | Email | Password |
| --- | --- | --- |
| Patient A (fictional) | `patient.a@example.test` | `MedAssist-Demo-A-2026` |
| Patient B (fictional) | `patient.b@example.test` | `MedAssist-Demo-B-2026` |

### Terminal 2: production React build

```powershell
cd frontend
npm.cmd ci
$env:VITE_API_BASE_URL = "http://127.0.0.1:8000"
npm.cmd run build
npm.cmd run preview -- --port 4173 --strictPort
```

Open **<http://127.0.0.1:4173>**. Use `127.0.0.1`, not `localhost`: the API allows
only the origin in `MEDASSIST_CORS_ORIGINS`, and the sign-in cookie needs the page
and the API on the same host. The API address is compiled into the build, so
rebuild if you change `VITE_API_BASE_URL`.

### Terminal 3: system checks

```powershell
curl.exe -s http://127.0.0.1:8000/health
curl.exe -s -I http://127.0.0.1:8000/health
```

The first prints `{"status":"ok","service":"medassist-api","version":"0.1.0"}`. The
second prints `HTTP/1.1 200 OK` with `cache-control: no-store` and no body.

## Check the journeys by hand

### 1. Consultations (<http://127.0.0.1:4173/app/patient/consultations>)

1. Press F12, turn on the device toolbar and set the width to 375.
2. Nine listings appear under the badges "Directory API" and "Fictional demo".
3. Search `sample city` (7 listings). Set Specialty to **General practice** (2), then
   Fee to **Free (illustrative)** (1: Sample Community Health Camp).
4. Clear the search and set both filters back to **All specialties** and **Any**.
5. Choose **Compare** on Riverside Family Clinic, Lakeview Teleconsult and Sample
   Community Health Camp. The comparison table shows three columns.
6. Choose **Compare** on Northgate Hospital Outpatients. The message "You can compare
   up to 3 options. Remove one to add another." appears on that listing.
7. In Terminal 1 press Ctrl+C to stop the API. Type `skin` in the search box. The
   screen shows **Could not reach the directory API** with a **Retry** button.
8. Start the API again (the last command of Terminal 1) and choose **Retry**. Meadow
   Skin Clinic appears.

The pilot is **off by default**, which is why step 2 shows "Fictional demo". To see
source links, check dates, "Fee not listed" and "Needs recheck" with the fictional
fixture, follow [Consultation pilot](CONSULTATION_PILOT.md#turning-the-pilot-on-locally-windows),
using the `medassist_rc` database and port 4173.

### 2. Health Profile (<http://127.0.0.1:4173/app/patient/health-profile>)

1. Sign in as Patient A.
2. Under Current medicines choose **I take medicines** and add
   `Brivanol 250 tablets` and `Coldaway Day Relief`. Choose **No known allergies** and
   **No conditions to list**. Choose **Save health profile**. A "Saved" message appears.
3. Press F5. The two medicines are still there.
4. Stop the API with Ctrl+C in Terminal 1, start it again, and press F5. You are still
   signed in and the profile is unchanged.
5. Open an InPrivate or Incognito window, go to the same address and sign in as
   Patient B. Only B's profile appears (Velorin), with none of A's entries.
6. Back in the first window choose **Sign out**. The page shows "You have signed out"
   with no profile fields.

### 3. Medication Info (<http://127.0.0.1:4173/app/patient/medications>)

1. Sign in as Patient A and choose **Check my saved profile**. The result is
   **1 demo rule matched**: "Same ingredient in two recorded medicines" (brivanol),
   rule `DEMO-DUP-001`.
2. Choose **Open Health Profile**, remove medicine 2, and save.
3. Run the check again. The result is **No matching demo rules**. This means only that
   no fictional rule matched; it is not a statement that anything is safe.
4. In the InPrivate window, run the check as Patient B. The result is **More
   information needed**, with "Conditions: not recorded".

To rehearse again from the start, reset both fictional profiles (this also signs
both accounts out):

```powershell
$env:MEDASSIST_ALLOW_DEMO_ACCOUNTS = "1"
.\.venv\Scripts\python.exe -m app.seed_demo_accounts --reset-profiles
Remove-Item Env:MEDASSIST_ALLOW_DEMO_ACCOUNTS
```

## Automated checks

From `backend`, with a **separate** test database. The suite drops and recreates
its tables, so never point it at `medassist_rc`:

```powershell
psql -U postgres -c "CREATE DATABASE medassist_rc_test"
$env:MEDASSIST_TEST_DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@localhost:5432/medassist_rc_test"
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

From `frontend` (these use a mocked API and need no database):

```powershell
npm.cmd run format:check
npm.cmd run build
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

GitHub Actions runs the same checks on every pull request, plus the full-stack
workflow (`.github/workflows/health-profile-fullstack.yml`). That workflow runs the
journeys above in Chromium against real PostgreSQL and FastAPI with nothing mocked:

| Journey | Where it is automated |
| --- | --- |
| Second seed creates no duplicates; `GET` and `HEAD /health` | Workflow steps of the same names |
| Consultations at 375px: search, combined filters, compare three, fourth message, API stopped and Retry | `frontend/tests/fullstack/release-candidate.fullstack.spec.ts` |
| Pilot off by default; pilot fixture source, freshness and fee labels | `frontend/tests/fullstack/consultation-pilot.fullstack.spec.ts` |
| Profile save, refresh, FastAPI restart, Patient B isolation, sign-out | `frontend/tests/fullstack/health-profile.fullstack.spec.ts` (phases 1–3) |
| Shared-ingredient warning, remove and rerun, incomplete information | Same file, phase 4 |

## Three-minute demo script

Before the audience arrives: both terminals running, profiles reset with
`--reset-profiles`, the browser at <http://127.0.0.1:4173> and an InPrivate window
ready. Set the browser zoom so the back row can read it.

| Time | Do | Say |
| --- | --- | --- |
| 0:00 | Show the home page, then open **Find Consultations**. | "MedAssist helps a patient find affordable consultation options and notice medication risks. It does not diagnose or prescribe, and every record you will see is fictional." |
| 0:20 | Search `sample city`, set Specialty **General practice**, Fee **Free (illustrative)**. | "The React screen sends each search and filter to a FastAPI service, which queries PostgreSQL. Fees are labelled illustrative, and a missing fee says so instead of guessing." |
| 0:45 | Clear the filters. Compare three listings, then try a fourth. | "A patient can compare up to three options side by side. The fourth is refused with a clear message." |
| 1:10 | Open **Health Profile** and sign in as Patient A. Add `Brivanol 250 tablets` and `Coldaway Day Relief`, choose no allergies and no conditions, and save. Press F5. | "Profiles are private. Sign-in uses a hashed password and a secure session cookie. The profile is stored in PostgreSQL, so it survives a refresh and a server restart." |
| 1:45 | In the InPrivate window sign in as Patient B and show B's profile. | "A second patient sees only their own profile. The server takes the account from the session and never from the request, so one patient cannot read another's data." |
| 2:05 | Back as Patient A, open **Medication Info** and choose **Check my saved profile**. | "The check reads the saved profile on the server. These two fictional medicines share an ingredient, so a demo rule flags it and shows which rule matched." |
| 2:30 | Open Health Profile, remove the second medicine, save, and run the check again. | "After removing one medicine, no rule matches. The screen says only that no demo rule matched. It never says a combination is safe, and with missing information it says more information is needed." |
| 2:45 | Choose **Sign out**. | "Signing out clears the private screen. The project has automated tests at three levels: backend tests on PostgreSQL, frontend unit tests, and browser tests of these same journeys. A real launch would need a licensed medicine reference and clinical review, which is outside this project." |

If something goes wrong during the demo: for "Could not reach the directory API",
check that Terminal 1 is still running and choose **Retry**. If sign-in fails, check
that the address bar says `127.0.0.1:4173`.
