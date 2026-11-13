"""The pilot import format and freshness rules, checked without a database.

Every provider, URL and condition here is fictional.
"""

import copy
import json
import unittest
from datetime import date
from pathlib import Path

from pydantic import ValidationError

from app.consultation_pilot import (
    PilotDataset,
    PilotFee,
    is_example_url,
    is_stale,
    recheck_due_on,
    stale_before,
)

BACKEND = Path(__file__).resolve().parents[1]
FIXTURE = BACKEND / "app" / "fixtures" / "consultation_pilot_fixture.json"
BROKEN = BACKEND / "tests" / "fixtures"
AS_OF = date(2026, 11, 13)


def load(path=FIXTURE):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


class FixtureFileTests(unittest.TestCase):
    def test_the_fixture_is_valid_fictional_and_covers_every_fee_case(self):
        dataset = PilotDataset.model_validate(load())
        dataset.check_dates(AS_OF)

        self.assertEqual(dataset.source.kind, "pilot_fixture")
        self.assertIn("FICTIONAL", dataset.source.reuse_basis)
        for listing in dataset.listings:
            with self.subTest(listing=listing.id):
                self.assertIn("(fictional)", listing.provider_name)
                self.assertTrue(is_example_url(listing.source_url))
        cases = {
            listing.id: (
                listing.fee.state,
                is_stale(listing.last_checked_on, AS_OF, 90),
                listing.access_conditions is not None,
            )
            for listing in dataset.listings
        }
        self.assertEqual(cases["fx-civil-opd"], ("known", False, True))
        self.assertEqual(cases["fx-wellness-free"], ("free", False, True))
        self.assertEqual(cases["fx-tele-unknown"], ("unknown", False, True))
        self.assertEqual(cases["fx-child-camp"], ("free", True, True))
        self.assertEqual(cases["fx-ent-opd"], ("known", True, False))

    def test_the_id_clash_file_is_valid_and_only_fails_in_the_database(self):
        dataset = PilotDataset.model_validate(load(BROKEN / "consultation_pilot_id_clash.json"))

        self.assertIn("c-01", [listing.id for listing in dataset.listings])

    def test_the_invalid_file_is_refused_before_any_database_work(self):
        with self.assertRaisesRegex(ValidationError, "free fee needs the basis"):
            PilotDataset.model_validate(load(BROKEN / "consultation_pilot_invalid.json"))


class FormatRuleTests(unittest.TestCase):
    def broken(self, change):
        data = copy.deepcopy(load())
        change(data)
        return data

    def test_fees_follow_the_three_states(self):
        self.assertEqual(PilotFee(state="known", amount_inr="10.50", basis="b").amount_minor, 1050)
        self.assertEqual(PilotFee(state="free", basis="b").amount_minor, 0)
        self.assertIsNone(PilotFee(state="unknown").amount_minor)
        for fee in (
            {"state": "known", "basis": "b"},
            {"state": "known", "amount_inr": 10},
            {"state": "known", "amount_inr": "1.234", "basis": "b"},
            {"state": "known", "amount_inr": 0, "basis": "b"},
            {"state": "free"},
            {"state": "free", "amount_inr": 0, "basis": "b"},
            {"state": "unknown", "basis": "b"},
            {"state": "unknown", "amount_inr": 5},
            {"state": "discounted", "basis": "b"},
        ):
            with self.subTest(fee=fee):
                with self.assertRaises(ValidationError):
                    PilotFee.model_validate(fee)

    def test_dataset_rules(self):
        def first(change):
            return lambda d: change(d["listings"][0])

        for name, change, message in (
            ("duplicate id", lambda d: d["listings"].append(d["listings"][0]), "unique"),
            ("bad id", first(lambda item: item.update(id="Bad ID")), "pattern"),
            ("http url", first(lambda item: item.update(source_url="http://x.example.org/a")), "https"),
            (
                "credentials in url",
                first(lambda item: item.update(source_url="https://u:p@x.example.org/a")),
                "https",
            ),
            ("missing check date", first(lambda item: item.pop("last_checked_on")), "last_checked_on"),
            ("repeated mode", first(lambda item: item.update(modes=["video", "video"])), "repeat"),
            ("unknown field", first(lambda item: item.update(rating=5)), "Extra inputs"),
            ("no reuse basis", lambda d: d["source"].pop("reuse_basis"), "reuse_basis"),
            (
                "fixture with a real URL",
                first(lambda item: item.update(source_url="https://mathura.nic.in/hospitals")),
                "example.org",
            ),
            (
                "fixture name not labelled",
                first(lambda item: item.update(provider_name="Civil Hospital OPD")),
                "must say \\(fictional\\)",
            ),
            (
                "reviewed data on example URLs",
                lambda d: d["source"].update(kind="reviewed_external"),
                "cannot use example",
            ),
            ("no listings", lambda d: d.update(listings=[]), "at least 1"),
            ("wrong format", lambda d: d.update(format="csv"), "format"),
        ):
            with self.subTest(name=name):
                with self.assertRaisesRegex(ValidationError, message):
                    PilotDataset.model_validate(self.broken(change))

    def test_check_dates_in_the_future_are_refused(self):
        dataset = PilotDataset.model_validate(
            self.broken(lambda d: d["listings"][0].update(last_checked_on="2026-11-14"))
        )

        with self.assertRaisesRegex(ValueError, "fx-civil-opd"):
            dataset.check_dates(AS_OF)
        dataset.check_dates(date(2026, 11, 14))


class FreshnessTests(unittest.TestCase):
    def test_a_check_is_current_through_its_last_day(self):
        checked = date(2026, 8, 15)

        self.assertEqual(recheck_due_on(checked, 90), date(2026, 11, 13))
        self.assertFalse(is_stale(checked, date(2026, 11, 13), 90))
        self.assertTrue(is_stale(checked, date(2026, 11, 14), 90))

    def test_the_sql_cutoff_agrees_with_is_stale(self):
        for days in (1, 30, 90, 365):
            cutoff = stale_before(AS_OF, days)
            with self.subTest(days=days):
                self.assertFalse(is_stale(cutoff, AS_OF, days))
                self.assertTrue(is_stale(date.fromordinal(cutoff.toordinal() - 1), AS_OF, days))


if __name__ == "__main__":
    unittest.main()
