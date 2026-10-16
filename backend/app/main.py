"""MedAssist API entry point."""

from fastapi import FastAPI

app = FastAPI(
    title="MedAssist API",
    description="Backend foundation for the MedAssist student project.",
    version="0.1.0",
)


@app.get("/", tags=["System"], summary="Check the API welcome message")
def home() -> dict[str, str]:
    return {"message": "MedAssist backend is running"}


@app.get("/health", tags=["System"], summary="Check API liveness")
def health() -> dict[str, str]:
    """Report liveness only; no database or external services are checked."""
    return {"status": "ok", "service": "medassist-api", "version": app.version}
