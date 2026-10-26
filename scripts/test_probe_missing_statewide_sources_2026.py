#!/usr/bin/env python3
"""Offline adversarial identity checks; never requests the real vote provider."""
import unittest
from datetime import datetime, timezone

from probe_missing_statewide_sources_2026 import SPECS, CLOSE_UTC, exact, validate_detail, detail_rejection, probe

def row(state, office, race_id):
    kind = "US Senate" if office == "Senate" else "Governor"
    return {
        "id": race_id, "country": "US", "province": state,
        "district": None, "municipality": None,
        "type": kind, "election_type": "General" if office == "Senate" else "Statewide",
        "election_date": "2026-11-03T05:00:00.000Z",
        "election_name": state + " " + kind,
        "candidates": [],
    }

def detail(record):
    return {**record, "election_type": record["type"],
            "candidates": [
                {"name": "D", "party": "Democratic", "votes": 0, "winner": False},
                {"name": "R", "party": "Republican", "votes": 0, "winner": False},
            ]}

class GapProbeTests(unittest.TestCase):
    def setUp(self):
        self.rows = {state: row(state, office, 88000+i)
                     for i, (state, office, _) in enumerate(SPECS)}
        self.requests = []
        self.unavailable = set()
        self.duplicates = set()
        self.malformed = set()

    def fetch(self, path, params):
        self.requests.append((path, params))
        if path == "/race/search":
            state = params["province"]
            if state in self.unavailable:
                raise TimeoutError("Fake upstream unavailable")
            found = [self.rows[state]]
            if state in self.duplicates:
                found.append({**self.rows[state], "id": self.rows[state]["id"]+100})
            return {"races": found, "count": len(found)}
        race_id = int(path.split("/")[-1])
        matches = [v for v in self.rows.values() if v["id"] == race_id]
        assert matches
        item = detail(matches[0])
        if matches[0]["province"] in self.malformed:
            item["district"] = matches[0]["province"] + "-01"
        return item

    def test_all_four_exact_and_no_vote_promotion(self):
        result = probe(self.fetch, datetime(2026, 10, 24, tzinfo=timezone.utc))
        self.assertEqual(result["checked"], 4)
        self.assertEqual(result["exact_matches"], 4)
        self.assertEqual(set(x["race"] for x in result["records"]),
                         {"Senate|MA", "Senate|MS", "Governor|HI", "Governor|OK"})
        self.assertTrue(result["identity_only_not_voting_results"])
        self.assertFalse(result["may_publish_live_votes"])
        self.assertFalse(result["may_update_model_or_source_pins"])
        self.assertEqual(len(self.requests), 8)
        for entry in result["records"]:
            self.assertIs(type(entry["race_id"]), int)
            self.assertNotIn("votes", entry)
            self.assertNotIn("called", entry)
        for path, params in self.requests:
            if path == "/race/search":
                self.assertEqual(params["startDate"], "2026-11-03")
                self.assertEqual(params["endDate"], "2026-11-03")
                self.assertEqual(params["limit"], 20)

    def test_absent_or_transient_not_false_zero(self):
        self.unavailable.add("MA")
        self.duplicates.add("HI")
        self.malformed.add("OK")
        result = probe(self.fetch)
        states = {x["race"]: x for x in result["records"]}
        self.assertEqual(states["Senate|MA"]["status"], "PROVIDER_UNAVAILABLE")
        self.assertEqual(states["Governor|HI"]["status"], "AMBIGUOUS_EXACT_RACE")
        self.assertEqual(states["Governor|OK"]["status"], "INVALID_OR_MISMATCHED_DETAIL")
        self.assertIsNone(states["Senate|MA"]["race_id"])
        self.assertIsNone(states["Governor|HI"]["race_id"])
        self.assertEqual(result["exact_matches"], 1)
        self.assertFalse(result["may_publish_live_votes"])

    def test_provider_detail_may_omit_repeat_id_but_mismatch_is_fatal(self):
        # civicAPI search ID + URL + all six independent identity fields
        # identify the race. Historical verified Senate preflight already
        # allows detail responses that omit the duplicate id property.
        for spec in SPECS:
            state, _, _ = spec
            original = self.rows[state]
            raw = detail(original)
            raw.pop("id")
            self.assertTrue(validate_detail(spec, original, raw))
            self.assertIsNone(detail_rejection(spec, original, raw))
            self.assertEqual(detail_rejection(spec, original,
                {**raw, "id": original["id"]+100}),
                "DETAIL_EXPLICIT_ID_MISMATCH")
            self.assertEqual(detail_rejection(spec, original,
                {**raw, "election_type": "wrong type"}),
                "DETAIL_OFFICE_CLASS_MISMATCH")

    def test_exact_missing_id_can_be_discovered_without_auto_approval(self):
        def omit_repeated_ids(path, params):
            answer=self.fetch(path, params)
            if path.startswith("/race/") and path!="/race/search":
                answer.pop("id", None)
            return answer
        result=probe(omit_repeated_ids,datetime(2026,10,24,tzinfo=timezone.utc))
        self.assertEqual(result["exact_matches"],4)
        self.assertFalse(result["may_publish_live_votes"])
        self.assertFalse(result["may_update_model_or_source_pins"])
        self.assertTrue(all(r["status"]=="INDEXED_EXACT_RACE_IDENTITY_ONLY"
                            for r in result["records"]))

    def test_precise_rejection_reason_and_preclose_sample_safety(self):
        self.malformed.add("OK")
        result=probe(self.fetch,datetime(2026,10,24,tzinfo=timezone.utc))
        ok=next(r for r in result["records"] if r["race"]=="Governor|OK")
        self.assertEqual(ok["reason"],"DETAIL_DISTRICT_MISMATCH")
        self.assertIsNone(ok["race_id"])
        for spec in SPECS:
            state, _, _ = spec
            self.assertEqual(CLOSE_UTC[state].tzinfo,timezone.utc)
            raw=detail(self.rows[state])
            raw["candidates"][0]["votes"]=1
            before=CLOSE_UTC[state].replace(microsecond=0)
            from datetime import timedelta
            self.assertEqual(detail_rejection(spec,self.rows[state],raw,
                                               now=before-timedelta(seconds=1)),
                             "PRE_POLL_CLOSE_COUNTED_OR_CALLED_NOT_LIVE")
            self.assertIsNone(detail_rejection(spec,self.rows[state],raw,now=before))

    def test_incomplete_search_page_cannot_authorize_statewide_source_id(self):
        # A total of two with only one returned page is NOT uniqueness.
        # Candidate details must not be requested at all for a truncated
        # search, even when the visible row matches precisely.
        for bad_count in (0, 2, 20, 21, -1, True, 1.5, "1"):
            with self.subTest(count=bad_count):
                calls=[]
                def truncated(path, params):
                    calls.append(path)
                    if path=="/race/search":
                        return {"races":[self.rows[params["province"]]],
                                "count":bad_count}
                    raise AssertionError("Detail called for incomplete search")
                response=probe(truncated,datetime(2026,10,24,tzinfo=timezone.utc))
                self.assertEqual(response["exact_matches"],0)
                self.assertEqual(len(calls),4)
                self.assertTrue(all(v["status"]=="INVALID_OR_TRUNCATED_SEARCH"
                                    and v["race_id"] is None for v in response["records"]))
                self.assertFalse(response["may_update_model_or_source_pins"])
        no_count=probe(lambda path,params:
                       {"races":[self.rows[params["province"]]]}
                       if path=="/race/search" else detail(
                           self.rows[next(s for s in self.rows
                             if self.rows[s]["id"] == int(path.split("/")[-1]))]),
                       datetime(2026,10,24,tzinfo=timezone.utc))
        self.assertEqual(no_count["exact_matches"],4,
                         "Missing optional count keeps exact search/detail verification")

    def test_forged_statewide_detail_and_mock_rows_fail_closed(self):
        one=SPECS[0]
        original=self.rows["MA"]
        valid=detail(original)
        for flag in ("test_data","is_test","test","mock","is_mock"):
            with self.subTest(flag=flag):
                self.assertFalse(exact(one,{**original,flag:True}))
                self.assertEqual(detail_rejection(one,original,
                                  {**valid,flag:True}),"MOCK_OR_INACTIVE_DETAIL")
        self.assertFalse(exact(one,{**original,"active":False}))
        self.assertEqual(detail_rejection(one,original,{**valid,"active":False}),
                         "MOCK_OR_INACTIVE_DETAIL")
        self.assertTrue(exact(one,{**original,"mock":False,"active":True}))
        self.assertIsNone(detail_rejection(one,original,
                          {**valid,"mock":False,"active":True}))
        for corrupt in (
            "2026-11-03T99:99:99Z","2026-11-03T05:99:00Z",
            "2026-11-03T05:00:00+99:00",
            "2026-11-03T05:00:00","2026-11-03T05:00:00Zextra",
            "2026-11-03T05:00:00.123garbage",
        ):
            with self.subTest(date=corrupt):
                self.assertFalse(exact(one,{**original,"election_date":corrupt}))
        for candidate_mod in (
            [{**valid["candidates"][0],"votes":2**53},
             valid["candidates"][1]],
            [{**valid["candidates"][0],"votes":2**53-1},
             {**valid["candidates"][1],"votes":1}],
            [{**valid["candidates"][0],"name":" SAME HUMAN ","party":"D"},
             {**valid["candidates"][1],"name":"same human","party":"R"}],
            [{**valid["candidates"][0],"mock":True},
             valid["candidates"][1]],
        ):
            with self.subTest(candidates=candidate_mod):
                self.assertIsNotNone(detail_rejection(one,original,
                                     {**valid,"candidates":candidate_mod}))
        # Different people in a top-two same-party general race are valid;
        # source identity does not presume the party determines uniqueness.
        top_two=detail(original)
        top_two["candidates"][1]["party"]="Democratic"
        self.assertIsNone(detail_rejection(one,original,top_two))

    def test_absent_election_is_unknown_not_a_negative_vote(self):
        def absent_fetch(path, params):
            self.assertEqual(path, "/race/search",
                             "No detail request is allowed for missing races")
            return {"races": [], "count": 0}
        result = probe(absent_fetch)
        self.assertEqual(result["checked"], 4)
        self.assertEqual(result["exact_matches"], 0)
        self.assertEqual([r["status"] for r in result["records"]],
                         ["NOT_INDEXED"] * 4)
        self.assertTrue(all(r["race_id"] is None for r in result["records"]))
        self.assertFalse(result["may_publish_live_votes"])
        self.assertFalse(result["may_update_model_or_source_pins"])

    def test_strict_identity_and_candidate_checks(self):
        original = self.rows["MA"]
        spec = SPECS[0]
        self.assertTrue(exact(spec, original))
        self.assertTrue(validate_detail(spec, original, detail(original)))
        for corrupt in [
            {**original, "province": "MS"},
            {**original, "municipality": "Boston"},
            {**original, "district": "MA-01"},
            {**original, "type": "Governor"},
            {**original, "election_date": "2026-11-03junk"},
            {**original, "election_date": "2024-11-05T05:00:00Z"},
            {**original, "election_type": "Primary"},
            {**original, "election_name": "Massachusetts US Senate Primary"},
            {**original, "election_name": "Massachusetts House"},
            {**original, "id": True},
        ]:
            self.assertFalse(exact(spec, corrupt), str(corrupt))
        valid = detail(original)
        for corrupt in [
            {**valid, "id": 99999},
            {**valid, "district": "MA-02"},
            {**valid, "election_type": "Governor"},
            {**valid, "candidates": []},
            {**valid, "candidates": [valid["candidates"][0]]*2},
            {**valid, "candidates": [{**valid["candidates"][0], "votes": -1},
                                      valid["candidates"][1]]},
        ]:
            self.assertFalse(validate_detail(spec, original, corrupt), str(corrupt))

if __name__ == "__main__":
    unittest.main()
