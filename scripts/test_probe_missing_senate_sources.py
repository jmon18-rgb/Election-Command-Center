#!/usr/bin/env python3
import datetime as dt
import unittest
from probe_missing_senate_sources import discover_one, run, TARGETS

NOW = dt.datetime(2026, 10, 24, 12, 0, tzinfo=dt.timezone.utc)
AFTER = dt.datetime(2026, 11, 4, 3, 0, tzinfo=dt.timezone.utc)

def row(state="MA", **updates):
    base = {"country": "US", "province": state, "municipality": None,
            "district": None, "election_date": "2026-11-03",
            "election_name": TARGETS[state], "type": "US Senate",
            "election_type": "General", "id": 1234}
    return dict(base, **updates)

def detail(state="MA", votes=0, **updates):
    doc = row(state)
    doc["election_type"] = "US Senate"
    doc["candidates"] = [{"name": "Candidate A", "party": "D", "votes": votes},
                         {"name": "Candidate B", "party": "R", "votes": 0}]
    return dict(doc, **updates)

def provider(state="MA", rows=None, candidate=None, fail=False):
    source_row = row(state)
    if rows is None:
        rows = [source_row]
    if candidate is None:
        candidate = detail(state)
    def request(endpoint, params):
        if fail:
            raise RuntimeError("503")
        if endpoint == "/race/search":
            assert params["province"] == state
            assert params["startDate"] == "2026-11-03"
            return {"races": rows, "count": len(rows)}
        if endpoint == "/race/1234":
            return candidate
        raise ValueError("Unexpected request")
    return request

class Tests(unittest.TestCase):
    def test_two_states_require_review(self):
        for state in TARGETS:
            out = discover_one(state, provider(state), NOW)
            self.assertEqual(out["status"],
                             "EXACT_IDENTITY_CANDIDATE_NEEDS_MANUAL_REVIEW")
            self.assertFalse(out["is_live_vote_approval"])
            self.assertEqual(out["race_id_hint"], 1234)
            self.assertNotIn("votes", out)
        out = run(lambda endpoint,params:
                  provider(params["province"])(endpoint,params), NOW)
        self.assertEqual(len(out["races"]), 2)
        self.assertFalse(out["automatic_source_approval"])

    def test_absent_ambiguous_and_partial(self):
        self.assertEqual(discover_one("MA",provider(rows=[]),NOW)["status"],
                         "NOT_INDEXED_EXACT_RACE_AT_CHECK_TIME")
        self.assertEqual(discover_one("MA",provider(rows=[row(),row()]),NOW)["status"],
                         "AMBIGUOUS_SOURCE_IDENTITY")
        self.assertEqual(discover_one("MA",provider(rows=[row(election_date="2024-11-05")]),NOW)["status"],
                         "NOT_INDEXED_EXACT_RACE_AT_CHECK_TIME")
        self.assertEqual(discover_one("MA",provider(rows=[row(election_type="Primary")]),NOW)["status"],
                         "NOT_INDEXED_EXACT_RACE_AT_CHECK_TIME")
        self.assertEqual(discover_one("MA",provider(rows=[row(province="MS")]),NOW)["status"],
                         "NOT_INDEXED_EXACT_RACE_AT_CHECK_TIME")

    def test_both_senate_canaries_reject_partial_source_and_mock(self):
        from probe_missing_senate_sources import POLL_CLOSE_UTC
        self.assertEqual(POLL_CLOSE_UTC["MA"],"2026-11-04T01:00:00+00:00",
            "MA 8 PM EST must close at 01:00 UTC, not midnight UTC")
        for state in TARGETS:
            for count in (0,2,20,-1,True,1.5,"1"):
                def truncated(endpoint,params):
                    self.assertEqual(endpoint,"/race/search")
                    return {"races":[row(state)],"count":count}
                with self.subTest(state=state,count=count):
                    self.assertEqual(discover_one(state,truncated,NOW)["status"],
                                     "INVALID_OR_PARTIAL_SOURCE_SEARCH")
            for flag in ("is_test","test","mock","is_mock"):
                with self.subTest(state=state,flag=flag):
                    self.assertEqual(discover_one(state,
                        provider(state,rows=[row(state,**{flag:True})]),NOW)["status"],
                        "NOT_INDEXED_EXACT_RACE_AT_CHECK_TIME")
                    self.assertEqual(discover_one(state,
                        provider(state,candidate=detail(state,**{flag:True})),NOW)["status"],
                        "INVALID_SOURCE_DETAIL")
            for corruptDate in (
                "2026-11-03T99:00:00Z","2026-11-03T04:00:00",
                "2026-11-03T04:00:00Zextra","2026-11-03T04:00:00+99:00"
            ):
                self.assertEqual(discover_one(state,provider(state,
                    rows=[row(state,election_date=corruptDate)]),NOW)["status"],
                    "NOT_INDEXED_EXACT_RACE_AT_CHECK_TIME")
            self.assertEqual(discover_one(state,provider(state,
                candidate=detail(state,candidates=[
                    {"name":" Same Person ","party":"D","votes":0},
                    {"name":"same person","party":"R","votes":0}
                ])),NOW)["status"],"DUPLICATE_CANDIDATE")
            self.assertEqual(discover_one(state,provider(state,
                candidate=detail(state,candidates=[
                    {"name":"First","party":"D","votes":2**53-1},
                    {"name":"Second","party":"R","votes":1}
                ])),AFTER)["status"],"INVALID_CANDIDATE_STRUCTURE")
        from datetime import timedelta
        at=dt.datetime(2026,11,4,0,30,tzinfo=dt.timezone.utc)
        self.assertEqual(discover_one("MA",
            provider(candidate=detail(votes=9)),at)["status"],
            "PRE_POLL_CLOSE_VOTES_UNSAFE_MOCK_OR_ERROR")
        self.assertEqual(discover_one("MA",
            provider(candidate=detail(candidates=[
                {"name":"A","party":"D","votes":0,"winner":True},
                {"name":"B","party":"R","votes":0,"winner":False}
            ])),at)["status"],
            "PRE_POLL_CLOSE_VOTES_UNSAFE_MOCK_OR_ERROR")

    def test_fail_closed(self):
        self.assertEqual(discover_one("MA",provider(fail=True),NOW)["status"],
                         "SOURCE_UNAVAILABLE_OR_ERROR")
        self.assertEqual(discover_one("MA",provider(candidate=detail(election_name="Wrong")),NOW)["status"],
                         "MISMATCHED_SOURCE_DETAIL")
        self.assertEqual(discover_one("MA",provider(candidate=detail(candidates=[])),NOW)["status"],
                         "INVALID_CANDIDATE_STRUCTURE")
        self.assertEqual(discover_one("MA",provider(candidate=detail(votes=9)),NOW)["status"],
                         "PRE_POLL_CLOSE_VOTES_UNSAFE_MOCK_OR_ERROR")
        self.assertEqual(discover_one("MA",provider(candidate=detail(votes=9)),AFTER)["status"],
                         "EXACT_IDENTITY_CANDIDATE_NEEDS_MANUAL_REVIEW")
        self.assertEqual(discover_one("MS",provider("MS",candidate=detail("MS",votes=3)),NOW)["status"],
                         "PRE_POLL_CLOSE_VOTES_UNSAFE_MOCK_OR_ERROR")
        candidates=detail()["candidates"]
        self.assertEqual(discover_one("MA",provider(candidate=detail(
            candidates=[candidates[0],candidates[0]])),NOW)["status"],
            "DUPLICATE_CANDIDATE")

if __name__ == "__main__":
    unittest.main()
