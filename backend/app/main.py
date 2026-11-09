"""MedAssist API entry point."""

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp

from app.config import get_cors_origins
from app.middleware import RequestIDMiddleware
from app.schemas import HealthResponse, WelcomeResponse


class MedAssistAPI(FastAPI):
    def __init__(self, cors_origins: list[str]) -> None:
        super().__init__(
            title="MedAssist API",
            description="Backend foundation for the MedAssist student project.",
            version="0.1.0",
        )
        self.cors_origins = cors_origins

    def build_middleware_stack(self) -> ASGIApp:
        # Wrap the error handler so CORS and request IDs also apply to its responses.
        stack = super().build_middleware_stack()
        if self.cors_origins:
            stack = CORSMiddleware(
                stack,
                allow_origins=self.cors_origins,
                allow_credentials=False,
                allow_methods=["GET", "HEAD"],
                expose_headers=["X-Request-ID"],
            )
        return RequestIDMiddleware(stack)


def create_app() -> FastAPI:
    """Build an application with settings read when the instance is created."""
    application = MedAssistAPI(get_cors_origins())

    @application.get("/", tags=["System"], summary="Check the API welcome message")
    def home() -> WelcomeResponse:
        return WelcomeResponse(message="MedAssist backend is running")

    @application.head("/health", include_in_schema=False)
    @application.get("/health", tags=["System"], summary="Check API liveness")
    def health(response: Response) -> HealthResponse:
        """Report liveness only; no database or external services are checked."""
        response.headers["Cache-Control"] = "no-store"
        return HealthResponse(
            status="ok", service="medassist-api", version=application.version
        )

    return application


app = create_app()
