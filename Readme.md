# MedAssist

**An AI-Assisted Healthcare Triage and Patient Management Platform**

MedAssist is a B.Tech CSE student project by Saloni Pandey. This repository
currently contains a small FastAPI backend and the project planning documents.

## Current status

- Implemented: API welcome response, a liveness endpoint, typed response
  schemas, request IDs, optional frontend origins, generated API docs, HTTP
  contract tests, and automated backend checks.
- Planned: patient management, authentication, database storage, and triage
  assistance. These features are not implemented yet.
- The prototype does not provide medical advice or clinical decision support.

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

## Available endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Return the existing backend welcome message |
| GET | `/health` | Check that the API is responding |
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
The welcome and health responses have named schemas in `/docs` and
`/openapi.json`, including their required fields.

## Trace a request

Successful responses and handled client errors (such as 404 and 405) include an
`X-Request-ID` response header. The API generates a new UUID for each HTTP request;
caller-supplied IDs are replaced. Include this ID when reporting an API problem.
Routes can access the same value through `request.state.request_id`. Request
tracing does not record request bodies or patient information.

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

Only the configured origins and GET requests are permitted by the browser CORS
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

The tests cover the existing welcome response, the health response, rejection of
POST requests to the health route, required OpenAPI fields, CORS defaults,
allowed and unlisted origins, preflight requests, invalid settings, request ID
generation, and browser access to response IDs.

The [Backend tests workflow](.github/workflows/backend-tests.yml) runs the suite
and checks installed dependency compatibility on Ubuntu and Windows with Python
3.10 and 3.14. It runs for backend or workflow changes pushed to `main`, for
matching pull requests, and on manual dispatch from the Actions tab.

## Repository layout

- `backend/app/main.py`: application factory, system routes, and Uvicorn app.
- `backend/app/config.py`: environment configuration for frontend origins.
- `backend/app/middleware.py`: server-generated HTTP request IDs.
- `backend/app/schemas.py`: public system response models.
- `backend/requirements.txt`: pinned runtime dependencies.
- `backend/requirements-dev.txt`: runtime dependencies plus test client support.
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
