"""Public response contracts for the system and consultation endpoints."""

from datetime import date
from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator


class WelcomeResponse(BaseModel):
    message: str = Field(description="Welcome message from the MedAssist API.")


class HealthResponse(BaseModel):
    status: Literal["ok"] = Field(description="API liveness status.")
    service: Literal["medassist-api"] = Field(description="Service identifier.")
    version: str = Field(description="Running API version.")


class ProviderType(str, Enum):
    clinic = "clinic"
    hospital_outpatient = "hospital_outpatient"
    teleconsultation = "teleconsultation"
    community_camp = "community_camp"


class ConsultationMode(str, Enum):
    in_person = "in_person"
    video = "video"
    phone = "phone"


class FeeState(str, Enum):
    known = "known"
    free = "free"
    unknown = "unknown"


class SourceKind(str, Enum):
    fictional_seed = "fictional_seed"
    reviewed_external = "reviewed_external"


class ConsultationFee(BaseModel):
    """A fee is a known amount, explicitly free, or unknown; never a guess."""

    state: FeeState = Field(
        description=(
            "`known`: a positive amount is listed. `free`: the listing is "
            "explicitly free and `basis` says why. `unknown`: no fee is listed."
        )
    )
    amount_minor: Optional[int] = Field(
        description=(
            "Fee in minor units (paise; 30000 is ₹300). Positive when known, "
            "0 when free, null when unknown."
        ),
        ge=0,
    )
    currency: Optional[Literal["INR"]] = Field(
        description="ISO 4217 code; null when the fee is unknown."
    )
    basis: Optional[str] = Field(
        description="What the amount or free status rests on; null when unknown."
    )

    @model_validator(mode="after")
    def check_state_matches_amount(self) -> "ConsultationFee":
        has_basis = bool(self.basis and self.basis.strip())
        if self.state is FeeState.unknown:
            valid = self.amount_minor is None and self.currency is None and self.basis is None
        elif self.state is FeeState.free:
            valid = self.amount_minor == 0 and self.currency == "INR" and has_basis
        else:
            valid = bool(self.amount_minor) and self.currency == "INR" and has_basis
        if not valid:
            raise ValueError("fee amount, currency and basis do not match the fee state")
        return self


class ConsultationSourceInfo(BaseModel):
    kind: SourceKind = Field(
        description="`fictional_seed` records are invented demonstration data."
    )
    id: str = Field(description="Stable identifier of the source.")
    name: str = Field(description="Human-readable source name.")
    version: str = Field(description="Version of the source data set.")
    url: Optional[str] = Field(
        description="Source URL when one applies; always null for fictional data."
    )
    last_checked_on: Optional[date] = Field(
        description=(
            "Date the listing was last checked against its source; null when it "
            "has never been externally verified, as for all fictional data."
        )
    )


class ConsultationListing(BaseModel):
    id: str = Field(description="Stable listing ID, safe to keep for comparison.")
    provider_name: str
    provider_type: ProviderType
    specialty: str
    modes: List[ConsultationMode] = Field(min_length=1)
    area: str
    fee: ConsultationFee
    access_conditions: Optional[str] = Field(
        description="Conditions on using the listing; null when none are recorded."
    )
    languages: List[str]
    hours: Optional[str] = Field(description="Opening hours; null when not listed.")
    notes: Optional[str]
    is_fictional: bool = Field(
        description="True when the record is invented and must not be presented as real."
    )
    source: ConsultationSourceInfo


class ConsultationPage(BaseModel):
    items: List[ConsultationListing] = Field(
        description="Matching listings ordered by ID; empty when nothing matches."
    )
    total: int = Field(description="Number of listings matching the filters.")
    limit: int
    offset: int


class ServiceErrorResponse(BaseModel):
    detail: str = Field(description="Generic message that is safe to show to a user.")
    request_id: str = Field(
        description="Same value as the X-Request-ID header; quote it in a report."
    )
