"""The medication rule evaluator, checked with fictional profiles and no database.

Every product, ingredient, allergy, condition and rule here is invented.
"""

import copy
import json
import unittest

from pydantic import ValidationError

from app.medication_rules import FIXTURE_PATH, MedicationFixture, evaluate, load_fixture
from app.schemas import HealthProfileResponse


def section(value):
    """A list means recorded entries, "none" means none, None means not recorded."""
    if value is None:
        return {"state": "not_recorded", "entries": []}
    if value == "none":
        return {"state": "none", "entries": []}
    return {"state": "recorded", "entries": [{"name": name, "note": None} for name in value]}


def profile(medicines=None, allergies="none", conditions="none", version=3):
    return HealthProfileResponse.model_validate(
        {
            "version": version,
            "updated_at": None,
            "medicines": section(medicines),
            "allergies": section(allergies),
            "conditions": section(conditions),
        }
    )


def rule_ids(result):
    return [match.rule_id for match in result.matches]


class FixtureTests(unittest.TestCase):
    def setUp(self):
        with open(FIXTURE_PATH, encoding="utf-8") as handle:
            self.raw = json.load(handle)

    def test_fixture_is_versioned_fictional_and_consistent(self):
        fixture = load_fixture()

        self.assertEqual(fixture.version, "1.0.0")
        self.assertTrue(fixture.is_fictional)
        self.assertEqual(
            [rule.id for rule in fixture.rules],
            [
                "DEMO-DUP-001",
                "DEMO-ALG-001",
                "DEMO-INT-001",
                "DEMO-INT-002",
                "DEMO-CND-001",
                "DEMO-CND-002",
            ],
        )

    def test_fixture_text_reports_demo_rules_without_safety_or_dosing_language(self):
        text = json.dumps(self.raw).lower()
        for word in ("safe", "dose", "dosage", " mg", "stop taking", "start taking"):
            with self.subTest(word=word):
                self.assertNotIn(word, text)

    def test_broken_fixtures_are_refused(self):
        def broken(change):
            data = copy.deepcopy(self.raw)
            change(data)
            return data

        for name, data in (
            ("duplicate ID", broken(lambda d: d["products"].append(d["products"][0]))),
            (
                "unknown ingredient",
                broken(lambda d: d["products"][0]["ingredient_ids"].append("ing-missing")),
            ),
            (
                "interaction with one ingredient",
                broken(lambda d: d["rules"][2].update(ingredient_ids=["ing-teromide"])),
            ),
            ("unknown condition", broken(lambda d: d["rules"][4].update(condition_id="cnd-x"))),
            ("not fictional", broken(lambda d: d.update(is_fictional=False))),
            ("unversioned", broken(lambda d: d.update(version="latest"))),
            ("bad rule ID", broken(lambda d: d["rules"][0].update(id="rule-1"))),
        ):
            with self.subTest(name=name):
                with self.assertRaises(ValidationError):
                    MedicationFixture.model_validate(data)


class FourChecksTests(unittest.TestCase):
    def test_duplicate_active_ingredient(self):
        result = evaluate(profile(["Brivanol 250 tablets", "Coldaway Day Relief"]))

        self.assertEqual(result.outcome, "matches_found")
        self.assertTrue(result.complete)
        [match] = result.matches
        self.assertEqual(match.rule_id, "DEMO-DUP-001")
        self.assertEqual(match.check, "duplicate_ingredient")
        self.assertEqual(match.ingredients, ["brivanol"])
        self.assertEqual(
            [(entry.entry, entry.matched_id) for entry in match.entries],
            [("Brivanol 250 tablets", "prd-brivanol-250"), ("Coldaway Day Relief", "prd-coldaway-day")],
        )

    def test_ingredient_matches_a_reported_allergy(self):
        result = evaluate(profile(["Sulvaxin capsules"], allergies=["Sulvaxin-group sensitivity"]))

        [match] = result.matches
        self.assertEqual(match.rule_id, "DEMO-ALG-001")
        self.assertEqual(match.ingredients, ["sulvaxin"])
        self.assertEqual(
            [(entry.section, entry.matched_id) for entry in match.entries],
            [("medicines", "prd-sulvaxin"), ("allergies", "alg-sulvaxin-group")],
        )

    def test_medicine_pair_covered_by_an_interaction_rule(self):
        result = evaluate(profile(["Teromide tablets", "Pexilene tablets"]))

        [match] = result.matches
        self.assertEqual(match.rule_id, "DEMO-INT-001")
        self.assertEqual(match.ingredients, ["pexilene", "teromide"])

    def test_medicine_and_condition_covered_by_a_rule(self):
        result = evaluate(profile(["Pexilene tablets"], conditions=["Condition K"]))

        [match] = result.matches
        self.assertEqual(match.rule_id, "DEMO-CND-001")
        self.assertEqual(
            [(entry.section, entry.matched_name) for entry in match.entries],
            [("medicines", "Pexilene tablets"), ("conditions", "Condition K")],
        )

    def test_each_pair_is_reported_once_whatever_the_entry_order(self):
        names = ["Teromide", "Coldaway Day Relief", "Pexilene", "Brivanol 250", "Velorin"]
        forward = evaluate(profile(names, conditions=["Condition K"]))
        backward = evaluate(profile(list(reversed(names)), conditions=["Condition K"]))

        self.assertEqual(forward.model_dump(), backward.model_dump())
        self.assertEqual(
            rule_ids(forward), ["DEMO-DUP-001", "DEMO-INT-001", "DEMO-INT-002", "DEMO-CND-001"]
        )
        pairs = [tuple(entry.matched_id for entry in match.entries) for match in forward.matches]
        self.assertEqual(len(pairs), len(set(pairs)))

    def test_three_medicines_give_one_warning_per_sharing_pair(self):
        result = evaluate(
            profile(["Coldaway Night Relief", "Brivanol 250 tablets", "Coldaway Day Relief"])
        )

        self.assertEqual(
            [(match.rule_id, [e.matched_id for e in match.entries], match.ingredients) for match in result.matches],
            [
                ("DEMO-DUP-001", ["prd-brivanol-250", "prd-coldaway-day"], ["brivanol"]),
                ("DEMO-DUP-001", ["prd-coldaway-day", "prd-coldaway-night"], ["fendrazine"]),
            ],
        )


class CoverageTests(unittest.TestCase):
    def test_covered_profile_with_no_matching_rules(self):
        result = evaluate(
            profile(
                ["Velorin (fictional)"],
                allergies=["Sample pollen X"],
                conditions=["Sample condition Q"],
            )
        )

        self.assertEqual(result.outcome, "no_matching_rules")
        self.assertTrue(result.complete)
        self.assertEqual((result.matches, result.unresolved, result.missing), ([], [], []))
        self.assertEqual(
            [entry.matched_id for entry in result.recognised], ["prd-velorin", "alg-pollen-x", "cnd-q"]
        )

    def test_explicit_none_everywhere_is_covered(self):
        result = evaluate(profile("none"))

        self.assertEqual(result.outcome, "no_matching_rules")
        self.assertTrue(result.complete)

    def test_an_ambiguous_medicine_is_flagged_for_review(self):
        result = evaluate(profile(["Coldaway"]))

        self.assertEqual(result.outcome, "more_information_needed")
        self.assertFalse(result.complete)
        [entry] = result.unresolved
        self.assertEqual(
            (entry.section, entry.entry, entry.reason, entry.candidates),
            ("medicines", "Coldaway", "ambiguous", ["Coldaway Day Relief", "Coldaway Night Relief"]),
        )

    def test_unknown_entries_are_flagged_and_never_guessed(self):
        result = evaluate(
            profile(
                ["Calmora syrup", "Brivanol 25"],
                allergies=["Unlisted dust"],
                conditions=["Condition Z"],
            )
        )

        self.assertEqual(
            [(entry.section, entry.entry, entry.reason) for entry in result.unresolved],
            [
                ("medicines", "Brivanol 25", "unknown"),
                ("medicines", "Calmora syrup", "unknown"),
                ("allergies", "Unlisted dust", "unknown"),
                ("conditions", "Condition Z", "unknown"),
            ],
        )
        self.assertEqual(result.recognised, [])
        self.assertEqual(result.outcome, "more_information_needed")

    def test_a_missing_allergy_or_condition_section_is_reported(self):
        for name, kwargs, check in (
            ("allergies", {"allergies": None}, "allergy_ingredient"),
            ("conditions", {"conditions": None}, "medicine_condition"),
        ):
            with self.subTest(section=name):
                result = evaluate(profile(["Velorin"], **kwargs))
                self.assertEqual(result.outcome, "more_information_needed")
                [missing] = result.missing
                self.assertEqual(
                    (missing.section, missing.reason, [c.value for c in missing.affected_checks]),
                    (name, "not_recorded", [check]),
                )

    def test_missing_medicines_affects_every_check(self):
        result = evaluate(profile(None))

        [missing] = result.missing
        self.assertEqual(len(missing.affected_checks), 4)
        self.assertEqual(result.outcome, "more_information_needed")

    def test_a_warning_and_incomplete_information_are_both_returned(self):
        result = evaluate(
            profile(["Brivanol 250 tablets", "Coldaway Day Relief", "Coldaway"], allergies=None)
        )

        self.assertEqual(result.outcome, "matches_found")
        self.assertFalse(result.complete)
        self.assertEqual(rule_ids(result), ["DEMO-DUP-001"])
        self.assertEqual([entry.reason for entry in result.unresolved], ["ambiguous"])
        self.assertEqual([missing.section for missing in result.missing], ["allergies"])

    def test_entries_match_by_fixture_id_or_alias_ignoring_case_and_spacing(self):
        result = evaluate(profile(["  prd-teromide ", "PEXILENE"]))

        self.assertEqual(rule_ids(result), ["DEMO-INT-001"])
        # Saved names are already trimmed by the profile schema.
        self.assertEqual([entry.entry for entry in result.recognised], ["PEXILENE", "prd-teromide"])

    def test_the_same_product_entered_twice_is_a_duplicate(self):
        result = evaluate(profile(["Brivanol", "Brivanol 250 tablets"]))

        self.assertEqual(rule_ids(result), ["DEMO-DUP-001"])

    def test_result_carries_the_fixture_version_and_profile_version(self):
        result = evaluate(profile(["Velorin"], version=7))

        self.assertEqual(result.fixture.model_dump(), {
            "id": "medassist-fictional-medication-rules",
            "version": "1.0.0",
            "is_fictional": True,
        })
        self.assertEqual(result.profile_version, 7)


if __name__ == "__main__":
    unittest.main()
