import copy
import datetime as dt
import json
from pathlib import Path
import unittest
from preflight_pinned_senate_sources import parse_pins, select, validate_detail, probe

ROOT=Path(__file__).resolve().parents[1]
SOURCE=json.loads((ROOT/"data/election_night_source_coverage.json").read_text())
ADAPTER=(ROOT/"scripts/civicapi_state_batch.js").read_text()
NOW=dt.datetime(2026,10,23,15,0,tzinfo=dt.timezone.utc)
PINS=parse_pins(SOURCE,ADAPTER)

class PinnedSenateCanaries(unittest.TestCase):
    def test_complete_exact_pinned_senate_universe_rotates_in_four_days(self):
        self.assertEqual(len(PINS),18)
        self.assertEqual(PINS["Senate|MS"]["id"],81004)
        self.assertEqual(PINS["Senate|ME"]["id"],87188)
        self.assertEqual(PINS["Senate|OH-special"]["id"],87527)
        runs=[select(PINS,NOW+dt.timedelta(days=d)) for d in range(4)]
        self.assertEqual(sorted(len(group) for group in runs),[3,7,7,7])
        for group in runs:
            self.assertLessEqual(len(group),7)
            self.assertEqual({x["race"] for x in group[:2]},
                             {"Senate|ME","Senate|OH-special"})
        self.assertEqual({x["race"] for group in runs for x in group},set(PINS))

    def test_race_identity_cannot_be_borrowed_from_another_state_or_date(self):
        one=PINS["Senate|ME"]
        good={"id":87188,"country":"US","province":"ME","municipality":None,
              "district":None,"election_date":"2026-11-03T05:00:00Z",
              "election_name":"Maine US Senate","election_type":"US Senate",
              "candidates":[{"name":"No votes assumed"}]}
        self.assertFalse(validate_detail(one,good)["positive_count_coverage_verified"])
        self.assertFalse(validate_detail(one,good)["winner_call_verified"])
        for changes in [{"id":87527},{"province":"OH"},{"election_date":"2024-11-05T05:00:00Z"},
                        {"election_name":"Maine Governor"},{"election_type":"Governor"},
                        {"district":"ME-01"},{"candidates":None}]:
            with self.assertRaisesRegex(ValueError,"mismatched"):
                validate_detail(one,{**good,**changes})

    def test_heartbeat_tracks_real_endpoint_failures_without_fabricating_votes(self):
        def fake(url):
            race_id=int(url.rsplit("/",1)[1])
            if race_id==87527:raise OSError("simulated upstream 503")
            item=next(r for r in PINS.values() if r["id"]==race_id)
            return {"id":race_id,"country":"US","province":item["state"],
                    "municipality":None,"district":None,
                    "election_date":"2026-11-03T05:00:00Z",
                    "election_name":item["name"],"election_type":"US Senate",
                    "candidates":[]}
        a=probe(PINS,NOW,fake)
        self.assertEqual(a["checked_this_run"],len(select(PINS,NOW)))
        self.assertEqual(a["civicapi_sources_total"],18)
        self.assertEqual(a["not_probed_this_run"],18-a["checked_this_run"])
        self.assertEqual(a["authoritative_calls_verified"],0)
        self.assertTrue(a["not_a_live_vote_feed"])
        self.assertEqual(sum(x["status"].startswith("FAILED") for x in a["results"]),1)
        self.assertIn("simulated upstream 503",str(a["results"]))

    def test_pin_drift_fails_closed(self):
        drift=copy.deepcopy(SOURCE)
        one=next(r for r in drift["races"] if r.get("id")=="Senate|ME")
        one["pinned_civicapi_id"]=123
        with self.assertRaisesRegex(ValueError,"differs"):
            parse_pins(drift,ADAPTER)
        with self.assertRaises(ValueError):
            parse_pins(SOURCE,ADAPTER.replace("'Senate|ME'","'Senate|MA'"))
        with self.assertRaises(ValueError):
            parse_pins(SOURCE,{})
        with self.assertRaises(ValueError):
            select(PINS,dt.datetime(2026,10,23))

if __name__=="__main__":
    unittest.main()
