#!/usr/bin/env python3
"""Deterministic source-discovery contract tests; no real HTTP requests."""
import unittest
from probe_house_coverage_2026 import matches, detail_matches, probe, DISTRICTS


class HouseCoverageTests(unittest.TestCase):
    def setUp(self):
        self.row = dict(country="US", province="NH", municipality=None,
                        district="NH-01", type="House of Representatives",
                        election_type="General", election_date="2026-11-03T05:00:00.000Z",
                        election_name="New Hampshire US House 1", id=88001)
        self.detail = dict(self.row, election_type=self.row["type"],
                           candidates=[
                               dict(name="Example Democrat", party="Democratic",
                                    votes=0, winner=False),
                               dict(name="Example Republican", party="Republican",
                                    votes=0, winner=False),
                           ])

    def test_scope(self):
        self.assertEqual(len(DISTRICTS), 6)
        self.assertTrue(matches("NH-01", self.row))
        for changes in (
            dict(province="ME"), dict(district="NH-02"),
            dict(election_type="Primary"), dict(type="US Senate"),
            dict(election_name="New Hampshire US House 1 Primary"),
            dict(election_name="New Hampshire US House 2"),
            dict(election_date="2024-11-05T05:00:00Z"), dict(id=-1),
        ):
            self.assertFalse(matches("NH-01", dict(self.row, **changes)), changes)

    def test_exact_detail(self):
        self.assertTrue(detail_matches(self.row, self.detail))
        self.assertFalse(detail_matches(self.row, dict(self.detail, id=99001)))
        self.assertFalse(detail_matches(self.row, dict(self.detail,
                                                        district="NH-02")))
        self.assertFalse(detail_matches(self.row, dict(self.detail,
                                                        candidates=[])))
        self.assertFalse(detail_matches(self.row, dict(self.detail,
                                                        candidates=[{"name": "X", "party": "D",
                                                                     "votes": -1,
                                                                     "winner": False}])))

    def test_explicit_missing_and_ambiguity(self):
        self.assertEqual(probe("NH-01", lambda path, params: {"races": []})
                         ["status"], "NOT_INDEXED")
        self.assertEqual(probe("NH-01", lambda path, params: {"count": 40,
                                                              "races": [self.row]})
                         ["status"], "AMBIGUOUS_OR_TRUNCATED")
        self.assertEqual(probe("NH-01", lambda path, params: {"races": [
            self.row, self.row]})["status"], "AMBIGUOUS_RACE")

    def test_verified_record_and_outage(self):
        def fetch(path, params):
            return {"races": [self.row]} if path == "/race/search" else self.detail
        row = probe("NH-01", fetch)
        self.assertEqual(row["status"], "INDEXED_EXACT_RACE")
        self.assertEqual(row["race_id"], 88001)
        self.assertEqual(row["reported_votes"], 0)
        outage = probe("NH-01", lambda path, params: (_ for _ in ()).throw(
            TimeoutError("simulated outage")))
        self.assertEqual(outage["status"], "SOURCE_UNAVAILABLE_OR_INVALID")


if __name__ == "__main__":
    unittest.main()
