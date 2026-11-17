"""The reviewed Mathura listings in app/datasets/mathura, checked without a database.

These files hold real services recorded from official pages on 2026-11-17. The
tests keep them within the rules in docs/CONSULTATION_MATHURA_LISTINGS.md: a
reviewed source with its reuse basis, a free fee only with the source's words and
any eligibility beside it, and unknown fees with nothing invented.
"""

import json
import unittest
from datetime import date
from pathlib import Path

from app.consultation_pilot import PilotDataset, is_example_url

BACKEND = Path(__file__).resolve().parents[1]
DATASETS = BACKEND / "app" / "datasets" / "mathura"
CLASH = BACKEND / "tests" / "fixtures" / "consultation_mathura_id_clash.json"
CHECKED_ON = date(2026, 11, 17)
EXPECTED = {
    "mathura-esanjeevani-up": [
        "mathura-esj-up-general-opd",
        "mathura-esj-up-gmc-paediatrics",
        "mathura-esj-up-gmc-dermatology",
        "mathura-esj-up-gmc-obstetrics-gynaecology",
        "mathura-esj-up-gmc-psychiatry",
    ],
    "mathura-esic": ["mathura-esic-dispensary-sadar"],
    "mathura-tele-manas": ["mathura-tele-manas-helpline"],
}
OFFICIAL_HOSTS = {"esanjeevani.mohfw.gov.in", "telemanas.mohfw.gov.in", "esic.gov.in"}


def load(path):
    with open(path, encoding="utf-8") as handle:
        return PilotDataset.model_validate(json.load(handle))


def datasets():
    return [load(path) for path in sorted(DATASETS.glob("*.json"))]


class MathuraDatasetTests(unittest.TestCase):
    def test_each_file_is_one_reviewed_source_for_mathura_with_stable_ids(self):
        found = {dataset.source.id: [item.id for item in dataset.listings] for dataset in datasets()}
        self.assertEqual(found, EXPECTED)
        for dataset in datasets():
            with self.subTest(source=dataset.source.id):
                self.assertEqual(dataset.source.kind, "reviewed_external")
                self.assertEqual(dataset.source.locality, "Mathura, Uttar Pradesh")
                self.assertEqual(dataset.source.version, CHECKED_ON.isoformat())
                self.assertGreater(len(dataset.source.reuse_basis), 100)
                self.assertNotIn("(fictional)", dataset.source.name)
                dataset.check_dates(CHECKED_ON)

    def test_every_page_is_an_official_https_page(self):
        for dataset in datasets():
            urls = [dataset.source.url, *(item.source_url for item in dataset.listings)]
            if dataset.source.reuse_basis_url:
                urls.append(dataset.source.reuse_basis_url)
            for url in urls:
                with self.subTest(url=url):
                    self.assertFalse(is_example_url(url))
                    self.assertIn(url.split("/")[2], OFFICIAL_HOSTS)

    def test_fees_are_free_only_with_the_source_words_and_eligibility(self):
        listings = [item for dataset in datasets() for item in dataset.listings]
        self.assertEqual(len(listings), 7)
        for item in listings:
            with self.subTest(listing=item.id):
                self.assertEqual(item.last_checked_on, CHECKED_ON)
                self.assertNotEqual(item.fee.state, "known")  # no price is published
                if item.fee.state == "free":
                    self.assertTrue(item.fee.basis)
                    self.assertTrue(item.access_conditions)
                else:
                    self.assertIsNone(item.fee.basis)
        free = sorted(item.id for item in listings if item.fee.state == "free")
        self.assertEqual(
            free, sorted(EXPECTED["mathura-esanjeevani-up"] + EXPECTED["mathura-esic"])
        )

    def test_unverified_details_stay_empty(self):
        by_id = {item.id: item for dataset in datasets() for item in dataset.listings}
        # Neither page states hours or languages for these two services.
        for listing_id in ("mathura-esic-dispensary-sadar", "mathura-tele-manas-helpline"):
            self.assertIsNone(by_id[listing_id].hours)
        self.assertTrue(all(not item.languages for item in by_id.values()))
        # Insured persons only: the free label never stands without its condition.
        self.assertIn("insured", by_id["mathura-esic-dispensary-sadar"].access_conditions)

    def test_the_clash_file_is_valid_and_can_only_fail_in_the_database(self):
        dataset = load(CLASH)
        dataset.check_dates(CHECKED_ON)
        self.assertEqual(dataset.source.id, "mathura-esanjeevani-up")
        self.assertEqual(dataset.listings[-1].id, "c-01")


if __name__ == "__main__":
    unittest.main()
