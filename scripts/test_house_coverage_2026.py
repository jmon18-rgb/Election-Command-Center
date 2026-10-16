#!/usr/bin/env python3
"""Deterministic source-discovery contract tests; no real HTTP requests."""
import unittest
import json
import copy
import tempfile
import urllib.error
from pathlib import Path
from datetime import datetime, timezone, timedelta
from probe_house_coverage_2026 import (
    matches, detail_matches, probe, DISTRICTS, PRIMARY_STATES,
    ROTATING_PER_RUN, uncovered_house_universe, sampling_window,
    run_batch, build_report, gap_aware_window, GAP_AWARE_LIMIT,
    GAP_PRIORITY, COVERAGE_PATH,
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

    def test_gap_first_scheduled_inventory_prioritizes_unseen_races(self):
        ledger = json.loads(COVERAGE_PATH.read_text(encoding="utf-8"))
        now = datetime(2026, 10, 16, 20, 11, tzinfo=timezone.utc)
        plan = gap_aware_window(now, ledger)
        self.assertEqual(plan["discovery_strategy"], "GAP_FIRST_PREVIOUS_LEDGER")
        self.assertEqual(plan["request_cap"], GAP_AWARE_LIMIT)
        self.assertEqual(len(plan["districts"]), GAP_AWARE_LIMIT)
        self.assertEqual(len(set(plan["districts"])), GAP_AWARE_LIMIT)
        self.assertEqual(plan["never_checked_eligible"], 203)
        self.assertEqual(plan["scheduled_rechecks"], 0)
        self.assertIn("NH-02", plan["districts"])
        self.assertIn("NY-19", plan["districts"])
        self.assertIn("CA-13", plan["districts"])
        self.assertNotIn("ME-02", plan["districts"])
        self.assertNotIn("AL-01", plan["districts"])
        self.assertNotIn("NH-01", plan["districts"],
                         "A race missed 4h ago should not consume another probe yet")
        self.assertTrue(all(code in uncovered_house_universe() for code in plan["districts"]))

    def test_every_unobserved_source_reached_in_bounded_windows(self):
        ledger = json.loads(COVERAGE_PATH.read_text(encoding="utf-8"))
        start = datetime(2026, 10, 16, 20, 11, tzinfo=timezone.utc)
        observed = {r["key"] for r in ledger["races"]
                    if r["office"] == "House" and r["last_probe"]}
        self.assertEqual(len(observed), 16)
        windows = 0
        while len(observed) < 219:
            current = start + timedelta(hours=4 * windows)
            plan = gap_aware_window(current, ledger)
            self.assertLessEqual(len(plan["districts"]), 16)
            self.assertEqual(len(set(plan["districts"])), len(plan["districts"]))
            self.assertTrue(all(code not in observed for code in plan["districts"]),
                            "Never-observed races must win over due reruns")
            for code in plan["districts"]:
                record = next(r for r in ledger["races"] if r["id"] == "House|" + code)
                record["last_probe"] = {
                    "status": "INDEXED_EXACT_RACE", "race_id": 200000 + len(observed),
                    "checked_window_utc": plan["window_utc"],
                }
                observed.add(code)
            windows += 1
            self.assertLessEqual(windows, 14,
                                 "All 219 supplemental House slots need coverage within 14 healthy runs")
        self.assertEqual(len(observed), 219)

    def test_adaptive_expiry_retries_missing_after_24h_and_indexed_after_72h(self):
        ledger = json.loads(COVERAGE_PATH.read_text(encoding="utf-8"))
        now = datetime(2026, 10, 20, 16, tzinfo=timezone.utc)
        for row in ledger["races"]:
            if row["office"] == "House" and row["provider_scope"] == "outside primary":
                row["last_probe"] = {
                    "status": "INDEXED_EXACT_RACE", "race_id": 250001,
                    "checked_window_utc": (now - timedelta(hours=2)).isoformat(),
                }
        self.assertEqual(gap_aware_window(now, ledger)["districts"], ())
        sample = next(r for r in ledger["races"] if r["id"] == "House|NH-01")
        sample["last_probe"] = {
            "status": "NOT_INDEXED", "checked_window_utc": (
                now - timedelta(hours=25)).isoformat()
        }
        self.assertEqual(gap_aware_window(now, ledger)["districts"], ("NH-01",))
        sample["last_probe"] = {
            "status": "INDEXED_EXACT_RACE", "checked_window_utc": (
                now - timedelta(hours=73)).isoformat(), "race_id": 251234
        }
        self.assertEqual(gap_aware_window(now, ledger)["districts"], ("NH-01",))
        sample["last_probe"] = {
            "status": "TEMPORARY_UPSTREAM_FAILURE", "checked_window_utc": (
                now - timedelta(hours=5)).isoformat(), "reason": "HTTP_503"
        }
        self.assertEqual(gap_aware_window(now, ledger)["districts"], ("NH-01",))
        sample["last_probe"]["checked_window_utc"] = (
            now - timedelta(hours=2)).isoformat()
        self.assertEqual(gap_aware_window(now, ledger)["districts"], ())
        sample["last_probe"] = {
            "status": "NOT_CHECKED_UPSTREAM_PAUSED",
            "checked_window_utc": now.isoformat()
        }
        self.assertEqual(gap_aware_window(now, ledger)["districts"], ("NH-01",),
                         "A paused probe is not evidence and must be retried")

    def test_adaptive_503_stops_and_skipped_races_remain_priority(self):
        now = datetime(2026, 10, 16, 20, 11, tzinfo=timezone.utc)
        ledger = json.loads(COVERAGE_PATH.read_text(encoding="utf-8"))
        plan = gap_aware_window(now, ledger)
        attempts = []
        def request(path, params):
            attempts.append(path)
            if len(attempts) == 3:
                raise urllib.error.HTTPError("https://civicapi.org",
                                             503, "upstream", None, None)
            return {"races": []}
        results = run_batch(plan, request=request, delay=0)
        report = build_report(plan, results)
        self.assertEqual(len(attempts), 3)
        self.assertEqual(report["sampled_districts"], 3)
        self.assertEqual(report["not_checked_upstream_paused"], 13)
        self.assertEqual(report["request_cap"], 16)
        self.assertEqual(report["discovery_strategy"], "GAP_FIRST_PREVIOUS_LEDGER")
        self.assertTrue(report["upstream_paused"])
        by_id = {r["id"]: r for r in ledger["races"]}
        for result in results:
            by_id["House|" + result["district"]]["last_probe"] = dict(
                result, checked_window_utc=plan["window_utc"])
        # Healthy unobserved seats and paused races outrank the two genuine
        # NOT_INDEXED observations from the interrupted provider run.
        retry = gap_aware_window(now + timedelta(hours=4), ledger)
        self.assertIn(plan["districts"][3], retry["districts"])
        self.assertNotIn(plan["districts"][0], retry["districts"])

    def test_adaptive_history_is_fail_closed(self):
        now = datetime(2026, 10, 16, 20, 11, tzinfo=timezone.utc)
        ledger = json.loads(COVERAGE_PATH.read_text(encoding="utf-8"))
        with self.assertRaises(ValueError):
            gap_aware_window(now, ledger, limit=17)
        bad = copy.deepcopy(ledger)
        bad["races"] = bad["races"][:-1]
        with self.assertRaisesRegex(ValueError, "Incomplete"):
            gap_aware_window(now, bad)
        bad = copy.deepcopy(ledger)
        bad["races"].append(bad["races"][-1])
        with self.assertRaises(ValueError):
            gap_aware_window(now, bad)
        bad = copy.deepcopy(ledger)
        bad["generated_at"] = "2028-10-16T20:00:00+00:00"
        with self.assertRaises(ValueError):
            gap_aware_window(now, bad)
        bad = copy.deepcopy(ledger)
        index = next(i for i, r in enumerate(bad["races"]) if r["id"] == "House|CA-13")
        bad["races"][index]["key"] = "CA-99"
        with self.assertRaises(ValueError):
            gap_aware_window(now, bad)


    def test_at_large_2026_seats_can_be_discovered(self):
        alaska = dict(self.row, province="AK", district="AK-00",
                      election_name="Alaska US House At-Large")
        self.assertTrue(matches("AK-00", alaska))
        self.assertFalse(matches("AK-01", alaska))

    def test_at_large_search_does_not_ask_provider_for_house_zero(self):
        alaska = dict(self.row, province="AK", district="AK-00",
                      election_name="Alaska US House At-Large")
        detail = dict(alaska, election_type=alaska["type"],
                      candidates=self.detail["candidates"])
        searches = []
        def request(path, params):
            if path == "/race/search":
                searches.append(params)
                return {"races": [alaska]}
            return detail
        self.assertEqual(probe("AK-00", request)["status"],
                         "INDEXED_EXACT_RACE")
        self.assertEqual(searches[0]["query"], "US House")
        self.assertEqual(searches[0]["province"], "AK")
        searches.clear()
        self.assertEqual(probe("NH-01", lambda path, params: (
            searches.append(params) or {"races": []}))["status"], "NOT_INDEXED")
        self.assertEqual(searches[0]["query"], "US House 1")

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
        self.assertEqual(outage["status"], "TEMPORARY_UPSTREAM_FAILURE")

    def test_upstream_503_pauses_batch_and_preserves_unknowns(self):
        now = datetime(2026, 10, 16, tzinfo=timezone.utc)
        plan = sampling_window(now)
        attempts = []
        def unavailable(path, params):
            attempts.append((path, params))
            raise urllib.error.HTTPError("https://civicapi.org/api/v2",
                                         503, "Service Unavailable", None, None)
        results = run_batch(plan, unavailable, delay=0)
        self.assertEqual(len(attempts), 1,
                         "One shared 503 must not trigger 16 additional requests")
        self.assertEqual(results[0]["status"], "TEMPORARY_UPSTREAM_FAILURE")
        self.assertEqual(results[0]["reason"], "HTTP_503")
        self.assertTrue(all(x["status"] == "NOT_CHECKED_UPSTREAM_PAUSED"
                            for x in results[1:]))
        report = build_report(plan, results)
        self.assertEqual(report["sampled_districts"], 1)
        self.assertEqual(report["planned_districts"], 16)
        self.assertEqual(report["not_checked_upstream_paused"], 15)
        self.assertTrue(report["upstream_paused"])
        self.assertEqual(report["indexed_exact"], 0)
        self.assertNotIn("NOT_INDEXED", report["status_counts"])
        self.assertEqual(len(report["results"]), 16)
        for code in (429, 502, 504):
            result = probe("NH-01", lambda path, params: (_ for _ in ()).throw(
                urllib.error.HTTPError("https://civicapi.org",code,"temporary",None,None)))
            self.assertEqual(result["status"], "TEMPORARY_UPSTREAM_FAILURE")
        nonretry = probe("NH-01", lambda path, params: (_ for _ in ()).throw(
            urllib.error.HTTPError("https://civicapi.org", 404, "not found", None, None)))
        self.assertEqual(nonretry["status"], "SOURCE_UNAVAILABLE_OR_INVALID")
        self.assertEqual(nonretry["reason"], "HTTP_404")

    def test_nonindexed_batch_does_not_invent_success_or_outage(self):
        plan = sampling_window(datetime(2026, 10, 16, tzinfo=timezone.utc))
        attempted = []
        def not_indexed(path, params):
            attempted.append(path)
            return {"races": []}
        rows = run_batch(plan, not_indexed, delay=0)
        report = build_report(plan, rows)
        self.assertFalse(report["upstream_paused"])
        self.assertEqual(report["sampled_districts"], 16)
        self.assertEqual(report["status_counts"], {"NOT_INDEXED": 16})
        self.assertEqual(len(attempted), 16)
        with self.assertRaisesRegex(ValueError, "missing or reordering"):
            build_report(plan, rows[:-1])


if __name__ == "__main__":
    unittest.main()
