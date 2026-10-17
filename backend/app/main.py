"""MedAssist API entry point."""

from fastapi import FastAPI

from app.schemas import HealthResponse, WelcomeResponse

app = FastAPI(
    title="MedAssist API",
    description="Backend foundation for the MedAssist student project.",
    version="0.1.0",
)


@app.get("/", tags=["System"], summary="Check the API welcome message")
def home() -> WelcomeResponse:
    return WelcomeResponse(message="MedAssist backend is running")


@app.get("/health", tags=["System"], summary="Check API liveness")
def health() -> HealthResponse:
    """Report liveness only; no database or external services are checked."""
    return HealthResponse(status="ok", service="medassist-api", version=app.version)
