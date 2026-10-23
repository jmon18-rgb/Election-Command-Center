#!/usr/bin/env python3
"""No live network: poll discovery -> average -> probabilities regression."""
import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_poll_to_odds import check
from poll_firm_wave_selection import select_latest_firm_waves
import build_polling_estimates as live_average
from datetime import date

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
            "dem": 48, "rep": 48, "margin": 0,
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
        "dem": 45, "rep": 42, "margin": 3
    }


class PollChainTests(unittest.TestCase):
    def test_complete_baseline_links(self):
        primary, model, odds = fixture()
        result = check(primary, model, odds)
        self.assertEqual(result["linked_probability_records"], 32)
        self.assertEqual(result["linked_firm_waves"], 32)

    def test_saved_snapshot_does_not_expire_overnight_without_rebuilding(self):
        primary, model, odds = fixture()
        # Last valid 45-day poll on October 21 expires October 22. Checking
        # the SAVED October 21 model on October 22 must use its snapshot day.
        raw = primary["races"][0]["polls"][0]
        raw["field_end"] = "2026-09-06"
        modeled = model["senate_all"][0]
        modeled["pollsters"][0]["field_end"] = "2026-09-06"
        modeled["latest_poll_end"] = "2026-09-06"
        odds["records"][0]["latest_poll_end"] = "2026-09-06"
        primary["updated_at"] = "2026-10-21T16:47:14Z"
        model["source_snapshot"] = primary["updated_at"]
        model["generated_at"] = "2026-10-21T16:47:18Z"
        model["method_version"] = "poll-mean-1.5"
        odds["polling_source_snapshot"] = primary["updated_at"]
        odds["polling_source_generated_at"] = model["generated_at"]
        self.assertEqual(check(primary, model, odds)["linked_probability_records"], 32)
        # A *new* model dated Oct 22 cannot keep a now-ineligible poll.
        with self.assertRaisesRegex(ValueError, "same-day selected firms differ"):
            check(primary, model, odds, today=date(2026, 10, 22))

    def test_minnesota_new_poll_cannot_silently_skip_average(self):
        primary, model, odds = fixture()
        poll = newer()
        primary["races"][0]["polls"].insert(0, poll)
        supplemental = {"observations": [poll]}
        with self.assertRaisesRegex(ValueError, "Newest primary poll omitted|NOT in weighted average"):
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

    def test_new_primary_only_poll_cannot_hide_from_model(self):
        primary, model, odds = fixture()
        p = newer()
        primary["races"][0]["polls"].insert(0, p)
        with self.assertRaisesRegex(ValueError, "Newest primary poll omitted"):
            check(primary, model, odds, today=__import__("datetime").date(2026, 10, 14))

    def test_intentionally_excluded_firm_does_not_block_forecast(self):
        primary, model, odds = fixture()
        p = newer()
        p["pollster"] = "Explicitly Excluded Example"
        primary["races"][0]["polls"].insert(0, p)
        model["excluded_pollsters"] = ["explicitly excluded example"]
        result = check(primary, model, odds,
                       today=__import__("datetime").date(2026, 10, 14))
        self.assertEqual(result["freshest_primary_firm_waves"], 32)

    def test_whole_qualifying_race_cannot_disappear_from_both_model_and_odds(self):
        primary, model, odds = fixture()
        # This simulates an accidentally skipped NEW House race, when both
        # generated tables omit it and thus seem mutually consistent.
        model["house"] = [r for r in model["house"] if r["race_code"] != "TX-31"]
        odds["records"] = [r for r in odds["records"] if r["race_code"] != "TX-31"]
        with self.assertRaisesRegex(ValueError, "absent from BOTH model and odds"):
            check(primary, model, odds, today=__import__("datetime").date(2026, 10, 14))

    def test_unpolled_older_race_does_not_invent_a_probability(self):
        primary, model, odds = fixture()
        model["house"] = [r for r in model["house"] if r["race_code"] != "TX-31"]
        odds["records"] = [r for r in odds["records"] if r["race_code"] != "TX-31"]
        primary["races"][-1]["polls"][0]["field_end"] = "2026-07-01"
        result = check(primary, model, odds, today=__import__("datetime").date(2026, 10, 14))
        self.assertEqual(result["qualifying_source_races"], 31)

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

    def test_same_day_texas_style_lv_sample_selection_is_order_invariant(self):
        common={
            "pollster":"YouGov", "field_end":"2026-10-05",
            "dem_name":"Democrat", "rep_name":"Republican", "partisan_lean":"",
            "sample_population":"lv"
        }
        small={**common,"poll_id":"texas-861","sample_size":861,
               "dem":50.0,"rep":47.0,"margin":3.0}
        large={**common,"poll_id":"texas-3623","sample_size":3623,
               "dem":50.0,"rep":44.0,"margin":6.0}
        winners=[]
        for order in ([small,large],[large,small]):
            picked,audit=select_latest_firm_waves(order)
            self.assertEqual(len(picked),1)
            self.assertEqual(picked[0]["poll_id"],"texas-3623")
            self.assertEqual(len(audit["resolved_same_day_ties"]),1)
            estimate=live_average.estimate({"polls":order},date(2026,10,14))
            self.assertEqual(estimate["contributing_pollsters"],1)
            self.assertEqual(estimate["dem_minus_rep"],6)
            self.assertEqual(estimate["pollsters"][0]["poll_id"],"texas-3623")
            winners.append(estimate)
        self.assertEqual(winners[0],winners[1])
        self.assertEqual(live_average.estimate({"polls":[small]},date(2026,10,14))["dem_minus_rep"],3)

    def test_lv_preferred_over_bigger_rv_from_same_firm_date(self):
        base={"pollster":"Example Polls","field_end":"2026-10-05",
              "dem_name":"Dem","rep_name":"Rep"}
        likely={**base,"poll_id":"lv","sample_population":"lv",
                "sample_size":718,"dem":47,"rep":44,"margin":3}
        registered={**base,"poll_id":"rv","sample_population":"rv",
                    "sample_size":1300,"dem":51,"rep":44,"margin":7}
        chosen,_=select_latest_firm_waves([registered,likely])
        self.assertEqual([p["poll_id"] for p in chosen],["lv"])

    def test_equal_priority_contradictions_are_quarantined(self):
        base={"pollster":"Example","field_end":"2026-10-05",
              "sample_size":850,"sample_population":"lv",
              "dem_name":"Dem","rep_name":"Rep"}
        a={**base,"poll_id":"A","dem":51,"rep":45,"margin":6}
        b={**base,"poll_id":"B","dem":46,"rep":48,"margin":-2}
        for order in ([a,b],[b,a]):
            selected,audit=select_latest_firm_waves(order)
            self.assertEqual(selected,[])
            self.assertEqual(len(audit["quarantined_same_day_firms"]),1)
        # No arbitrary partisan tie break or synthetic probability.
        self.assertEqual(live_average.estimate({"polls":[b,a]},date(2026,10,14))["status"],
                         "no_recent_qualifying_polls")

    def test_v15_validator_refuses_wrong_same_day_question_in_published_odds(self):
        primary,model,odds=fixture()
        model["method_version"]="poll-mean-1.5"
        smaller=primary["races"][0]["polls"][0]
        smaller.update({"sample_population":"lv","sample_size":861})
        larger={**smaller,"poll_id":"better-sample","sample_size":3623,
                "dem":50,"rep":44,"margin":6}
        primary["races"][0]["polls"].append(larger)
        with self.assertRaisesRegex(ValueError,"incorrect same-day selected poll"):
            check(primary,model,odds,today=date(2026,10,14))
        chosen=model["senate_all"][0]
        chosen["pollsters"]=[{"poll_id":"better-sample","name":"SurveyUSA",
                             "field_end":"2026-10-07","sample_population":"lv",
                             "sample_size":3623,"dem":50,"rep":44}]
        chosen["dem_minus_rep"]=6
        odds["records"][0]["dem_minus_rep"]=6
        result=check(primary,model,odds,today=date(2026,10,14))
        self.assertEqual(result["freshest_primary_firm_waves"],32)
        self.assertEqual(result["linked_probability_records"],32)

    def test_latest_firm_poll_does_not_force_historical_poll(self):
        primary, model, odds = fixture()
        p = copy.deepcopy(primary["races"][0]["polls"][0])
        p["race_type"], p["race_code"] = "senate", "MN-SEN"
        result = check(primary, model, odds, {"observations": [p]},
                       today=__import__("datetime").date(2026, 10, 14))
        self.assertEqual(result["verified_newest_indexed_waves"], 1)


if __name__ == "__main__":
    unittest.main()
