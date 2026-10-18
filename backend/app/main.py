"""MedAssist API entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_cors_origins
from app.middleware import RequestIDMiddleware
from app.schemas import HealthResponse, WelcomeResponse


def create_app() -> FastAPI:
    """Build an application with settings read when the instance is created."""
    origins = get_cors_origins()
    application = FastAPI(
        title="MedAssist API",
        description="Backend foundation for the MedAssist student project.",
        version="0.1.0",
    )
    if origins:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=False,
            allow_methods=["GET"],
            expose_headers=["X-Request-ID"],
        )
    application.add_middleware(RequestIDMiddleware)

    @application.get("/", tags=["System"], summary="Check the API welcome message")
    def home() -> WelcomeResponse:
        return WelcomeResponse(message="MedAssist backend is running")

    @application.get("/health", tags=["System"], summary="Check API liveness")
    def health() -> HealthResponse:
        """Report liveness only; no database or external services are checked."""
        return HealthResponse(
            status="ok", service="medassist-api", version=application.version
        )

    return application


app = create_app()
