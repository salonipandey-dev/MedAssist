# Sign-in and private health profiles (MA-04)

A signed-in patient can record current medicines, allergies and health conditions in
their own profile. The profile is stored in PostgreSQL, so it survives a browser reload
and a FastAPI restart. Only fictional demo accounts exist, and MedAssist never analyses,
checks or interprets what is entered.

The screens are `/sign-in` and `/app/patient/health-profile`. Both need the frontend
to be built with `VITE_API_BASE_URL`. Without it they explain that the API is not
connected and send no request.

## How a request is trusted

| Concern | What the API does |
| --- | --- |
| Passwords | Hashed with Argon2id (`argon2-cffi`, RFC 9106 low-memory parameters). Hashes are refreshed on sign-in if the parameters change. An unknown email is checked against a throwaway hash, so both refusals look and take the same. |
| Sessions | A random 256-bit token in a cookie. The database keeps only its SHA-256 digest. A session ends after 30 idle minutes (`MEDASSIST_SESSION_IDLE_MINUTES`), 8 hours after sign-in (`MEDASSIST_SESSION_MAX_HOURS`), or at sign-out, and can never be used again. Signing in ends any session the browser already had. |
| Cookie | `medassist_session`, `HttpOnly`, `SameSite=Strict`, `Path=/api/v1`, `Max-Age` equal to the maximum session length. `Secure` is added on HTTPS requests, or always when `MEDASSIST_COOKIE_SECURE=true` (an API behind a TLS-terminating proxy). |
| CSRF | Writes (`POST`, `PUT`) must come from the API's own origin or an origin in `MEDASSIST_CORS_ORIGINS`, must be JSON, and, when a session exists, must carry its CSRF token in `X-CSRF-Token`. The token comes from the session response and is held in page memory. |
| Ownership | No route takes an account or profile ID. The owner is the session's account, and every read and write is filtered by it. Owner-like body fields (`account_id`, `profile_id`, `owner_id`, `patient_id`, `user_id`, `email`, `owner`) and any query parameter are refused. |
| Caching | Every response under `/api/v1/auth` and `/api/v1/me`, including errors, has `Cache-Control: no-store`. |
| Logs | No password, token, email or profile entry is logged. Validation errors on these routes never echo submitted values. SQLAlchemy is created with `hide_parameters=True`, so bound values stay out of its log lines and error messages. |
| CORS | Only the exact origins in `MEDASSIST_CORS_ORIGINS` may send the cookie (`allow_credentials`). Allowed methods are `GET`, `HEAD`, `POST` and `PUT`; allowed request headers are `Content-Type` and `X-CSRF-Token`. |

`SameSite=Strict` means the frontend and the API must be on the same site. Use the
same host name for both, for example `http://127.0.0.1:4173` and
`http://127.0.0.1:8000`. Mixing `localhost` and `127.0.0.1` makes them different
sites, so the browser will not send the cookie.

Not built yet: rate limiting of sign-in attempts, account registration, password
reset, and roles other than patient.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/auth/sign-in` | `{"email", "password"}` → `200` session and `Set-Cookie` |
| GET | `/api/v1/auth/session` | The signed-in account and CSRF token, for a page that has just loaded |
| POST | `/api/v1/auth/sign-out` | End the session (needs `X-CSRF-Token`) → `204` and the cookie cleared |
| GET | `/api/v1/me/health-profile` | Your own profile |
| PUT | `/api/v1/me/health-profile` | Replace your own profile (needs `X-CSRF-Token`) |

Session response:

```json
{
  "account": {"display_name": "Patient A (fictional)", "email": "patient.a@example.test", "role": "patient"},
  "csrf_token": "…",
  "expires_at": "2026-11-12T19:40:00Z",
  "idle_expires_at": "2026-11-12T12:10:00Z"
}
```

## Profile body

`GET` returns this shape; `PUT` sends the same without `updated_at`.

```json
{
  "version": 3,
  "updated_at": "2026-11-12T11:40:00Z",
  "medicines": {"state": "recorded", "entries": [{"name": "Tarvexol (fictional)", "note": "With breakfast"}]},
  "allergies": {"state": "none", "entries": []},
  "conditions": {"state": "not_recorded", "entries": []}
}
```

| `state` | Meaning | `entries` |
| --- | --- | --- |
| `not_recorded` | Nothing has been said yet. Not enough information. | always empty |
| `none` | The patient has said there is nothing to list. | always empty |
| `recorded` | The entries follow. | 1 to 30 |

Each entry has a `name` of 1–120 characters and an optional `note` of up to 300
characters. Both are single lines and are trimmed. A blank note becomes `null`. A
name can appear only once per section, ignoring case. A profile never saved is
returned as version `0` with every section `not_recorded`.

`PUT` replaces all three sections in one transaction. Send the `version` you loaded.
If it is no longer current, nothing is saved and the API answers `409`:

```json
{"detail": "This profile was changed somewhere else …", "code": "version_conflict", "current_version": 4}
```

## Errors

Every error body has a `detail` that is safe to show and a stable `code`.

| Status | `code` | When |
| --- | --- | --- |
| 400 | `unexpected_parameter` | A query parameter was sent to `/api/v1/auth/*` or `/api/v1/me/*` |
| 401 | `not_signed_in` | No session cookie |
| 401 | `session_expired` | The cookie names an ended, revoked or unknown session; the cookie is cleared |
| 401 | `invalid_credentials` | Sign-in with a wrong email or password |
| 403 | `csrf_failed` | Missing or wrong `X-CSRF-Token` |
| 403 | `origin_not_allowed` | A write from an origin that is not allowed |
| 409 | `version_conflict` | A stale profile version |
| 415 | `unsupported_media_type` | A write that is not `application/json` |
| 422 | `invalid_input` | `detail` is a list of `{"loc", "msg", "type"}` without the submitted values |
| 503 | `service_unavailable` | PostgreSQL is unreachable, not migrated or not configured; includes `request_id` |

## Tables (migration `0002`)

- `accounts`: email (stored lower-case, unique), display name, role (`patient` only)
  and an Argon2id hash. A CHECK refuses anything that is not an `$argon2id$` hash.
- `auth_sessions`: account, token digest, CSRF token, created, last seen, idle expiry,
  absolute expiry and revocation time.
- `health_profiles`: one row per account, keyed by the account ID, with `version` and
  the three section states.
- `health_profile_entries`: section, position, name and note, with unique positions
  and unique case-insensitive names per section.

The upgrade does not touch the consultation tables. It runs the same way on an empty
database and on one that already holds the seeded directory, and the downgrade drops
only these four tables.

## Fictional demo accounts

```bash
MEDASSIST_ALLOW_DEMO_ACCOUNTS=1 python -m app.seed_demo_accounts [--reset-profiles]
```

| Account | Email | Password | Starting profile |
| --- | --- | --- | --- |
| Patient A (fictional) | `patient.a@example.test` | `MedAssist-Demo-A-2026` | None saved, so the empty state shows |
| Patient B (fictional) | `patient.b@example.test` | `MedAssist-Demo-B-2026` | One invented medicine, allergies "none", conditions not recorded |

These passwords are published here, so the command refuses to run unless
`MEDASSIST_ALLOW_DEMO_ACCOUNTS=1` is set. Use it only on a local development or test
database. Re-running it refreshes the accounts and leaves saved profiles alone.
`--reset-profiles` restores both starting profiles and ends both accounts' sessions.

## Windows walkthrough: two accounts

This assumes PostgreSQL is installed, the `medassist` database exists and the backend
virtual environment is set up as in the [README](../Readme.md#set-up-the-consultation-directory).
Replace `YOUR_PASSWORD`.

**Terminal 1, backend** (from `backend`):

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
$env:MEDASSIST_DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@localhost:5432/medassist"
$env:MEDASSIST_CORS_ORIGINS = "http://127.0.0.1:5173"
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m app.seed
$env:MEDASSIST_ALLOW_DEMO_ACCOUNTS = "1"
.\.venv\Scripts\python.exe -m app.seed_demo_accounts --reset-profiles
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**Terminal 2, frontend** (from `frontend`):

```powershell
Set-Content .env.local "VITE_API_BASE_URL=http://127.0.0.1:8000"
npm ci
npm run dev
```

Then:

1. In Chrome, open <http://127.0.0.1:5173/sign-in> (use `127.0.0.1`, not
   `localhost`) and sign in as Patient A. The Health Profile opens with every
   section "Not recorded yet".
2. Add two medicines, an allergy and a condition, and choose **Save health profile**.
   The status line says "Saved …".
3. Reload the page: the entries are still there. Stop Uvicorn with `Ctrl+C`, start it
   again with the same command, and reload: still there, and still signed in.
4. Open an InPrivate or Incognito window (a separate browser session) at
   <http://127.0.0.1:5173/sign-in> and sign in as Patient B. B sees only the invented
   "Velorin (fictional)" medicine and "No known allergies", not A's entries.
5. Optional tamper check, in B's window: open DevTools → Console and run

   ```js
   const s = await (await fetch('http://127.0.0.1:8000/api/v1/auth/session', { credentials: 'include' })).json();
   const r = await fetch('http://127.0.0.1:8000/api/v1/me/health-profile', {
     method: 'PUT', credentials: 'include',
     headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': s.csrf_token },
     body: JSON.stringify({ version: 1, account_id: 1, medicines: { state: 'none', entries: [] },
       allergies: { state: 'none', entries: [] }, conditions: { state: 'none', entries: [] } }),
   });
   console.log(r.status, await r.json());
   ```

   The answer is `422` with "The profile owner comes from your sign-in and cannot be
   supplied." Reload A's window: nothing changed.
6. Conflict: in A's window, open the Health Profile in a second tab. Change something
   and save in the first tab, then change something and save in the second. The second
   tab says the profile was changed in another tab and offers **Load latest version**.
7. Choose **Sign out** in A's window. The entries disappear from the page, and
   reloading asks you to sign in again.

To start the demonstration over, run the seed command with `--reset-profiles` again.
