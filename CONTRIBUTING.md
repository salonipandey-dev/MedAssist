# Developing MedAssist

Start with the [local setup instructions](Readme.md#run-locally). Run backend
commands from `backend`, using the project's virtual environment.

## Make a focused change

1. Start a branch from an up-to-date `main`, for example:
   `git switch -c feature/describe-your-change`.
2. Put API routes and the app factory in `app/main.py`, response contracts in
   `app/schemas.py`, and environment settings in `app/config.py`.
3. Add HTTP tests under `tests/` when changing endpoint behavior or response
   contracts. Include invalid input and configuration cases where relevant.
4. Update the README when a route, setting, or setup step changes, and commit
   related code, tests, and documentation together.

## Verify before pushing

Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
git diff --check
```

macOS or Linux, with the virtual environment activated:

```bash
python -m pip install -r requirements-dev.txt
python -m pip check
python -m unittest discover -s tests -v
git diff --check
```

GitHub Actions repeats the dependency and test checks on Linux and Windows with
Python 3.10 and 3.14. Check the workflow results on your pull request. In the PR
description, explain the user-visible change and the checks you ran.

## Work with the API locally

Open <http://127.0.0.1:8000/docs> after starting the server to inspect request and
response schemas. Use `create_app()` when tests need an independent application
instance; settings are read for each instance. See the README's
[frontend configuration](Readme.md#connect-a-local-frontend) for browser access.

Use [requests.http](backend/requests.http) with a compatible HTTP client to try
welcome, health, schema, and error responses against the running server. Its
`@baseUrl` defaults to `http://127.0.0.1:8000`; change it when using another port.
Check the expected status in each request's title and inspect `X-Request-ID` in
the response headers when investigating a problem.

Use synthetic examples for project work. Authentication and database storage
remain future work; real patient data should not be used in this prototype.

## Work on the React frontend

Run `npm ci` in `frontend`, then `npm run dev`. Keep the original demo at
`frontend/public/legacy/` intact unless deliberately fixing its safeguards.

Before pushing frontend work, run `npm run format:check`, `npm run build`,
`npm test`, and `npm run test:e2e` from `frontend`. Install the browser once with
`npx playwright install chromium` (use `--with-deps` on a minimal Linux host).
The browser suite serves the compiled build, so rebuild after source changes.

Keep mock workflow rules in `src/data/mock/service.ts`, records in `seed.ts`,
and chart aggregates in `analytics.ts`. Use shared typed records across views.
Only `src/services/api/system.ts` may contact the implemented system API.
Do not add a real health-input control, upload picker, credentials or prediction
until the required backend and appropriate verification exist. Do not use browser
storage for sample records or quietly redirect mock actions to real services.

See [the frontend guide](docs/FRONTEND_GUIDE.md) for route architecture,
service boundaries and the backend integration sequence. Screenshots can be
regenerated after building with `npm run screenshots`; use fictional records only.
