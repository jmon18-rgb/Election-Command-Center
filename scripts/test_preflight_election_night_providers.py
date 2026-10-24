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
        # Never exclude a genuine California/WA same-party top-two general
        # election merely because both candidates have a D preference.
        top={**self.doc,"office":"House","live":False,"final":True,
             "as_of":"2026-11-04T04:15:00Z",
             "races":{"CA-01":{"total":100,"called":False,"winner":"",
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
