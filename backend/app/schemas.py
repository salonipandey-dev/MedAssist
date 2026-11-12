"""Request and response contracts for the system, consultation, sign-in and
health profile endpoints."""

from datetime import date, datetime
from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models import ENTRIES_PER_SECTION_MAX, ENTRY_NAME_MAX, ENTRY_NOTE_MAX


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


# --- Sign-in and private health profiles -------------------------------------


class ApiErrorResponse(BaseModel):
    detail: str = Field(description="Message that is safe to show to the signed-in person.")
    code: str = Field(
        description=(
            "Stable machine-readable reason, for example `not_signed_in`, "
            "`session_expired`, `csrf_failed` or `version_conflict`."
        )
    )


class VersionConflictResponse(ApiErrorResponse):
    code: Literal["version_conflict"]
    current_version: int = Field(description="Version now stored on the server.")


class SignInRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class AccountSummary(BaseModel):
    display_name: str
    email: str
    role: Literal["patient"]


class SessionResponse(BaseModel):
    """The signed-in account. The session token itself only travels in the
    HttpOnly cookie and never appears in a body."""

    account: AccountSummary
    csrf_token: str = Field(
        description=(
            "Send this value in the X-CSRF-Token header on every sign-out and "
            "profile update made with this session."
        )
    )
    expires_at: datetime = Field(description="Latest time this session can last.")
    idle_expires_at: datetime = Field(
        description="When the session ends if no further request is made."
    )


class SectionState(str, Enum):
    not_recorded = "not_recorded"
    none = "none"
    recorded = "recorded"


def _single_line(value: str, field: str, maximum: int) -> str:
    value = value.strip()
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ValueError(f"{field} must be a single line of text.")
    if len(value) > maximum:
        raise ValueError(f"{field} must be {maximum} characters or fewer.")
    return value


class ProfileEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(description=f"Required, 1 to {ENTRY_NAME_MAX} characters.")
    note: Optional[str] = Field(
        default=None,
        description=f"Optional, up to {ENTRY_NOTE_MAX} characters. Blank becomes null.",
    )

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = _single_line(value, "Name", ENTRY_NAME_MAX)
        if not value:
            raise ValueError("Enter a name.")
        return value

    @field_validator("note")
    @classmethod
    def clean_note(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _single_line(value, "Note", ENTRY_NOTE_MAX) or None


class ProfileSection(BaseModel):
    """`not_recorded`: nothing has been said yet. `none`: the patient has said
    there is nothing to list. `recorded`: one or more entries follow."""

    model_config = ConfigDict(extra="forbid")

    state: SectionState
    entries: List[ProfileEntry] = Field(
        default_factory=list, max_length=ENTRIES_PER_SECTION_MAX
    )

    @model_validator(mode="after")
    def check_state_matches_entries(self) -> "ProfileSection":
        if self.state is SectionState.recorded and not self.entries:
            raise ValueError("Add at least one entry, or choose another option.")
        if self.state is not SectionState.recorded and self.entries:
            raise ValueError("Entries can only be saved when the state is 'recorded'.")
        names = [entry.name.casefold() for entry in self.entries]
        if len(names) != len(set(names)):
            raise ValueError("Each name can appear only once in a section.")
        return self


class HealthProfileUpdate(BaseModel):
    """A complete replacement of the profile. The owner is always the signed-in
    account; extra fields such as an account or profile ID are rejected."""

    model_config = ConfigDict(extra="forbid")

    version: int = Field(
        ge=0,
        le=2_147_483_647,
        description="The version this edit started from; 0 for a profile never saved.",
    )
    medicines: ProfileSection
    allergies: ProfileSection
    conditions: ProfileSection


class HealthProfileResponse(BaseModel):
    version: int = Field(description="0 until the profile is first saved.")
    updated_at: Optional[datetime] = Field(description="Null until the profile is first saved.")
    medicines: ProfileSection
    allergies: ProfileSection
    conditions: ProfileSection
