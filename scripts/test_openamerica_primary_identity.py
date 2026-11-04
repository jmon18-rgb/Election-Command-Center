#!/usr/bin/env python3
"""Synthetic metadata/counters and fake HTTP readers only; no source requests."""
from copy import deepcopy
import datetime as dt
import gzip
import itertools
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(Path.cwd()/"scripts"))
sys.path.insert(0,str(HERE))
from openamerica_primary_identity import normalize_primary_source, PRIMARY_2026_SENATE_URL
from test_live_results_source import fetch
from preflight_election_night_providers import fetch_json, validate_primary
from monitor_election_night_upstream_soak import validate_primary as validate_soak

FIXTURE=json.loads((HERE/"fixtures/openamerica_2026_senate_identity.synthetic.json").read_text())
NOW=dt.datetime.fromisoformat(FIXTURE["observer_now"].replace("Z","+00:00"))

class FakeResponse:
    def __init__(self,body,url=PRIMARY_2026_SENATE_URL,*,encoding="",cors="*"):
        self.body=gzip.compress(body) if encoding=="gzip" else body
        self.status=200;self.url=url;self.read_limits=[]
        self.headers={"Access-Control-Allow-Origin":cors,"Content-Type":"application/json",
                      "Content-Encoding":encoding}
    def __enter__(self):return self
    def __exit__(self,*args):return False
    def geturl(self):return self.url
    def read(self,limit):self.read_limits.append(limit);return self.body[:limit]

class PrimaryIdentityTests(unittest.TestCase):
    def raw(self):return deepcopy(FIXTURE["document"])

    def assert_rejected_by_both(self,doc,now=NOW):
        with self.assertRaises(ValueError):validate_primary(doc,"Senate",now)
        with self.assertRaises(ValueError):validate_soak(doc,"Senate",now)

    def assert_only_key_changed(self,raw,normalized):
        self.assertEqual(list(raw["races"]),FIXTURE["raw_order"])
        self.assertEqual(list(normalized["races"]),FIXTURE["normalized_order"])
        self.assertEqual({k:v for k,v in raw.items() if k!="races"},
                         {k:v for k,v in normalized.items() if k!="races"})
        for key,row in raw["races"].items():
            self.assertEqual(normalized["races"]["FL-special" if key=="FL" else key],row)
        self.assertEqual(normalized["counts"],raw["counts"])

    def test_strict_raw_rejection_and_only_order_preserving_key_changes(self):
        raw=self.raw();before=deepcopy(raw)
        self.assert_rejected_by_both(raw)
        normalized=normalize_primary_source(raw,PRIMARY_2026_SENATE_URL)
        self.assertEqual(raw,before)
        self.assert_only_key_changed(raw,normalized)
        self.assertEqual(validate_primary(normalized,"Senate",NOW)["positive_vote_races"],0)
        self.assertEqual(validate_soak(normalized,"Senate",NOW)["reporting_contests"],0)
        self.assertIs(normalize_primary_source(normalized,PRIMARY_2026_SENATE_URL),normalized)
        normalized["races"]["FL-special"]["cands"][0]["v"]=777
        self.assertEqual(raw,before,"Changed copy cannot mutate the original source")

    def test_exact_three_roster_is_order_independent_without_sorting_or_trimming(self):
        raw=self.raw()
        for order in itertools.permutations(raw["races"]["FL"]["cands"]):
            doc=self.raw();doc["races"]["FL"]["cands"]=list(order)
            result=normalize_primary_source(doc,PRIMARY_2026_SENATE_URL)
            self.assertEqual(result["races"]["FL-special"]["cands"],list(order))
            self.assertEqual(doc["races"]["FL"]["cands"],list(order))
        for field,value in (("n"," Ashley Moody"),("n","ashley moody"),("p"," R")):
            doc=self.raw();doc["races"]["FL"]["cands"][1][field]=value
            with self.assertRaises(ValueError):normalize_primary_source(doc,PRIMARY_2026_SENATE_URL)

    def test_numeric_JSON_equivalence_preserves_values_and_excludes_booleans(self):
        for api,year in ((1,2026),(1.0,2026),(1,2026.0),(1.0,2026.0)):
            doc=self.raw();doc.update(api=api,year=year)
            result=normalize_primary_source(doc,PRIMARY_2026_SENATE_URL)
            self.assertIsNot(result,doc)
            self.assert_only_key_changed(doc,result)
            self.assertIs(type(result["api"]),type(api))
            self.assertIs(type(result["year"]),type(year))
            self.assertEqual(validate_primary(result,"Senate",NOW)["positive_vote_races"],0)
            self.assertEqual(validate_soak(result,"Senate",NOW)["reporting_contests"],0)
        for field in ("api","year"):
            for value in (True,False):
                doc=self.raw();doc[field]=value
                self.assertIs(normalize_primary_source(doc,PRIMARY_2026_SENATE_URL),doc)
                self.assert_rejected_by_both(doc)

    def test_non_target_contexts_remain_raw_and_integrated_validation_rejects(self):
        contexts=[("api",2),("api",True),("year",2024),("office","House"),
                  ("office","Governor"),("source",""),("source",None),("source","STATE")]
        for key,value in contexts:
            doc=self.raw();doc[key]=value;before=deepcopy(doc)
            self.assertIs(normalize_primary_source(doc,PRIMARY_2026_SENATE_URL),doc)
            self.assertEqual(doc,before);self.assert_rejected_by_both(doc)
        for url in (PRIMARY_2026_SENATE_URL+"&extra=1",
                    "https://openamerica.io/elections/results.json?office=Senate&year=2026",
                    PRIMARY_2026_SENATE_URL.replace("2026","2024"),
                    PRIMARY_2026_SENATE_URL.replace("Senate","House"),
                    PRIMARY_2026_SENATE_URL.replace("https:","http:"),
                    PRIMARY_2026_SENATE_URL.replace("openamerica.io","other.example")):
            doc=self.raw();self.assertIs(normalize_primary_source(doc,url),doc)
            self.assert_rejected_by_both(doc)

    def test_dual_keys_always_fail_without_choosing_or_merging_values(self):
        for canonical in (deepcopy(self.raw()["races"]["FL"]),None,{},
                          {"total":999,"called":True,"winner":"D"}):
            doc=self.raw();doc["races"]["FL-special"]=canonical;doc["counts"]["races"]+=1
            before=deepcopy(doc)
            with self.assertRaisesRegex(ValueError,"Ambiguous"):
                normalize_primary_source(doc,PRIMARY_2026_SENATE_URL)
            self.assertEqual(doc,before)

    def test_malformed_unknown_missing_or_duplicate_rosters_fail_closed(self):
        changes=[None,{},[],{"cands":{}},{"cands":[]},{"cands":[None]*3}]
        for value in changes:
            doc=self.raw();doc["races"]["FL"]=value
            with self.assertRaises(ValueError):normalize_primary_source(doc,PRIMARY_2026_SENATE_URL)
        for mode in ("missing","extra","duplicate","wrong_name","wrong_party","swapped_party","n_list","p_list"):
            doc=self.raw();cands=doc["races"]["FL"]["cands"]
            if mode=="missing":cands.pop()
            elif mode=="extra":cands.append({"n":"Unverified additional candidate","p":"O","v":0,"pct":None})
            elif mode=="duplicate":cands[2]=deepcopy(cands[0])
            elif mode=="wrong_name":cands[0]["n"]="Unverified other election candidate"
            elif mode=="wrong_party":cands[0]["p"]="O"
            elif mode=="swapped_party":cands[0]["p"],cands[1]["p"]=cands[1]["p"],cands[0]["p"]
            elif mode=="n_list":cands[0]["n"]=[]
            else:cands[0]["p"]=[]
            before=deepcopy(doc)
            with self.assertRaises(ValueError):normalize_primary_source(doc,PRIMARY_2026_SENATE_URL)
            self.assertEqual(doc,before);self.assert_rejected_by_both(doc)

    def test_mapping_preserves_independent_counter_values_and_every_safety_rejection(self):
        doc=self.raw();row=doc["races"]["FL"]
        row["total"]=6
        for candidate,count in zip(row["cands"],(1,2,3)):candidate["v"]=count
        normalized=normalize_primary_source(doc,PRIMARY_2026_SENATE_URL)
        self.assert_only_key_changed(doc,normalized)
        self.assertEqual(validate_primary(normalized,"Senate",NOW)["positive_vote_races"],1)
        self.assertEqual(validate_soak(normalized,"Senate",NOW)["reporting_contests"],1)
        variants=[]
        for field,value in (("called",True),("winner","Ashley Moody"),("total",5),("total",True)):
            bad=deepcopy(doc);bad["races"]["FL"][field]=value;variants.append(bad)
        for field,value in (("v",-1),("v",True),("v","2")):
            bad=deepcopy(doc);bad["races"]["FL"]["cands"][1][field]=value;variants.append(bad)
        for field in ("is_test","test","mock","is_mock"):
            bad=deepcopy(doc);bad[field]=True;variants.append(bad)
        for field,value in (("active",False),("stale",True),("live",False),
                            ("as_of","not a timestamp"),("as_of","2026-11-04T02:00:00Z"),
                            ("as_of","2026-11-03T20:00:00Z")):
            bad=deepcopy(doc);bad[field]=value;variants.append(bad)
        bad=deepcopy(doc);bad["counts"]["races"]+=1;variants.append(bad)
        for bad in variants:
            result=normalize_primary_source(bad,PRIMARY_2026_SENATE_URL)
            self.assertEqual(result["races"]["FL-special"],bad["races"]["FL"])
            self.assert_rejected_by_both(result)

    def test_premature_florida_positive_remains_rejected(self):
        doc=self.raw();doc["as_of"]="2026-11-03T23:59:09Z"
        doc["races"]["FL"]["total"]=2
        doc["races"]["FL"]["cands"][1]["v"]=1
        doc["races"]["FL"]["cands"][2]["v"]=1
        now=dt.datetime(2026,11,3,23,59,27,tzinfo=dt.timezone.utc)
        normalized=normalize_primary_source(doc,PRIMARY_2026_SENATE_URL)
        self.assert_rejected_by_both(normalized,now)
        # Counts use earliest local close; they are not winner-call evidence.
        doc["as_of"]="2026-11-04T00:37:09Z"
        now=dt.datetime(2026,11,4,0,37,27,tzinfo=dt.timezone.utc)
        normalized=normalize_primary_source(doc,PRIMARY_2026_SENATE_URL)
        self.assertIs(normalized["races"]["FL-special"]["called"],False)
        self.assertEqual(validate_primary(normalized,"Senate",now)["positive_vote_races"],1)
        self.assertEqual(validate_soak(normalized,"Senate",now)["reporting_contests"],1)

    def test_both_known_fetch_boundaries_map_the_same_fake_response_once(self):
        raw=self.raw();body=json.dumps(raw).encode();responses=[];calls=[]
        def opener(request,timeout):
            calls.append((request.full_url,timeout));response=FakeResponse(body,encoding="gzip")
            responses.append(response);return response
        first=fetch(2026,"Senate",opener=opener)
        self.assertEqual(calls,[(PRIMARY_2026_SENATE_URL,25)])
        self.assertEqual(responses[0].read_limits,[2500001])
        calls.clear();responses.clear()
        def plain(request,timeout):
            calls.append((request.full_url,timeout));response=FakeResponse(body);responses.append(response);return response
        with patch("urllib.request.urlopen",side_effect=plain):second=fetch_json(PRIMARY_2026_SENATE_URL)
        self.assertEqual(calls,[(PRIMARY_2026_SENATE_URL,16)])
        self.assertEqual(responses[0].read_limits,[2000001])
        self.assertEqual(first,second)
        self.assert_only_key_changed(raw,first)
        validate_primary(first,"Senate",NOW);validate_soak(first,"Senate",NOW)

    def test_fetch_origin_CORS_and_unknown_roster_guards_are_not_bypassed(self):
        raw=self.raw();body=json.dumps(raw).encode()
        for url in (PRIMARY_2026_SENATE_URL.replace("https:","http:"),
                    PRIMARY_2026_SENATE_URL.replace("openamerica.io","other.example")):
            with self.assertRaises(ValueError):fetch(2026,"Senate",opener=lambda req,timeout:FakeResponse(body,url=url))
            with patch("urllib.request.urlopen",return_value=FakeResponse(body,url=url)):
                with self.assertRaises(ValueError):fetch_json(PRIMARY_2026_SENATE_URL)
        with self.assertRaises(AssertionError):fetch(2026,"Senate",opener=lambda req,timeout:FakeResponse(body,cors="https://other.example"))
        with patch("urllib.request.urlopen",return_value=FakeResponse(body,cors="https://other.example")):
            with self.assertRaises(ValueError):fetch_json(PRIMARY_2026_SENATE_URL)
        raw["races"]["FL"]["cands"][0]["n"]="Wrong election candidate";body=json.dumps(raw).encode()
        with self.assertRaises(ValueError):fetch(2026,"Senate",opener=lambda req,timeout:FakeResponse(body))
        with patch("urllib.request.urlopen",return_value=FakeResponse(body)):
            with self.assertRaises(ValueError):fetch_json(PRIMARY_2026_SENATE_URL)

    def test_no_other_special_key_or_source_row_is_inferred(self):
        doc=self.raw();doc["races"]["OH"]={"total":0,"called":False,"winner":"","pct_in":0,"cands":[]}
        doc["counts"]["races"]+=1
        result=normalize_primary_source(doc,PRIMARY_2026_SENATE_URL)
        self.assertIn("OH",result["races"]);self.assertNotIn("OH-special",result["races"])
        self.assertEqual(result["races"]["OH"],doc["races"]["OH"])
        self.assertEqual(result["counts"],doc["counts"])
        self.assert_rejected_by_both(result)

if __name__=="__main__":unittest.main()
