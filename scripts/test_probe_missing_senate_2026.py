#!/usr/bin/env python3
"""Offline fail-closed 2026 MA/MS supplemental Senate discovery cases."""
import unittest
from datetime import datetime, timezone
from probe_missing_senate_2026 import probe, check_detail

BEFORE = datetime(2026, 10, 23, 20, tzinfo=timezone.utc)
AFTER = datetime(2026, 11, 4, 1, 15, tzinfo=timezone.utc)


def record(state="MA", rid=87000, name=None):
    return {"country":"US", "province":state, "district":None,
            "municipality":None, "type":"US Senate", "election_type":"General",
            "election_date":"2026-11-03",
            "election_name":name or {"MA":"Massachusetts", "MS":"Mississippi"}[state]+" US Senate",
            "id":rid, "candidates":[]}


def details(row, votes=0, winner=False):
    return {"id":row["id"], "country":row["country"], "province":row["province"],
            "district":row["district"], "municipality":row["municipality"],
            "election_name":row["election_name"], "election_date":row["election_date"],
            "election_type":"US Senate",
            "candidates":[
                {"name":"Test Democrat", "party":"Democratic", "votes":votes,
                 "winner":winner},
                {"name":"Test Republican", "party":"Republican", "votes":0,
                 "winner":False}
            ]}


def provider(rows, detail, count=None):
    def fetch(path, params=None):
        if path=="/race/search":
            return {"count":len(rows) if count is None else count,
                    "races":rows}
        if path.startswith("/race/"):
            return detail
        raise AssertionError("Unexpected endpoint")
    return fetch


class ProbeTests(unittest.TestCase):
    def test_approved_identity_is_review_only_and_no_votes(self):
        row=record()
        result=probe("MA",provider([row],details(row)),BEFORE)
        self.assertEqual(result["status"],"REVIEW_CANDIDATE_SOURCE_ID_NOT_APPROVED")
        self.assertTrue(result["source_identity_verified"])
        self.assertFalse(result["approved_for_2026_results"])
        self.assertFalse(result["live_votes_verified"])
        self.assertNotIn("votes",result)
        self.assertEqual(result["race_id"],87000)

    def test_both_states_use_strict_identity(self):
        ms=record("MS",87001)
        self.assertTrue(check_detail(ms,details(ms),"MS",BEFORE))
        self.assertEqual(probe("MS",provider([ms],details(ms)),BEFORE)["race_id"],87001)
        self.assertEqual(probe("MA",provider([ms],details(ms)),BEFORE)["status"],"NOT_INDEXED")

    def test_unindexed_not_counted(self):
        self.assertEqual(probe("MA",provider([],{}),BEFORE)["status"],"NOT_INDEXED")

    def test_ambiguous_or_partial_results_fail_closed(self):
        row=record()
        self.assertEqual(probe("MA",provider([row,row],details(row)),BEFORE)["status"],
                         "AMBIGUOUS_IDENTITY")
        self.assertEqual(probe("MA",provider([row],details(row),25),BEFORE)["status"],
                         "SEARCH_INCOMPLETE_OR_INVALID")

    def test_wrong_date_stage_district_name_or_detail(self):
        row=record()
        for key,value in [("election_date","2024-11-05"),
                          ("election_type","Primary"),("district","MA-01"),
                          ("election_name","Massachusetts US Senate Primary"),
                          ("id",None)]:
            changed={**row,key:value}
            self.assertEqual(probe("MA",provider([changed],details(row)),BEFORE)["status"],
                             "NOT_INDEXED",key)
        bad={**details(row),"province":"MS"}
        self.assertEqual(probe("MA",provider([row],bad),BEFORE)["status"],
                         "DETAIL_UNVERIFIED_OR_PREPOLL_MOCK")

    def test_prepoll_positive_votes_and_calls_rejected(self):
        row=record()
        for detail in [details(row,votes=12000),details(row,winner=True),
                       {**details(row),"candidates":[
                        {"name":"A","party":"D","votes":1,"winner":False},
                        {"name":"A","party":"D","votes":1,"winner":False}]}]:
            self.assertEqual(probe("MA",provider([row],detail),BEFORE)["status"],
                             "DETAIL_UNVERIFIED_OR_PREPOLL_MOCK")
        self.assertTrue(check_detail(row,details(row,votes=10),"MA",AFTER))
        self.assertFalse(probe("MA",provider([row],details(row,votes=10)),AFTER)[
            "approved_for_2026_results"])

    def test_source_errors_remain_unavailable(self):
        def outage(*args,**kwargs):
            raise OSError("Synthetic provider outage")
        result=probe("MS",outage,BEFORE)
        self.assertEqual(result["status"],"SOURCE_UNAVAILABLE")
        self.assertNotIn("race_id",result)
        with self.assertRaises(ValueError):
            probe("NH",outage,BEFORE)


if __name__=="__main__":
    unittest.main()
