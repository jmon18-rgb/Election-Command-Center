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
        at=START+dt.timedelta(minutes=30)
        result=validate_primary(doc,"Senate",at)
        self.assertEqual(result["positive_vote_races"],1)
        self.assertEqual(result["winner_calls_verified"],0)

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
