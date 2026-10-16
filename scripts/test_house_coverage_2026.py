#!/usr/bin/env python3
"""Deterministic source-discovery contract tests; no real HTTP requests."""
import unittest
import json
import tempfile
from pathlib import Path
from datetime import datetime, timezone, timedelta
from probe_house_coverage_2026 import (
    matches, detail_matches, probe, DISTRICTS, PRIMARY_STATES,
    ROTATING_PER_RUN, uncovered_house_universe, sampling_window,
)


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

    def test_full_435_apportionment_and_uncovered_states(self):
        seats = uncovered_house_universe()
        self.assertTrue(set(DISTRICTS).issubset(seats))
        self.assertEqual(len(seats), len(set(seats)))
        self.assertEqual(len(PRIMARY_STATES), 22)
        self.assertIn("AK-00", seats)
        self.assertIn("ND-00", seats)
        self.assertIn("WY-00", seats)
        self.assertNotIn("AZ-01", seats)
        self.assertTrue(all(code[:2] not in PRIMARY_STATES for code in seats))
        self.assertGreater(len(seats), 100)
        self.assertLess(len(seats), 435)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "bad.json"
            path.write_text(json.dumps({"house": {"total_voting_seats": 435,
                                                    "by_state": {"MA": 9}}}),
                            encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "435-seat"):
                uncovered_house_universe(path)

    def test_rotating_coverage_is_deterministic_and_complete_across_windows(self):
        seats = uncovered_house_universe()
        unanchored = set(seats) - set(DISTRICTS)
        t = datetime(2026, 10, 16, 0, 0, tzinfo=timezone.utc)
        first = sampling_window(t, inventory=seats)
        self.assertEqual(first["anchor_count"], 6)
        self.assertEqual(first["rotating_count"], ROTATING_PER_RUN)
        self.assertEqual(len(first["districts"]), 6 + ROTATING_PER_RUN)
        self.assertEqual(len(first["districts"]), len(set(first["districts"])))
        self.assertEqual(first, sampling_window(t + timedelta(minutes=59),
                                                inventory=seats))
        covered = set()
        for window in range(first["windows_per_rotation"]):
            info = sampling_window(t + timedelta(hours=4 * window),
                                   inventory=seats)
            self.assertEqual(info["districts"][:6], DISTRICTS)
            self.assertEqual(len(info["districts"]), len(set(info["districts"])))
            covered.update(info["districts"][6:])
        self.assertEqual(covered, unanchored,
                         "The rotation must reach every unanchored House seat")
        self.assertEqual(first["uncovered_house_districts"], len(seats))
        with self.assertRaisesRegex(ValueError, "timezone-aware"):
            sampling_window(datetime(2026, 10, 16), inventory=seats)
        with self.assertRaisesRegex(ValueError, "Invalid anchored"):
            sampling_window(t, inventory=seats, rotation=0)

    def test_at_large_2026_seats_can_be_discovered(self):
        alaska = dict(self.row, province="AK", district="AK-00",
                      election_name="Alaska US House At-Large")
        self.assertTrue(matches("AK-00", alaska))
        self.assertFalse(matches("AK-01", alaska))

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
