#!/usr/bin/env python3
"""Offline regression for critical static-site publication integrity."""
import copy
import json
import unittest
from check_publication_health import DATA, health


def sources():
    load = lambda n: json.loads((DATA / f"{n}.json").read_text(encoding="utf-8"))
    return [load(name) for name in (
        "polls", "polling_estimates", "race_probabilities",
        "seat_universe", "pollresults_recent")]


class PublicationSmokeTests(unittest.TestCase):
    def setUp(self):
        self.bundle = sources()

    def test_current_data_is_publishable(self):
        result = health(*self.bundle)
        self.assertEqual(result["status"], "linked_source_bundle_healthy")
        self.assertEqual(result["polled_races"]["senate"],
                         self.bundle[3]["senate"]["polled_with_qualifying_average"])
        self.assertGreaterEqual(result["linked_firm_waves"], 90)

    def test_partial_publish_is_rejected(self):
        tampered = copy.deepcopy(self.bundle)
        tampered[2]["polling_source_generated_at"] = "2026-01-01T00:00:00Z"
        with self.assertRaisesRegex(ValueError, "Standalone probability"):
            health(*tampered)

    def test_missing_race_odds_are_rejected(self):
        tampered = copy.deepcopy(self.bundle)
        tampered[2]["records"].pop()
        with self.assertRaisesRegex(ValueError, "probability"):
            health(*tampered)

    def test_omitted_survey_cannot_pass(self):
        tampered = copy.deepcopy(self.bundle)
        target = next(x for x in tampered[1]["senate_all"]
                      if x.get("status") in ("multi_poll", "single_poll"))
        poll = target["pollsters"][0]
        source = next(x for x in tampered[0]["races"]
                      if x["race_code"] == target["race_code"])
        source["polls"] = [p for p in source["polls"] if
                           not (p.get("poll_id") == poll["poll_id"] and
                                p.get("pollster") == poll["name"] and
                                p.get("field_end") == poll["field_end"])]
        with self.assertRaisesRegex(ValueError, "source question not uniquely"):
            health(*tampered)

    def test_one_poll_multiple_questions_must_use_one_sample(self):
        tampered = copy.deepcopy(self.bundle)
        target = next(x for x in tampered[1]["senate_all"]
                      if x.get("status") in ("multi_poll", "single_poll"))
        pick = target["pollsters"][0]
        source = next(x for x in tampered[0]["races"]
                      if x["race_code"] == target["race_code"])
        wave = next(p for p in source["polls"]
                    if p.get("poll_id") == pick["poll_id"] and
                    p.get("pollster") == pick["name"] and
                    p.get("field_end") == pick["field_end"])
        # A mismatched RV question must not be represented as the included LV.
        pick["sample_population"] = "rv" if wave.get("sample_population") == "lv" else "lv"
        with self.assertRaisesRegex(ValueError, "wrong sample_population"):
            health(*tampered)


if __name__ == "__main__":
    unittest.main()
