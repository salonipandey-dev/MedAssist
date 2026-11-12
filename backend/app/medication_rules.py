"""Deterministic medication checks against a fictional, versioned demo dataset.

The dataset (app/fixtures/medication_demo_rules.json) holds invented products,
ingredients, allergies, conditions and rules. Nothing here describes a real
medicine or a real clinical rule; the result only says which demo rules matched
and which inputs the demo dataset could not cover.

This module has no web or database code: `evaluate(profile)` takes the saved
profile and returns the result, so it can be tested on its own.

Matching is exact after trimming, collapsing spaces and ignoring case. An entry
matches a record's ID, name or one of its listed aliases, and nothing else. An
entry that matches no record is `unknown`; one that matches several is
`ambiguous`. Both are returned for review rather than guessed.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from itertools import combinations
from pathlib import Path
from typing import Dict, FrozenSet, List, Literal, Optional, Tuple

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas import (
    CheckedEntry,
    CheckKind,
    HealthProfileResponse,
    MedicationCheckResponse,
    MedicationFixtureInfo,
    MissingInformation,
    RuleMatch,
    SectionState,
    UnresolvedEntry,
)

FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "medication_demo_rules.json"

# Which checks cannot run when a section has not been recorded.
AFFECTED_BY_MISSING: Dict[str, List[CheckKind]] = {
    "medicines": list(CheckKind),
    "allergies": [CheckKind.allergy_ingredient],
    "conditions": [CheckKind.medicine_condition],
}
CHECK_ORDER = list(CheckKind)


# --- Fixture -------------------------------------------------------------------


class _Record(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(pattern=r"^[a-z]{3}-[a-z0-9-]+$")
    name: str = Field(min_length=1)


class FixtureIngredient(_Record):
    pass


class FixtureProduct(_Record):
    aliases: List[str] = []
    ingredient_ids: List[str] = Field(min_length=1)


class FixtureAllergy(_Record):
    aliases: List[str] = []
    ingredient_ids: List[str] = []


class FixtureCondition(_Record):
    aliases: List[str] = []


class FixtureRule(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(pattern=r"^DEMO-(DUP|ALG|INT|CND)-\d{3}$")
    check: CheckKind
    title: str = Field(min_length=1)
    explanation: str = Field(min_length=1)
    ingredient_ids: List[str] = []
    condition_id: Optional[str] = None

    @model_validator(mode="after")
    def check_shape(self) -> "FixtureRule":
        if self.check is CheckKind.medicine_interaction:
            valid = len(set(self.ingredient_ids)) == 2 and self.condition_id is None
        elif self.check is CheckKind.medicine_condition:
            valid = bool(self.ingredient_ids) and self.condition_id is not None
        else:
            valid = not self.ingredient_ids and self.condition_id is None
        if not valid:
            raise ValueError(f"rule {self.id} does not have the fields its check needs")
        return self


class MedicationFixture(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str
    version: str = Field(pattern=r"^\d+\.\d+\.\d+$")
    is_fictional: Literal[True]
    description: str
    ingredients: List[FixtureIngredient]
    products: List[FixtureProduct]
    allergies: List[FixtureAllergy]
    conditions: List[FixtureCondition]
    rules: List[FixtureRule]

    @model_validator(mode="after")
    def check_references(self) -> "MedicationFixture":
        ids = [
            record.id
            for group in (self.ingredients, self.products, self.allergies, self.conditions)
            for record in group
        ] + [rule.id for rule in self.rules]
        if len(ids) != len(set(ids)):
            raise ValueError("fixture IDs must be unique")
        ingredient_ids = {item.id for item in self.ingredients}
        condition_ids = {item.id for item in self.conditions}
        for record in [*self.products, *self.allergies, *self.rules]:
            unknown = set(record.ingredient_ids) - ingredient_ids
            if unknown:
                raise ValueError(f"{record.id} names unknown ingredients {sorted(unknown)}")
        for rule in self.rules:
            if rule.condition_id is not None and rule.condition_id not in condition_ids:
                raise ValueError(f"{rule.id} names unknown condition {rule.condition_id}")
        for check in (CheckKind.duplicate_ingredient, CheckKind.allergy_ingredient):
            if sum(rule.check is check for rule in self.rules) != 1:
                raise ValueError(f"exactly one {check.value} rule is required")
        return self

    def info(self) -> MedicationFixtureInfo:
        return MedicationFixtureInfo(id=self.id, version=self.version, is_fictional=True)


@lru_cache(maxsize=1)
def load_fixture(path: Path = FIXTURE_PATH) -> MedicationFixture:
    with path.open(encoding="utf-8") as handle:
        return MedicationFixture.model_validate(json.load(handle))


# --- Matching entries to fixture records ---------------------------------------


def normalize(text: str) -> str:
    return " ".join(text.split()).casefold()


def _index(records) -> Dict[str, Tuple[str, ...]]:
    """Map each normalized ID, name and alias to the record IDs it can mean."""
    index: Dict[str, List[str]] = {}
    for record in records:
        keys = {normalize(record.id), normalize(record.name)}
        keys.update(normalize(alias) for alias in getattr(record, "aliases", []))
        for key in keys:
            index.setdefault(key, []).append(record.id)
    return {key: tuple(sorted(set(values))) for key, values in index.items()}


@dataclass(frozen=True)
class _Resolved:
    section: str
    entry: str
    record_id: str
    record_name: str
    ingredients: FrozenSet[str]

    def as_checked(self) -> CheckedEntry:
        return CheckedEntry(
            section=self.section,
            entry=self.entry,
            matched_id=self.record_id,
            matched_name=self.record_name,
        )

    @property
    def sort_key(self) -> Tuple[str, str]:
        # Independent of the order entries were saved in.
        return (self.record_id, normalize(self.entry))


def _resolve(section, names, records, unresolved) -> List[_Resolved]:
    by_id = {record.id: record for record in records}
    index = _index(records)
    resolved = []
    for name in names:
        matches = index.get(normalize(name), ())
        if len(matches) == 1:
            record = by_id[matches[0]]
            resolved.append(
                _Resolved(
                    section=section,
                    entry=name,
                    record_id=record.id,
                    record_name=record.name,
                    ingredients=frozenset(getattr(record, "ingredient_ids", ())),
                )
            )
        else:
            unresolved.append(
                UnresolvedEntry(
                    section=section,
                    entry=name,
                    reason="ambiguous" if matches else "unknown",
                    candidates=sorted(by_id[record_id].name for record_id in matches),
                )
            )
    return sorted(resolved, key=lambda item: item.sort_key)


# --- The four checks -----------------------------------------------------------


def evaluate(
    profile: HealthProfileResponse, fixture: Optional[MedicationFixture] = None
) -> MedicationCheckResponse:
    fixture = fixture or load_fixture()
    ingredient_names = {item.id: item.name for item in fixture.ingredients}
    rules_by_check: Dict[CheckKind, List[FixtureRule]] = {check: [] for check in CheckKind}
    for rule in fixture.rules:
        rules_by_check[rule.check].append(rule)

    missing: List[MissingInformation] = []
    unresolved: List[UnresolvedEntry] = []
    resolved: Dict[str, List[_Resolved]] = {}
    for section, records in (
        ("medicines", fixture.products),
        ("allergies", fixture.allergies),
        ("conditions", fixture.conditions),
    ):
        saved = getattr(profile, section)
        if saved.state is SectionState.not_recorded:
            missing.append(
                MissingInformation(
                    section=section,
                    reason="not_recorded",
                    affected_checks=AFFECTED_BY_MISSING[section],
                )
            )
        recorded = saved.state is SectionState.recorded
        names = [entry.name for entry in saved.entries] if recorded else []
        resolved[section] = _resolve(section, names, records, unresolved)
    sections = ["medicines", "allergies", "conditions"]
    unresolved.sort(key=lambda item: (sections.index(item.section), normalize(item.entry)))

    medicines = resolved["medicines"]
    matches: List[RuleMatch] = []

    def add(rule: FixtureRule, entries, ingredients) -> None:
        matches.append(
            RuleMatch(
                rule_id=rule.id,
                check=rule.check,
                title=rule.title,
                explanation=rule.explanation,
                entries=[entry.as_checked() for entry in entries],
                ingredients=sorted(ingredient_names[item] for item in ingredients),
            )
        )

    # Pairs come from sorted lists, so each pair is reported once, in one order.
    for first, second in combinations(medicines, 2):
        shared = first.ingredients & second.ingredients
        if shared:
            add(rules_by_check[CheckKind.duplicate_ingredient][0], (first, second), shared)
        for rule in rules_by_check[CheckKind.medicine_interaction]:
            left, right = rule.ingredient_ids
            if (left in first.ingredients and right in second.ingredients) or (
                right in first.ingredients and left in second.ingredients
            ):
                add(rule, (first, second), {left, right})

    for medicine in medicines:
        for allergy in resolved["allergies"]:
            shared = medicine.ingredients & allergy.ingredients
            if shared:
                add(rules_by_check[CheckKind.allergy_ingredient][0], (medicine, allergy), shared)
        for condition in resolved["conditions"]:
            for rule in rules_by_check[CheckKind.medicine_condition]:
                shared = medicine.ingredients & set(rule.ingredient_ids)
                if rule.condition_id == condition.record_id and shared:
                    add(rule, (medicine, condition), shared)

    matches.sort(
        key=lambda match: (
            CHECK_ORDER.index(match.check),
            match.rule_id,
            [entry.matched_id for entry in match.entries],
            [normalize(entry.entry) for entry in match.entries],
        )
    )
    complete = not missing and not unresolved
    if matches:
        outcome = "matches_found"
    elif complete:
        outcome = "no_matching_rules"
    else:
        outcome = "more_information_needed"
    return MedicationCheckResponse(
        fixture=fixture.info(),
        profile_version=profile.version,
        outcome=outcome,
        complete=complete,
        matches=matches,
        unresolved=unresolved,
        missing=missing,
        recognised=[
            entry.as_checked()
            for section in ("medicines", "allergies", "conditions")
            for entry in resolved[section]
        ],
    )
