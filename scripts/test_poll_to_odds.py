#!/usr/bin/env python3
"""No live network: poll discovery -> average -> probabilities regression."""
import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_poll_to_odds import check

AT = "2026-10-14T20:00:00Z"
BUILT = "2026-10-14T20:01:00Z"


def fixture():
    raw, modeled, odds = [], [], []
    for number in range(32):
        code = "MN-SEN" if number == 0 else f"TX-{number:02d}"
        office = "senate" if number == 0 else "house"
        source_poll = {
            "poll_id": f"old-{number}", "pollster": "SurveyUSA",
            "field_end": "2026-10-07", "dem_name": "Peggy Flanagan" if number == 0 else "Candidate D",
            "rep_name": "Michele Tafoya" if number == 0 else "Candidate R",
            "dem": 48, "rep": 48,
        }
        raw.append({"race_code": code, "race_type": office, "polls": [source_poll]})
        modeled.append({
            "race_code": code, "status": "single_poll",
            "dem_candidate": source_poll["dem_name"], "rep_candidate": source_poll["rep_name"],
            "dem_minus_rep": 0, "latest_poll_end": "2026-10-07",
            "contributing_pollsters": 1, "independent_pollsters": 1,
            "pollsters": [{"poll_id": source_poll["poll_id"],
                           "name": "SurveyUSA", "field_end": "2026-10-07"}]
        })
        odds.append({
            "race_code": code, "office": office, "dem_minus_rep": 0,
            "latest_poll_end": "2026-10-07", "contributing_firms": 1, "independent_firms": 1
        })
    return (
        {"updated_at": AT, "races": raw},
        {"source_snapshot": AT, "generated_at": BUILT, "senate_all": [modeled[0]],
         "house": modeled[1:], "governor": [], "excluded_pollsters": []},
        {"polling_source_snapshot": AT, "polling_source_generated_at": BUILT,
         "records": odds}
    )


def newer():
    return {
        "race_type": "senate", "race_code": "MN-SEN",
        "poll_id": "new-mn-surveyusa", "pollster": "SurveyUSA",
        "field_end": "2026-10-12",
        "dem_name": "Peggy Flanagan", "rep_name": "Michele Tafoya",
        "dem": 45, "rep": 42
    }


class PollChainTests(unittest.TestCase):
    def test_complete_baseline_links(self):
        primary, model, odds = fixture()
        result = check(primary, model, odds)
        self.assertEqual(result["linked_probability_records"], 32)
        self.assertEqual(result["linked_firm_waves"], 32)

    def test_minnesota_new_poll_cannot_silently_skip_average(self):
        primary, model, odds = fixture()
        poll = newer()
        primary["races"][0]["polls"].insert(0, poll)
        supplemental = {"observations": [poll]}
        with self.assertRaisesRegex(ValueError, "NOT in weighted average"):
            check(primary, model, odds, supplemental, today=__import__("datetime").date(2026, 10, 14))
        # A complete refresh selects the new SurveyUSA study, recomputes
        # the average, and delivers the same margin to probability inputs.
        mn = model["senate_all"][0]
        mn["pollsters"][0] = {"poll_id": poll["poll_id"],
                              "name": "SurveyUSA", "field_end": poll["field_end"]}
        mn["latest_poll_end"] = poll["field_end"]
        mn["dem_minus_rep"] = 3.0
        odds["records"][0]["latest_poll_end"] = poll["field_end"]
        odds["records"][0]["dem_minus_rep"] = 3.0
        result = check(primary, model, odds, supplemental,
                       today=__import__("datetime").date(2026, 10, 14))
        self.assertEqual(result["verified_newest_indexed_waves"], 1)
        self.assertEqual(mn["dem_minus_rep"], 3.0)
        self.assertEqual(odds["records"][0]["dem_minus_rep"], 3.0)

    def test_old_probability_snapshot_blocks_publication(self):
        primary, model, odds = fixture()
        odds["polling_source_generated_at"] = "2026-10-13T17:00:00Z"
        with self.assertRaisesRegex(ValueError, "outdated polling"):
            check(primary, model, odds)

    def test_odds_cannot_keep_previous_margin_even_with_current_timestamp(self):
        primary, model, odds = fixture()
        model["senate_all"][0]["dem_minus_rep"] = 4.0
        with self.assertRaisesRegex(ValueError, "probability does not match"):
            check(primary, model, odds)

    def test_same_day_ambiguity_is_not_forced_into_average(self):
        primary, model, odds = fixture()
        p = newer()
        p["field_end"] = "2026-10-07"
        p["poll_id"] = "alternate-same-day"
        primary["races"][0]["polls"].append(p)
        # Two separate same-day waves could reflect overlapping samples.
        result = check(primary, model, odds, {"observations": [p]},
                       today=__import__("datetime").date(2026, 10, 14))
        self.assertEqual(result["ambiguous_same_day_questions"], 1)

    def test_latest_firm_poll_does_not_force_historical_poll(self):
        primary, model, odds = fixture()
        p = copy.deepcopy(primary["races"][0]["polls"][0])
        p["race_type"], p["race_code"] = "senate", "MN-SEN"
        result = check(primary, model, odds, {"observations": [p]},
                       today=__import__("datetime").date(2026, 10, 14))
        self.assertEqual(result["verified_newest_indexed_waves"], 1)


if __name__ == "__main__":
    unittest.main()
