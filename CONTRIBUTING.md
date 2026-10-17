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

Use synthetic examples for project work. Authentication and database storage
remain future work; real patient data should not be used in this prototype.
