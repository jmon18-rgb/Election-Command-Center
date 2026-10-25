import copy
import datetime as dt
import io
import json
import unittest
from unittest.mock import patch

from preflight_election_night_providers import (
    ORIGIN, START, validate_primary, fetch_json,
)

class FakeResponse:
    def __init__(self,payload,cors=ORIGIN):
        self.payload=payload
        self.status=200
        self.headers={"Access-Control-Allow-Origin":cors}
    def __enter__(self):
        return self
    def __exit__(self,*args):
        return False
    def read(self,count):
        return self.payload[:count]

class SourcePreflightTests(unittest.TestCase):
    def setUp(self):
        self.now=dt.datetime(2026,10,23,22,tzinfo=dt.timezone.utc)
        self.doc={"api":1,"year":2026,"office":"Senate","source":"state",
                  "races":{"NC":{"total":0,"called":False,"winner":None,
                                  "cands":[],"pct_in":None}},
                  "live":False,"stale":False,"counting":False,"final":False,
                  "counts":{"races":1},"as_of":"2026-10-23T20:00:00Z"}

    def test_pre_election_zero_votes_still_not_live(self):
        x=validate_primary(self.doc,"Senate",self.now)
        self.assertEqual(x["listed_races"],1)
        self.assertEqual(x["positive_vote_races"],0)
        self.assertEqual(x["winner_calls_verified"],0)
        self.assertIn("NOT_LIVE_VERIFIED",x["status"])

    def test_after_poll_closing_validated_candidate_counts_not_calls(self):
        doc=copy.deepcopy(self.doc)
        doc["races"]["NC"].update({"total":123,"cands":[
            {"n":"Sample A","p":"DEM","v":60,"pct":None},
            {"n":"Sample B","p":"REP","v":63,"pct":None}]})
        with self.assertRaisesRegex(ValueError,"Pre-election"):
            validate_primary(doc,"Senate",self.now)
        # Nov. 3 23:30 UTC is after the earliest US close but BEFORE
        # North Carolina's Nov. 4 00:30 UTC polling close.
        doc["as_of"]="2026-11-03T23:30:00Z"
        with self.assertRaisesRegex(ValueError,"State-local poll closure"):
            validate_primary(doc,"Senate",START+dt.timedelta(minutes=30))
        doc["as_of"]="2026-11-04T00:50:00Z"
        doc["live"]=True
        doc["counting"]=True
        at=dt.datetime(2026,11,4,1,10,tzinfo=dt.timezone.utc)
        result=validate_primary(doc,"Senate",at)
        self.assertEqual(result["positive_vote_races"],1)
        self.assertEqual(result["winner_calls_verified"],0)

    def test_state_closing_source_arithmetic_and_source_status(self):
        doc=copy.deepcopy(self.doc)
        doc.update(live=True,counting=True,as_of="2026-11-04T00:50:00Z")
        doc["races"]["NC"].update(total=100,cands=[
         {"n":"Alpha","p":"D","v":60,"pct":None},
         {"n":"Beta","p":"R","v":40,"pct":None}])
        now=dt.datetime(2026,11,4,1,10,tzinfo=dt.timezone.utc)
        self.assertEqual(validate_primary(doc,"Senate",now)["positive_vote_races"],1)
        cases=[
         ({**doc,"as_of":None},"poll closure"),
         ({**doc,"as_of":"2026-11-04T00:29:59Z"},"poll closure"),
         ({**doc,"as_of":"2026-11-04T01:26:00Z"},"Future"),
         ({**doc,"live":False,"counting":False},"Inactive"),
         ({**doc,"live":False,"stale":True,"counting":False},"Inactive"),
         ({**doc,"races":{"NC":{**doc["races"]["NC"],
            "cands":[{"n":"Alpha","p":"D","v":0},
                     {"n":"Beta","p":"R","v":0}]}}},"arithmetic"),
         ({**doc,"races":{"NC":{**doc["races"]["NC"],
            "cands":[{"n":"Alpha","p":"D","v":60},
                     {"n":"alpha","p":"R","v":40}]}}},"arithmetic"),
         ({**doc,"races":{"NC":{**doc["races"]["NC"],
            "cands":[]}}},"arithmetic"),
        ]
        for bad,pattern in cases:
            with self.subTest(problem=pattern):
                with self.assertRaisesRegex(ValueError,pattern):
                    validate_primary(bad,"Senate",now)
        with self.assertRaisesRegex(ValueError,"Stale"):
            validate_primary(doc,"Senate",
             dt.datetime(2026,11,4,4,0,tzinfo=dt.timezone.utc))
        # Washington is within the 22-state primary feed and can have a
        # legitimate same-party top-two House race. California is outside
        # this feed and requires a separately verified supplemental adapter.
        top={**self.doc,"office":"House","live":False,"final":True,
             "as_of":"2026-11-04T04:15:00Z",
             "races":{"WA-01":{"total":100,"called":False,"winner":"",
                "cands":[{"n":"Candidate 1","p":"D","v":60},
                         {"n":"Candidate 2","p":"D","v":40}]}},
             "counts":{"races":1}}
        self.assertEqual(validate_primary(top,"House",
             dt.datetime(2026,11,4,4,30,tzinfo=dt.timezone.utc)
           )["positive_vote_races"],1)
        # Pre-election standby is not evidence of no ballots being cast.
        self.assertEqual(validate_primary(self.doc,"Senate",self.now)["positive_vote_races"],0)

    def test_rejects_wrong_race_and_fake_winner(self):
        for key in ("House","Governor"):
            with self.assertRaises(ValueError):
                validate_primary(self.doc,key,self.now)
        changed=copy.deepcopy(self.doc)
        changed["races"]["NC"]["called"]=True
        with self.assertRaises(ValueError):
            validate_primary(changed,"Senate",self.now)
        changed=copy.deepcopy(self.doc)
        changed["races"]["NC"]["total"]=-5
        with self.assertRaises(ValueError):
            validate_primary(changed,"Senate",self.now)
        changed=copy.deepcopy(self.doc)
        changed["counts"]["races"]=3
        with self.assertRaises(ValueError):
            validate_primary(changed,"Senate",self.now)

    def test_exact_2026_primary_race_scope_blocks_false_preflight_green(self):
        now=dt.datetime(2026,11,4,3,0,tzinfo=dt.timezone.utc)
        positive={"total":120,"called":False,"winner":None,
                  "cands":[{"n":"Candidate A","p":"D","v":70},
                           {"n":"Candidate B","p":"R","v":50}]}
        zero={"total":0,"called":False,"winner":None,"cands":[]}
        # Every office uses actual contested-race inventory, not merely
        # a two-letter state + district regex and plausible vote arithmetic.
        for office,seat in (
            ("House","NH-01"),("House","TX-99"),("House","TX-00"),
            ("House","VT-01"),("Senate","MA"),("Senate","AZ"),
            ("Governor","NC"),("Governor","NH")
        ):
            for row in (positive, zero):
                bad={**self.doc,"office":office,"live":True,"counting":True,
                     "as_of":"2026-11-04T02:50:00Z",
                     "counts":{"races":1},"races":{seat:row}}
                with self.subTest(office=office,seat=seat,total=row["total"]):
                    with self.assertRaisesRegex(ValueError,"exact-race"):
                        validate_primary(bad,office,now)
        valid={**self.doc,"office":"House","live":True,"counting":True,
               "as_of":"2026-11-04T02:50:00Z",
               "counts":{"races":1},"races":{"TX-01":positive}}
        self.assertEqual(validate_primary(valid,"House",now)["positive_vote_races"],1)
        valid["races"]={"TX-01":zero}
        self.assertEqual(validate_primary(valid,"House",now)["positive_vote_races"],0)

    def test_test_mock_or_inactive_sources_cannot_pass_canary(self):
        for bad_flag in ({"is_test":True},{"test":True},
                         {"mock":True},{"is_mock":True},{"active":False}):
            for positive in (False,True):
                bad=copy.deepcopy(self.doc)
                bad.update(bad_flag)
                if positive:
                    bad["races"]["NC"].update({"total":120,"cands":[
                        {"n":"A","p":"D","v":70},
                        {"n":"B","p":"R","v":50}]})
                    bad.update({"live":True,"counting":True,
                                "as_of":"2026-11-04T02:50:00Z"})
                with self.subTest(flags=bad_flag,positive=positive):
                    with self.assertRaisesRegex(ValueError,"mock, test or inactive"):
                        validate_primary(bad,"Senate",
                             dt.datetime(2026,11,4,3,tzinfo=dt.timezone.utc))
        good={**self.doc,"is_test":False,"mock":False,"active":True}
        self.assertEqual(validate_primary(good,"Senate",self.now)["positive_vote_races"],0)

    def test_positive_votes_need_exact_state_source_provenance(self):
        doc=copy.deepcopy(self.doc)
        doc["races"]["NC"].update({"total":120,"cands":[
            {"n":"A","p":"D","v":70},{"n":"B","p":"R","v":50}]})
        doc.update({"live":True,"counting":True,
                    "as_of":"2026-11-04T02:50:00Z"})
        now=dt.datetime(2026,11,4,3,tzinfo=dt.timezone.utc)
        for s in ("",):
            with self.assertRaisesRegex(ValueError,"state feed"):
                validate_primary({**doc,"source":s},"Senate",now)
        self.assertEqual(validate_primary(doc,"Senate",now)["positive_vote_races"],1)

    def test_hourly_openamerica_smoke_reuses_strict_2026_canary_gate(self):
        import test_live_results_source
        empty={**self.doc,"races":{},"counts":{"races":0}}
        def all_valid(year,office):
            if year==2024:
                return {"races": {str(i):{} for i in range(10)}}
            return {**empty,"office":office}
        with patch("test_live_results_source.fetch",side_effect=all_valid):
            self.assertIsNone(test_live_results_source.main())
        def unscoped(year,office):
            doc=all_valid(year,office)
            if year==2026 and office=="House":
                return {**doc,"counts":{"races":1},
                        "races":{"NH-01":{"total":0,"called":False,
                                         "winner":None,"cands":[]}}}
            return doc
        with patch("test_live_results_source.fetch",side_effect=unscoped):
            with self.assertRaisesRegex(ValueError,"exact-race"):
                test_live_results_source.main()
        def mocked(year,office):
            doc=all_valid(year,office)
            if year==2026 and office=="Senate":
                return {**doc,"mock":True}
            return doc
        with patch("test_live_results_source.fetch",side_effect=mocked):
            with self.assertRaisesRegex(ValueError,"mock, test or inactive"):
                test_live_results_source.main()

    def test_bounded_cors_response_protection(self):
        body=json.dumps(self.doc).encode()
        with patch("urllib.request.urlopen",return_value=FakeResponse(body)):
            self.assertEqual(fetch_json("https://openamerica.io/example")["year"],2026)
        with patch("urllib.request.urlopen",return_value=FakeResponse(body,"")):
            with self.assertRaisesRegex(ValueError,"CORS"):
                fetch_json("https://openamerica.io/example")
        with patch("urllib.request.urlopen",return_value=FakeResponse(b"{"*2_000_001)):
            with self.assertRaisesRegex(ValueError,"bounded"):
                fetch_json("https://openamerica.io/example")

if __name__=="__main__":
    unittest.main()
