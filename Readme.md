# MedAssist

**An AI-Assisted Healthcare Triage and Patient Management Platform**

MedAssist is a B.Tech CSE student project by Saloni Pandey. This repository
currently contains a small FastAPI backend and the project planning documents.

## Current status

- Implemented: API welcome response, GET/HEAD liveness checks, typed response
  schemas, request IDs, optional frontend origins, generated API docs, HTTP
  contract tests, and automated backend checks.
- Frontend demo: fictional patient entries appear in a temporary in-memory table;
  no registration data is sent to the API or saved between page reloads. The
  triage section displays a static unavailable notice and exposes no health
  input fields or risk scores, including when JavaScript is disabled.
- Planned: persistent patient management, authentication, database storage, and
  triage assistance. These features are not implemented yet.
- The prototype does not provide medical advice or clinical decision support.

## Try the frontend demo

Open `frontend/index.html` in a browser. The included `frontend/js/app.js`
script adds form validation and an in-memory table for **fictional sample
entries only**. The demo has no API connection or persistent storage; reloading
clears entries. Do not enter real patient or health information. Triage scoring
is not implemented; the page does not render health-input fields or risk
results. The risk statistics show N/A rather than misleading zero counts.

### Verify frontend nonclinical safeguards

With Node.js 22, run from the repository root:

```bash
node --test frontend/tests/nonclinical-demo.test.cjs
```

These tests check the JavaScript-disabled HTML, unavailable risk metrics,
no clinical forms, and safe sample registration without a triage form.
GitHub Actions repeats this check when frontend files change.

## Run locally

Prerequisite: Python 3.10 or newer with `pip` and `venv` available. Clone the
repository first:

```bash
git clone https://github.com/salonipandey-dev/MedAssist.git
cd MedAssist
```

### Windows PowerShell

Run these commands from the repository folder. Calling the virtual environment's
Python directly also works when PowerShell blocks activation scripts.

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

### macOS or Linux

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Keep the server terminal open. Visit <http://127.0.0.1:8000/docs> to try the API.
Use `Ctrl+C` to stop the development server. `--reload` is for local development.

The [sample API requests](backend/requests.http) include welcome, GET/HEAD health,
OpenAPI, and error examples with expected status codes. Open the file in an HTTP
client that supports `.http` files, such as VS Code with the REST Client
extension, and run each request while the server is running. Edit `@baseUrl` if
you use a different port. These examples do not require a database or login.

## Available endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Return the existing backend welcome message |
| GET | `/health` | Check that the API is responding |
| HEAD | `/health` | Check liveness headers without downloading a response body |
| GET | `/docs` | Open interactive Swagger documentation |
| GET | `/redoc` | Open ReDoc documentation |
| GET | `/openapi.json` | Retrieve the OpenAPI schema |

Example response from `/health`:

```json
{
  "status": "ok",
  "service": "medassist-api",
  "version": "0.1.0"
}
```

This is a liveness check. It does not check a database or any external service.
Successful health responses send `Cache-Control: no-store` so browsers and
intermediaries do not store a stale liveness result. Conditional cache headers
also receive a fresh `200 OK` liveness response instead of `304 Not Modified`.
Monitoring tools can use `HEAD /health` for the same status and headers without
a response body. For example, run `curl -I http://127.0.0.1:8000/health` (use
`curl.exe -I` in Windows PowerShell). HEAD requests also receive an `X-Request-ID`.
The welcome and health responses have named schemas in `/docs` and
`/openapi.json`, including their required fields.

## Trace a request

Successful responses and handled client errors (such as 404 and 405) include an
`X-Request-ID` response header. The API generates a new UUID for each HTTP request;
caller-supplied IDs are replaced. Include this ID when reporting an API problem.
Routes can access the same value through `request.state.request_id`. Request
tracing does not record request bodies or patient information.

Unexpected route failures before a response starts return a generic `500 Internal
Server Error` with the same request ID. Exception details stay out of the response;
the exception still propagates to the server for logging and debugging. Responses
that have already started cannot be replaced by this error handler.

```bash
curl -i http://127.0.0.1:8000/health
```

An allowed frontend can read the header with
`response.headers.get("X-Request-ID")`; it is exposed by the CORS configuration.

## Connect a local frontend

Cross-origin browser access is disabled by default. To let a frontend read the
API, set `MEDASSIST_CORS_ORIGINS` in the server terminal before starting Uvicorn.
Use the frontend's exact origin: protocol, host, and port, without a trailing
slash or path. Multiple origins are separated by commas.

Windows PowerShell, from `backend`:

```powershell
$env:MEDASSIST_CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

macOS or Linux, from `backend` with the virtual environment activated:

```bash
MEDASSIST_CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173" python -m uvicorn app.main:app --reload
```

Only the configured origins and GET/HEAD requests are permitted by the browser CORS
policy. Credentialed browser requests are disabled. Invalid origins (including
wildcards and URLs with paths) stop startup with a configuration error.
Settings are read when the app is created, so restart the server after changes.
`.env` files are not loaded automatically.

To disable this setting in PowerShell, run
`Remove-Item Env:MEDASSIST_CORS_ORIGINS` and restart the server. In a Unix shell,
use `unset MEDASSIST_CORS_ORIGINS` if you previously exported it. CORS does not
replace the authentication and access controls planned for patient workflows.

## Run the tests

In another terminal, enter the `backend` folder. The development requirements
include the runtime requirements and HTTPX2 for FastAPI's test client. The tests
use Python's built-in `unittest` runner.

Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

macOS or Linux, with the virtual environment activated:

```bash
python -m pip install -r requirements-dev.txt
python -m unittest discover -s tests -v
```

The tests cover the existing welcome response, GET/HEAD health responses and their
cache policy, rejection of POST requests to the health route, required OpenAPI
fields, CORS defaults,
allowed and unlisted origins, preflight requests, invalid settings, request ID
generation, unexpected server failures, and browser access to response IDs.

The [Backend tests workflow](.github/workflows/backend-tests.yml) runs the suite
and checks installed dependency compatibility on Ubuntu and Windows with Python
3.10 and 3.14. It runs for backend or workflow changes pushed to `main`, for
matching pull requests, and on manual dispatch from the Actions tab.

## Repository layout

- `frontend/index.html`, `frontend/style.css`, and `frontend/js/app.js`:
  static browser-only demonstration without data persistence or triage scoring.
- `backend/app/main.py`: application factory, system routes, and Uvicorn app.
- `backend/app/config.py`: environment configuration for frontend origins.
- `backend/app/middleware.py`: server-generated HTTP request IDs.
- `backend/app/schemas.py`: public system response models.
- `backend/requirements.txt`: pinned runtime dependencies.
- `backend/requirements-dev.txt`: runtime dependencies plus test client support.
- `backend/requests.http`: runnable local API examples and expected responses.
- `backend/tests/`: HTTP contract tests.
- `docs/`: project synopsis, presentation, and evaluation report.
- `.github/workflows/backend-tests.yml`: automated backend checks.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow.

Virtual environments, Python caches, and local environment files are ignored by
Git. Keep credentials and real patient information out of the repository.

## Troubleshooting

- **`uvicorn` is not recognized:** use `python -m uvicorn` from the active
  environment, or the full virtual environment Python command shown above.
- **Cannot import `app.main`:** run the server from `backend`, where the `app`
  folder lives.
- **PowerShell refuses `Activate.ps1`:** use the Windows commands above; changing
  your execution policy is unnecessary.
- **Port 8000 is in use:** add `--port 8001` to the server command and open
  <http://127.0.0.1:8001/docs> instead.

## Next development steps

1. Define the patient data model and database migrations.
2. Add authentication and access controls before storing patient information.
3. Build and validate the patient management workflow.
4. Explore triage assistance after the core workflow is working.
