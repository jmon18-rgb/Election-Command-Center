#!/usr/bin/env python3
"""Negative controls to prevent district polls contaminating statewide models."""
import copy
import json
import unittest
from pathlib import Path

from validate_geographic_poll_signals import validate

ROOT = Path(__file__).resolve().parents[1]
SIGNALS = json.loads((ROOT/"data/geographic_poll_signals.json").read_text(encoding="utf-8"))
SEATS = json.loads((ROOT/"data/seat_universe.json").read_text(encoding="utf-8"))
HOUSE = {x["race_code"] for x in SEATS["house"]["seats"]}


class GeographicSignalsTests(unittest.TestCase):
    def test_verified_local_senate_and_governor(self):
        self.assertEqual(validate(SIGNALS, HOUSE),2)
        by_office = {x["office"]:x for x in SIGNALS["signals"]}
        self.assertEqual(by_office["senate"]["race_code"],"TX-SEN")
        self.assertEqual(by_office["senate"]["sample_district"],"TX-09")
        self.assertEqual(by_office["senate"]["dem_minus_rep_points"],-1)
        self.assertEqual(by_office["senate"]["reference_presidential_2024_two_party_d_minus_r_points"],-20)
        self.assertEqual(by_office["governor"]["dem_minus_rep_points"],-4)
        for entry in SIGNALS["signals"]:
            self.assertIs(entry["model_eligible"],False)

    def test_statewide_poll_guard(self):
        for changes in (
            {"model_eligible": True},
            {"sample_scope": "statewide"},
            {"sample_district": "TX-99"},
            {"sample_district": "CA-09"},
            {"race_code": "CA-SEN"},
            {"sample_geography_map_year": 2024},
            {"review_status": "unverified"},
            {"source_url": "https://"},
            {"dem_minus_rep_points": None}
        ):
            with self.subTest(change=changes), self.assertRaises(ValueError):
                doc=copy.deepcopy(SIGNALS)
                doc["signals"][0].update(changes)
                validate(doc,HOUSE)

    def test_no_duplicate_questions(self):
        doc=copy.deepcopy(SIGNALS)
        doc["signals"][1]["question_id"]=doc["signals"][0]["question_id"]
        with self.assertRaises(ValueError):
            validate(doc,HOUSE)

    def test_polling_data_does_not_include_scoped_questions(self):
        # This independent input is permitted to include the TX-09 House
        # question but not the geographically scoped Senate/Governor questions.
        raw=json.loads((ROOT/"data/polls.json").read_text(encoding="utf-8"))
        assert "races" in raw
        for entry in SIGNALS["signals"]:
            matching=[q for r in raw["races"] if r["race_code"]==entry["race_code"]
                      for q in r.get("polls",[])
                      if q.get("pollster")==entry["survey_firm"] and
                         q.get("field_end")==entry["field_end"]]
            self.assertFalse(matching,"District statewide-question contaminated primary polling input")


if __name__ == "__main__":
    unittest.main()
