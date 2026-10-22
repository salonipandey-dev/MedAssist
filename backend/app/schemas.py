"""Public response contracts for the system endpoints."""

from typing import Literal

from pydantic import BaseModel, Field


class WelcomeResponse(BaseModel):
    message: str = Field(description="Welcome message from the MedAssist API.")


class HealthResponse(BaseModel):
    status: Literal["ok"] = Field(description="API liveness status.")
    service: Literal["medassist-api"] = Field(description="Service identifier.")
    version: str = Field(description="Running API version.")
