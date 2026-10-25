#!/usr/bin/env python3
import copy
import hashlib
import unittest

from nc_official_zip_observation_journal import (
    append, record, SCHEMA, SOURCE, MAX_OBSERVATIONS,
)


def sample(sha, when, d=60, r=40, counties=None):
    return {
        "schema": "nc-official-candidate-votes-v1",
        "election_date": "2026-11-03", "state": "NC",
        "office": "Senate", "race_key": "NC-SEN",
        "source": {"url": SOURCE, "sha256": sha,
                   "archive_member": "results_pct_20261103.txt"},
        "archive_checked_at": when, "ballots_reported": None,
        "reporting_fraction": None, "may_move_national_needle": False,
        "counties": counties if counties is not None else [
            {"county_id": "37183", "candidates": [
                {"name": "Candidate A", "party": "DEM", "votes": d},
                {"name": "Candidate B", "party": "REP", "votes": r},
                {"name": "Candidate C", "party": "LIB", "votes": 2},
            ]},
        ],
    }


A = "a" * 64
B = "b" * 64
C = "c" * 64
T = "2026-11-04T01:00:00Z"
T2 = "2026-11-04T01:10:00Z"
T3 = "2026-11-04T01:20:00Z"


class HistoryTests(unittest.TestCase):
    def test_first_and_successive_changed_zip(self):
        first = sample(A, T)
        created = append(None, None, first)
        self.assertEqual(created["status"], "APPENDED")
        self.assertEqual(created["journal"]["schema"], SCHEMA)
        self.assertFalse(created["journal"]["ballot_denominator_available"])
        self.assertFalse(created["journal"]["may_move_national_needle"])
        self.assertEqual(created["journal"]["observations"][0]["counties"],
                         [["37183", 60, 40, 2]])
        self.assertIsNone(created["journal"]["observations"][0]["source_reported_at"])
        second = sample(B, T2, 70, 48)
        renewed = append(created["journal"], first, second)
        self.assertEqual(renewed["status"], "APPENDED")
        self.assertEqual(len(renewed["journal"]["observations"]), 2)
        self.assertEqual(renewed["journal"]["observations"][0]["archive_sha256"], A)
        self.assertEqual(renewed["journal"]["observations"][1]["archive_sha256"], B)
        again = append(renewed["journal"], second, sample(B, T3, 70, 48))
        self.assertEqual(again["status"], "NO_NEW_ARCHIVE")
        self.assertEqual(len(again["journal"]["observations"]), 2)
        with self.assertRaisesRegex(ValueError, "out of order"):
            append(renewed["journal"], second, sample(A, T3))

    def test_rejects_provenance_ballots_future_and_duplicate_county(self):
        good = sample(A, T)
        for field, value in [
            ("race_key", "NC-GOV"),
            ("ballots_reported", 102),
            ("reporting_fraction", 0.1),
            ("may_move_national_needle", True),
            ("archive_checked_at", "2026-11-04T00:29:59Z"),
        ]:
            with self.subTest(field):
                bad = copy.deepcopy(good)
                bad[field] = value
                with self.assertRaises(ValueError):
                    record(bad)
        bad = copy.deepcopy(good)
        bad["counties"].append(copy.deepcopy(bad["counties"][0]))
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            record(bad)
        bad = copy.deepcopy(good)
        bad["source"]["sha256"] = "unapproved"
        with self.assertRaises(ValueError):
            record(bad)

    def test_journal_vs_published_previous_must_match(self):
        before = sample(A, T)
        archive = append(None, None, before)["journal"]
        changed = sample(B, T2, 70, 50)
        with self.assertRaisesRegex(ValueError, "disagree"):
            append(archive, sample(A, T, 65, 40), changed)
        with self.assertRaisesRegex(ValueError, "non-increasing"):
            append(archive, before, sample(B, T, 70, 50))
        with self.assertRaisesRegex(ValueError, "needs manual review"):
            append(archive, before, sample(B, T2, 59, 50))
        with self.assertRaisesRegex(ValueError, "Different votes"):
            append(archive, before, sample(A, T2, 70, 50))

    def test_missing_county_and_tampered_journal(self):
        rows = [{"county_id": k, "candidates": [
            {"name": "A", "party": "DEM", "votes": 40},
            {"name": "B", "party": "REP", "votes": 50},
        ]} for k in ["37001", "37183"]]
        before = sample(A, T, counties=rows)
        archive = append(None, None, before)["journal"]
        with self.assertRaisesRegex(ValueError, "disappeared"):
            append(archive, before, sample(B, T2))
        wrong = copy.deepcopy(archive)
        wrong["observations"][0]["source_reported_at"] = T
        with self.assertRaisesRegex(ValueError, "unsupported fields"):
            append(wrong, before, sample(B, T2, counties=rows))
        wrong = copy.deepcopy(archive)
        wrong["observations"][0]["counties"] = [["37001", 40, 50, 0], ["37001", 40, 50, 0]]
        with self.assertRaisesRegex(ValueError, "Duplicate or unordered"):
            append(wrong, before, sample(B, T2, counties=rows))

    def test_hourly_recheck_is_not_a_new_vote_release(self):
        original = sample(A, T)
        recorded = append(None, None, original)["journal"]
        rechecked = sample(A, T2)
        later = append(recorded, rechecked, sample(B, T3, 66, 43))
        self.assertEqual(later["status"], "APPENDED")
        self.assertEqual(len(later["journal"]["observations"]), 2)
        self.assertEqual(later["journal"]["observations"][0]["archive_retrieved_at"], T,
                         "Earlier retrieval observations must never be rewritten")

    def test_backfill_previous_and_reject_nonfactual_clock(self):
        first = sample(A, T)
        second = sample(B, T2, 61, 42)
        result = append(None, first, second)
        self.assertEqual(len(result["journal"]["observations"]), 2)
        bad = sample(B, T2, 61, 42)
        bad["archive_checked_at"] = "2026-11-04T01:10:00+00:00"
        with self.assertRaisesRegex(ValueError, "explicit UTC"):
            record(bad)


if __name__ == "__main__":
    unittest.main()
