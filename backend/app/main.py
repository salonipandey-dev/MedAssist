"""MedAssist API entry point."""

from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.engine import URL
from starlette.types import ASGIApp

from app.auth import router as auth_router
from app.config import (
    SessionSettings,
    get_cors_origins,
    get_database_url,
    get_pilot_settings,
    get_session_settings,
)
from app.consultations import (
    DirectoryUnavailableError,
    directory_unavailable_response,
    router as consultations_router,
)
from app.db import create_database_engine
from app.health_profile import router as health_profile_router
from app.medication_check import router as medication_check_router
from app.middleware import PrivateNoStoreMiddleware, RequestIDMiddleware
from app.schemas import HealthResponse, WelcomeResponse
from app.security import (
    CSRF_HEADER,
    PRIVATE_PATH_PREFIXES,
    AccountServiceUnavailableError,
    ApiError,
    account_service_unavailable_response,
    api_error_response,
    validation_error_response,
)


@asynccontextmanager
async def lifespan(application: FastAPI):
    yield
    if application.state.database_engine is not None:
        application.state.database_engine.dispose()


class MedAssistAPI(FastAPI):
    def __init__(
        self,
        cors_origins: list[str],
        database_url: Optional[URL],
        session_settings: SessionSettings,
    ) -> None:
        super().__init__(
            title="MedAssist API",
            description="Backend foundation for the MedAssist student project.",
            version="0.1.0",
            lifespan=lifespan,
        )
        self.cors_origins = cors_origins
        self.state.session_settings = session_settings
        # No connection is opened here; a missing or unreachable database only
        # affects the routes that query it.
        self.state.database_engine = (
            create_database_engine(database_url) if database_url is not None else None
        )

    def build_middleware_stack(self) -> ASGIApp:
        # Wrap the error handler so CORS, no-store and request IDs also apply to
        # its responses.
        stack = PrivateNoStoreMiddleware(
            super().build_middleware_stack(), PRIVATE_PATH_PREFIXES
        )
        if self.cors_origins:
            # Only the exact configured origins may send the session cookie.
            # Writes need a preflight: they carry JSON and the CSRF header.
            stack = CORSMiddleware(
                stack,
                allow_origins=self.cors_origins,
                allow_credentials=True,
                allow_methods=["GET", "HEAD", "POST", "PUT"],
                allow_headers=["Content-Type", CSRF_HEADER],
                expose_headers=["X-Request-ID"],
            )
        return RequestIDMiddleware(stack)


def create_app() -> FastAPI:
    """Build an application with settings read when the instance is created."""
    application = MedAssistAPI(
        get_cors_origins(), get_database_url(), get_session_settings()
    )
    # Read at startup: changing the pilot setting needs a restart.
    application.state.pilot_settings = get_pilot_settings()

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

    application.include_router(consultations_router)
    application.include_router(auth_router)
    application.include_router(health_profile_router)
    application.include_router(medication_check_router)
    application.add_exception_handler(
        DirectoryUnavailableError, directory_unavailable_response
    )
    application.add_exception_handler(ApiError, api_error_response)
    application.add_exception_handler(
        AccountServiceUnavailableError, account_service_unavailable_response
    )
    application.add_exception_handler(RequestValidationError, validation_error_response)

    return application


app = create_app()
