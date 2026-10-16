# MedAssist

**An AI-Assisted Healthcare Triage and Patient Management Platform**

MedAssist is a B.Tech CSE student project by Saloni Pandey. This repository
currently contains a small FastAPI backend and the project planning documents.

## Current status

- Implemented: API welcome response, a liveness endpoint, generated API docs,
  and HTTP contract tests.
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
POST requests to the health route, and the published OpenAPI schema.

## Repository layout

- `backend/app/main.py`: FastAPI application and system routes.
- `backend/requirements.txt`: pinned runtime dependencies.
- `backend/requirements-dev.txt`: runtime dependencies plus test client support.
- `backend/tests/`: HTTP contract tests.
- `docs/`: project synopsis, presentation, and evaluation report.

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
