#!/usr/bin/env python3
"""Offline adversarial identity checks; never requests the real vote provider."""
import unittest
from datetime import datetime, timezone

from probe_missing_statewide_sources_2026 import SPECS, exact, validate_detail, probe

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
