#!/usr/bin/env python3
"""Deterministic source-discovery contract tests; no real HTTP requests."""
import unittest
import json
import copy
import tempfile
import urllib.error
from unittest.mock import patch
from pathlib import Path
from datetime import datetime, timezone, timedelta
from probe_house_coverage_2026 import (
    fetch as fetch_real_house_source, BASE as HOUSE_PROVIDER_BASE,
    matches, detail_matches, probe, DISTRICTS, PRIMARY_STATES,
    ROTATING_PER_RUN, uncovered_house_universe, sampling_window,
    run_batch, build_report, gap_aware_window, GAP_AWARE_LIMIT,
    GAP_PRIORITY, COVERAGE_PATH, HOURLY_DISCOVERY_LIMIT,
)


def synthetic_initial_coverage():
    """Fixed 16-probe baseline; scheduled CI must not make this fixture stale."""
    ledger = json.loads(COVERAGE_PATH.read_text(encoding="utf-8"))
    ledger["generated_at"] = "2026-10-16T16:00:00+00:00"
    exact = (
        "AL-01 AL-02 AL-03 AL-04 AL-05 AL-06 AL-07 CA-01 CA-02 CA-03 "
        "ME-02 NE-02 NV-03 NY-17 WI-03"
    ).split()
    for row in ledger["races"]:
        if row["office"] != "House" or row["provider_scope"] != "outside primary":
            continue
        if row["key"] == "NH-01":
            row["last_probe"] = {
                "status": "NOT_INDEXED",
                "checked_window_utc": "2026-10-16T16:00:00+00:00",
            }
        elif row["key"] in exact:
            row["last_probe"] = {
                "status": "INDEXED_EXACT_RACE",
                "race_id": 200000 + exact.index(row["key"]),
                "checked_window_utc": "2026-10-16T16:00:00+00:00",
            }
        else:
            row["last_probe"] = None
    return ledger


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

    def test_supplemental_house_http_cannot_redirect_to_fake_vote_provider(self):
        # Exactly one approved civicAPI endpoint owns the response. An
        # upstream 301 to any alternate host/path (even same-host) is
        # not authoritative race-ID evidence.
        approved = HOUSE_PROVIDER_BASE + "/race/search"
        class FakeHTTP:
            status=200
            headers={"Access-Control-Allow-Origin":"https://jmon18-rgb.github.io",
                     "Content-Type":"application/json"}
            def __init__(self,location):
                self.location=location
            def __enter__(self):return self
            def __exit__(self,*args):return False
            def read(self,limit):return b'{"races":[],"count":0}'[:limit]
            def geturl(self):return self.location
        with patch("urllib.request.urlopen",return_value=FakeHTTP(approved)):
            self.assertEqual(fetch_real_house_source("/race/search")["count"],0)
        for redirected in (
            "https://evil.example/api/v2/race/search",
            "http://civicapi.org/api/v2/race/search",
            HOUSE_PROVIDER_BASE+"/race/999",
            HOUSE_PROVIDER_BASE+"/race/search?wrong=2024",
        ):
            with self.subTest(redirect=redirected):
                with patch("urllib.request.urlopen",
                           return_value=FakeHTTP(redirected)):
                    with self.assertRaisesRegex(ValueError,"redirected"):
                        fetch_real_house_source("/race/search")
        class MissingLocation(FakeHTTP):
            geturl=None
        with patch("urllib.request.urlopen",
                   return_value=MissingLocation(approved)):
            with self.assertRaisesRegex(ValueError,"cannot be verified"):
                fetch_real_house_source("/race/search")

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
        ledger = synthetic_initial_coverage()
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
        ledger = synthetic_initial_coverage()
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
            remaining_unobserved = 219 - len(observed)
            self.assertTrue(all(code not in observed for code in
                                plan["districts"][:min(16, remaining_unobserved)]),
                            "Never-observed races must precede any due reruns")
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

    def test_hourly_low_pressure_sweep_advances_across_remaining_gaps(self):
        ledger = synthetic_initial_coverage()
        start = datetime(2026, 10, 16, 20, 11, tzinfo=timezone.utc)
        self.assertEqual(HOURLY_DISCOVERY_LIMIT, 8)
        first = gap_aware_window(start, ledger, limit=HOURLY_DISCOVERY_LIMIT,
                                 window_hours=1)
        self.assertEqual(len(first["districts"]), 8)
        self.assertEqual(first["window_utc"], "2026-10-16T20:00:00+00:00")
        self.assertEqual(first["request_cap"], 8)
        for key in first["districts"]:
            row = next(x for x in ledger["races"] if x["id"] == "House|" + key)
            row["last_probe"] = {
                "status": "INDEXED_EXACT_RACE", "race_id": 250001,
                "checked_window_utc": first["window_utc"]
            }
        second = gap_aware_window(start + timedelta(hours=1), ledger,
                                  limit=HOURLY_DISCOVERY_LIMIT, window_hours=1)
        self.assertEqual(second["window_utc"], "2026-10-16T21:00:00+00:00")
        self.assertEqual(len(second["districts"]), 8)
        self.assertFalse(set(first["districts"]) & set(second["districts"]),
                         "Hourly discovery must not burn calls repeating indexed source IDs")
        checked = 16
        windows = 2
        while checked < 203:
            hour = start + timedelta(hours=windows)
            plan = gap_aware_window(hour, ledger, limit=HOURLY_DISCOVERY_LIMIT,
                                    window_hours=1)
            self.assertEqual(len(plan["districts"]), 8)
            self.assertEqual(len(set(plan["districts"])), 8)
            checked += 8
            for key in plan["districts"]:
                row = next(x for x in ledger["races"] if x["id"] == "House|" + key)
                row["last_probe"] = {
                    "status": "NOT_INDEXED",
                    "checked_window_utc": plan["window_utc"]
                }
            windows += 1
            self.assertLessEqual(windows, 28)
        self.assertLessEqual(windows, 28)
        with self.assertRaisesRegex(ValueError, "Invalid time"):
            gap_aware_window(start, ledger, limit=8, window_hours=2)

    def test_election_night_rechecks_missing_and_failed_sources_hourly(self):
        # 7 remaining unknown House identities should not wait 24 hours when
        # civicAPI first publishes its November 3 general-election inventory.
        ledger = synthetic_initial_coverage()
        today = datetime(2026, 11, 3, 23, 15, tzinfo=timezone.utc)
        for row in ledger["races"]:
            if row["office"] == "House" and row["provider_scope"] == "outside primary":
                row["last_probe"] = {
                    "status": "INDEXED_EXACT_RACE", "race_id": 200001,
                    "checked_window_utc": (today - timedelta(minutes=5)).isoformat()
                }
        unindexed = next(r for r in ledger["races"] if r["id"] == "House|NH-01")
        unindexed["last_probe"] = {
            "status": "NOT_INDEXED",
            "checked_window_utc": (today - timedelta(minutes=65)).isoformat()
        }
        transient = next(r for r in ledger["races"] if r["id"] == "House|AK-00")
        transient["last_probe"] = {
            "status": "TEMPORARY_UPSTREAM_FAILURE", "reason": "HTTP_503",
            "checked_window_utc": (today - timedelta(minutes=65)).isoformat()
        }
        plan = gap_aware_window(today, ledger, limit=8, window_hours=1)
        self.assertEqual(set(plan["districts"]), {"NH-01", "AK-00"})
        self.assertEqual(plan["scheduled_rechecks"], 2)
        self.assertEqual(plan["request_cap"], 8)
        self.assertEqual(gap_aware_window(
            today - timedelta(minutes=15), ledger, limit=8,
            window_hours=1)["districts"], (),
            "Hourly retry must not repeat provider requests before one hour")
        self.assertEqual(gap_aware_window(
            datetime(2026, 11, 3, 22, 59, tzinfo=timezone.utc),
            ledger, limit=8, window_hours=1)["districts"], (),
            "Do not accelerate source probes before counting begins")
        after = gap_aware_window(
            datetime(2026, 11, 4, 12, 1, tzinfo=timezone.utc),
            ledger, limit=8, window_hours=1)["districts"]
        self.assertNotIn("NH-01", after,
            "Outside the counting window NOT_INDEXED returns to the 24-hour retry budget")
        self.assertIn("AK-00", after,
            "Outside the counting window 4-hour transient-failure retry is still due")

    def test_half_hour_gap_scan_only_during_actual_november_counting(self):
        # In the last 13 hours of the first counting night, a missing ID
        # must not hide until the next hourly preflight. Indexed IDs are
        # already live-readable and never consume these additional probes.
        source = synthetic_initial_coverage()
        state_time = datetime(2026, 11, 3, 23, tzinfo=timezone.utc)
        outstanding = ("AK-00", "DE-00", "ND-00", "NH-01", "NH-02",
                       "SD-00", "WY-00")
        for row in source["races"]:
            if row["office"] == "House" and row["provider_scope"] == "outside primary":
                row["last_probe"] = {
                    "status": "NOT_INDEXED" if row["key"] in outstanding
                              else "INDEXED_EXACT_RACE",
                    "race_id": None if row["key"] in outstanding else 1234,
                    "checked_window_utc": state_time.isoformat()
                }
        source["generated_at"] = state_time.isoformat()
        early = gap_aware_window(state_time + timedelta(minutes=15),
                                 source, limit=8, window_hours=0.5)
        self.assertEqual(early["districts"], ())
        ready = gap_aware_window(state_time + timedelta(minutes=41),
                                 source, limit=8, window_hours=0.5)
        self.assertEqual(ready["window_utc"], "2026-11-03T23:30:00+00:00")
        self.assertEqual(set(ready["districts"]), set(outstanding))
        self.assertEqual(ready["scheduled_rechecks"], 7)
        self.assertEqual(ready["request_cap"], 8)
        # The report records its true half-hour UTC slot so the next
        # scheduled check does not immediately double-probe the same IDs.
        for row in source["races"]:
            if row["id"] in ("House|" + k for k in outstanding):
                row["last_probe"]["checked_window_utc"] = ready["window_utc"]
        at_next = gap_aware_window(datetime(2026, 11, 4, 0, 11,
                                             tzinfo=timezone.utc),
                                   source, limit=8, window_hours=0.5)
        self.assertEqual(set(at_next["districts"]), set(outstanding))
        self.assertEqual(at_next["window_utc"], "2026-11-04T00:00:00+00:00")
        for date in (
            datetime(2026, 11, 3, 22, 59, tzinfo=timezone.utc),
            datetime(2026, 11, 4, 12, 30, tzinfo=timezone.utc),
            datetime(2026, 10, 24, 17, 41, tzinfo=timezone.utc)):
            with self.assertRaisesRegex(ValueError, "only during counting"):
                gap_aware_window(date, source, limit=8, window_hours=0.5)

    def test_adaptive_expiry_retries_missing_after_24h_and_indexed_after_72h(self):
        ledger = synthetic_initial_coverage()
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
        ledger = synthetic_initial_coverage()
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
        self.assertEqual(report["sampled_districts"], 1,
                         "Third HTTP call is now an NH alias; the first 503 stops the batch")
        self.assertEqual(report["not_checked_upstream_paused"], 15)
        self.assertEqual(report["request_cap"], 16)
        self.assertEqual(report["discovery_strategy"], "GAP_FIRST_PREVIOUS_LEDGER")
        self.assertTrue(report["upstream_paused"])
        by_id = {r["id"]: r for r in ledger["races"]}
        for result in results:
            by_id["House|" + result["district"]]["last_probe"] = dict(
                result, checked_window_utc=plan["window_utc"])
        # A failed NH alias is UNKNOWN, not a definitive NOT_INDEXED.
        # Other planned slots were paused and remain eligible next run.
        retry = gap_aware_window(now + timedelta(hours=4), ledger)
        self.assertIn(plan["districts"][1], retry["districts"])
        self.assertNotIn("INDEXED_EXACT_RACE",
                         [item["status"] for item in results])

    def test_complete_state_search_saves_requests_and_revalidates_details(self):
        codes = tuple(f"CA-{i:02}" for i in range(4, 12))
        rows = [{
            **self.row, "province": "CA", "district": code,
            "election_name": f"California US House {int(code[3:])}",
            "id": 86900 + int(code[3:])
        } for code in codes]
        details = {r["id"]: {
            **r, "election_type": "House of Representatives",
            "candidates": self.detail["candidates"]
        } for r in rows}
        requests = []
        def provider(path, params):
            requests.append((path, params))
            if path == "/race/search":
                self.assertEqual(params["query"], "US House")
                return {"count": len(rows), "races": rows}
            return details[int(path.rsplit("/", 1)[-1])]
        stats = {}
        got = run_batch({"districts": codes}, provider, delay=0, stats=stats)
        report = build_report({"districts": codes, "window_utc": "2026-10-16T20:00:00Z",
                               "primary_states": 22, "uncovered_house_districts": 219,
                               "anchor_count": 0, "rotating_count": len(codes),
                               "windows_per_rotation": 28}, got, request_stats=stats)
        self.assertEqual([r["status"] for r in got], ["INDEXED_EXACT_RACE"] * 8)
        self.assertEqual(stats["state_searches"], 1)
        self.assertEqual(stats["exact_district_searches"], 0)
        self.assertEqual(stats["detail_requests"], 8)
        self.assertEqual(stats["total_http_requests"], 9)
        self.assertEqual(stats["state_batch_identity_hits"], 8)
        self.assertEqual(report["indexed_exact"], 8)
        self.assertEqual(report["request_stats"]["total_http_requests"], 9)
        self.assertEqual(len(requests), 9)

    def test_incomplete_state_batch_falls_back_to_exact_seat_searches(self):
        codes = ("CA-04", "CA-05", "CA-06")
        hits = []
        def provider(path, params):
            hits.append((path, params))
            if path == "/race/search" and params["query"] == "US House":
                return {"races": [self.row], "count": 52}
            if path == "/race/search":
                return {"races": []}
            raise AssertionError("Never request details from an incomplete search")
        stats = {}
        results = run_batch({"districts": codes}, provider, delay=0, stats=stats)
        self.assertEqual([r["status"] for r in results], ["NOT_INDEXED"] * 3)
        self.assertEqual(stats["state_batch_rejected_or_incomplete"], 1)
        self.assertEqual(stats["state_searches"], 1)
        self.assertEqual(stats["exact_district_searches"], 3)
        self.assertEqual(stats["detail_requests"], 0)
        self.assertEqual(len(hits), 4)
        # Broad search with a seemingly unique match but unknown cardinality
        # must NOT waive the exact search requirement.
        hits.clear()
        def no_count(path, params):
            hits.append(params["query"])
            if params["query"] == "US House":
                return {"races": [self.row]}
            return {"races": []}
        results = run_batch({"districts": codes}, no_count, delay=0)
        self.assertEqual([r["status"] for r in results], ["NOT_INDEXED"] * 3)
        self.assertEqual(len(hits), 4)

    def test_shared_503_on_state_search_stops_without_hammering(self):
        codes = ("CA-04", "CA-05", "CA-06", "CA-07")
        attempts = []
        def provider(path, params):
            attempts.append(path)
            raise urllib.error.HTTPError("https://civicapi.org", 503,
                                         "rate limit", None, None)
        stats = {}
        rows = run_batch({"districts": codes}, provider, delay=0, stats=stats)
        self.assertEqual(len(attempts), 1)
        self.assertEqual([r["status"] for r in rows],
                         ["TEMPORARY_UPSTREAM_FAILURE"] +
                         ["NOT_CHECKED_UPSTREAM_PAUSED"] * 3)
        self.assertEqual(rows[0]["reason"], "HTTP_503")
        self.assertEqual(stats["total_http_requests"], 1)

    def test_batched_detail_failure_pauses_after_source_error(self):
        codes = ("CA-04", "CA-05", "CA-06")
        candidates = [{
            **self.row, "province": "CA", "district": code,
            "election_name": f"California US House {int(code[3:])}",
            "id": 87000 + int(code[3:])
        } for code in codes]
        attempts = []
        def provider(path, params):
            attempts.append(path)
            if path == "/race/search":
                return {"count": 3, "races": candidates}
            raise urllib.error.HTTPError("https://civicapi.org", 429,
                                         "too many", None, None)
        results = run_batch({"districts": codes}, provider, delay=0)
        self.assertEqual([r["status"] for r in results],
                         ["TEMPORARY_UPSTREAM_FAILURE"] +
                         ["NOT_CHECKED_UPSTREAM_PAUSED"] * 2)
        self.assertEqual(attempts, ["/race/search", "/race/87004"])

    def test_adaptive_history_is_fail_closed(self):
        now = datetime(2026, 10, 16, 20, 11, tzinfo=timezone.utc)
        ledger = synthetic_initial_coverage()
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

    def test_fake_same_day_house_dates_and_test_rows_not_indexed(self):
        for stamp in (
            "2026-11-03T99:99:99Z","2026-11-03T05:00:00",
            "2026-11-03T05:00:00Zextra","2026-11-0305:00Z",
            "2026-11-03T05:00:00+99:00",
            "2026-11-03T05:00:00.123garbage",
            "2026-11-03Z","2026-11-03T22",
        ):
            with self.subTest(date=stamp):
                self.assertFalse(matches("NH-01",dict(self.row,election_date=stamp)))
        for flag in ("test_data","is_test","test","mock","is_mock"):
            with self.subTest(flag=flag):
                self.assertFalse(matches("NH-01",dict(self.row,**{flag:True})))
                self.assertFalse(detail_matches(self.row,
                                                dict(self.detail,**{flag:True})))
        self.assertFalse(matches("NH-01",dict(self.row,active=False)))
        self.assertFalse(detail_matches(self.row,dict(self.detail,active=False)))
        self.assertTrue(matches("NH-01",dict(self.row,election_date="2026-11-03")))
        self.assertTrue(matches("NH-01",dict(self.row,
                          election_date="2026-11-03T05:00:00-04:00")))

    def test_house_details_reject_duplicate_names_and_unsafe_vote_arithmetic(self):
        original=copy.deepcopy(self.detail)
        for invalid_candidates in (
            [original["candidates"][0],{**original["candidates"][1],
                                      "name":" example democrat "}],
            [original["candidates"][0],{**original["candidates"][1],
                                      "votes":True}],
            [original["candidates"][0],{**original["candidates"][1],
                                      "votes":2**53}],
        ):
            with self.subTest(candidates=invalid_candidates):
                self.assertFalse(detail_matches(self.row,
                                  {**self.detail,"candidates":invalid_candidates}))
        # Legitimate same-party top-two election candidates are distinct
        # humans and must remain allowed for source identity discovery.
        top_two=copy.deepcopy(self.detail)
        top_two["candidates"][0]["party"]="Democratic"
        top_two["candidates"][1]["party"]="Democratic"
        self.assertTrue(detail_matches(self.row,top_two))

    def test_positive_preclose_house_detail_cannot_create_source_id_hint(self):
        positive=copy.deepcopy(self.detail)
        positive["candidates"][0]["votes"]=100
        positive["candidates"][1]["votes"]=75
        def fetch(path,params):
            return {"races":[self.row]} if path=="/race/search" else positive
        early=probe("NH-01",fetch,now=datetime(
            2026,11,4,0,59,tzinfo=timezone.utc))
        self.assertEqual(early["status"],"INVALID_DETAIL")
        self.assertEqual(early["reason"],"PRE_POLL_CLOSE_POSITIVE_VOTES")
        self.assertNotIn("race_id",early)
        self.assertNotIn("reported_votes",early,
                         "Diagnostic evidence must not publish rejected mock vote counts")
        late=probe("NH-01",fetch,now=datetime(
            2026,11,4,1,1,tzinfo=timezone.utc))
        self.assertEqual(late["status"],"INDEXED_EXACT_RACE")
        self.assertEqual(late["reported_votes"],175)
        # An explicit mock source remains invalid even after polls close.
        positive["mock"]=True
        rejected=probe("NH-01",fetch,now=datetime(
            2026,11,4,3,tzinfo=timezone.utc))
        self.assertEqual(rejected["status"],"INVALID_DETAIL")
        self.assertEqual(rejected["reason"],"DETAIL_CONTRACT_REJECTED")
        self.assertNotIn("race_id",rejected)

    def test_diagnostic_reasons_preserve_wrong_identity_and_contract_rejections(self):
        wrong_index={**self.row,"district":"NH-02"}
        result=probe("NH-01",lambda *_:self.fail("Invalid batch identity must not fetch"),
                     indexed_candidate=wrong_index)
        self.assertEqual(result["status"],"INVALID_DETAIL")
        self.assertEqual(result["reason"],"INDEX_CANDIDATE_IDENTITY_REJECTED")
        invalid=copy.deepcopy(self.detail)
        invalid["candidates"][0]["votes"]=True
        for detail in (invalid, [], None, "not an object"):
            with self.subTest(detail=detail):
                result=probe("NH-01",lambda path,params:
                    {"races":[self.row]} if path=="/race/search" else detail)
                self.assertEqual(result["reason"],"DETAIL_CONTRACT_REJECTED")
                self.assertNotIn("race_id",result)

    def test_explicit_missing_and_ambiguity(self):
        self.assertEqual(probe("NH-01", lambda path, params: {"races": []})
                         ["status"], "NOT_INDEXED")
        self.assertEqual(probe("NH-01", lambda path, params: {"count": 40,
                                                              "races": [self.row]})
                         ["status"], "AMBIGUOUS_OR_TRUNCATED")
        self.assertEqual(probe("NH-01", lambda path, params: {"races": [
            self.row, self.row]})["status"], "AMBIGUOUS_RACE")

    def test_exact_district_search_count_must_not_conceal_partial_results(self):
        # One returned row with an upstream total of two or a malformed
        # count is a truncated provider search, never a unique source ID.
        for count in (0,2,21,-1,"1",True,1.5):
            with self.subTest(count=count):
                def search(path,params):
                    return ({"races":[self.row],"count":count} if
                            path=="/race/search" else self.detail)
                outcome=probe("NH-01",search)
                self.assertEqual(outcome["status"],"AMBIGUOUS_OR_TRUNCATED")
                self.assertNotIn("race_id",outcome)
        def exact(path,params):
            return ({"races":[self.row],"count":1} if
                    path=="/race/search" else self.detail)
        verified=probe("NH-01",exact)
        self.assertEqual(verified["status"],"INDEXED_EXACT_RACE")
        self.assertEqual(verified["race_id"],88001)
        self.assertEqual(probe("NH-01",
             lambda path,params:{"races":[],"count":2})["status"],
             "AMBIGUOUS_OR_TRUNCATED")
        self.assertEqual(probe("NH-01",
             lambda path,params:{"races":[],"count":0})["status"],
             "NOT_INDEXED")

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

    def test_hourly_alias_search_closes_a_source_identity_only_after_exact_detail(self):
        # This is the scheduled probe(), not a standalone manual advisory.
        # Its INDEXED_EXACT_RACE status is consumed by the existing 506
        # coverage ledger and House pin manifest after a real provider hit.
        for key, name in (
            ("AK-00", "Alaska Representative in Congress At-Large"),
            ("DE-00", "Delaware U.S. Representative"),
            ("ND-00", "North Dakota Representative in Congress"),
            ("NH-01", "New Hampshire Representative in Congress District 1"),
            ("NH-02", "New Hampshire U.S. Representative 2"),
            ("SD-00", "South Dakota Representative in Congress"),
            ("WY-00", "Wyoming U.S. Representative"),
        ):
            with self.subTest(key=key):
                row = dict(self.row, id=98001, province=key[:2],
                           district=key, election_name=name)
                calls = []
                def provider(path, params):
                    calls.append((path, params))
                    if path == "/race/search":
                        if params["query"] == "Representative in Congress":
                            return {"count": 1, "races": [row]}
                        return {"count": 0, "races": []}
                    return dict(row, election_type="House of Representatives",
                                candidates=self.detail["candidates"])
                self.assertTrue(matches(key, row))
                result = probe(key, provider,
                               now=datetime(2026, 10, 25, tzinfo=timezone.utc))
                self.assertEqual(result["status"], "INDEXED_EXACT_RACE")
                self.assertEqual(result["race_id"], 98001)
                self.assertEqual(result["reported_votes"], 0,
                                 "Metadata is never counted as live votes")
                self.assertEqual([c[1]["query"] for c in calls
                                  if c[0] == "/race/search"],
                                 ["US House" if key.endswith("-00") else
                                  "US House " + str(int(key[3:])),
                                  "Representative in Congress",
                                  "U.S. Representative"])
                self.assertEqual(sum(c[0].startswith("/race/") and
                                     c[0] != "/race/search" for c in calls), 1)
                self.assertFalse(matches(key, dict(row, province="CA")))
                self.assertFalse(matches(key, dict(row, district="NH-99")))
                self.assertFalse(matches(key, dict(row, election_type="Primary")))
                self.assertFalse(matches(key, dict(row,
                                         election_date="2024-11-05")))
                self.assertFalse(matches(key, dict(row,
                                         election_name=name + " Primary")))

    def test_alias_search_refuses_conflicting_or_truncated_2026_source_ids(self):
        for key in ("NH-01", "NH-02", "AK-00"):
            row = dict(self.row, province=key[:2], district=key,
                       election_name="Representative in Congress" + (
                          " " + str(int(key[3:])) if key.startswith("NH") else ""))
            def conflicting(path, params):
                term = params.get("query")
                return {"count": 1, "races": [dict(
                    row, id=1001 if term=="Representative in Congress" else 1002
                )]} if term in ("Representative in Congress",
                               "U.S. Representative") else {"count": 0, "races": []}
            result = probe(key, conflicting)
            self.assertEqual(result["status"], "AMBIGUOUS_RACE", key)
            def truncated(path, params):
                return ({"count": 2, "races": [row]}
                        if params.get("query")=="Representative in Congress"
                        else {"count": 0, "races": []})
            self.assertEqual(probe(key, truncated)["status"],
                             "AMBIGUOUS_OR_TRUNCATED", key)
            def outage(path, params):
                if params.get("query") == "Representative in Congress":
                    raise urllib.error.HTTPError("https://civicapi.org", 503,
                                                 "unavailable", None, None)
                return {"count": 0, "races": []}
            self.assertEqual(probe(key, outage)["status"],
                             "TEMPORARY_UPSTREAM_FAILURE", key)

    def test_alias_probe_never_expands_212_covered_house_district_requests(self):
        attempted = []
        def none(path, params):
            attempted.append(params.get("query"))
            return {"count": 0, "races": []}
        self.assertEqual(probe("KY-06", none)["status"], "NOT_INDEXED")
        self.assertEqual(attempted, ["US House 6"])
        self.assertFalse(matches("KY-06", dict(self.row, province="KY",
              district="KY-06",
              election_name="Kentucky Representative in Congress 6")))

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
        self.assertEqual(len(attempted), 19,
                         "One broad search, 16 exact searches and two NH-01 aliases")
        self.assertEqual(attempted.count("/race/search"), 19)
        with self.assertRaisesRegex(ValueError, "missing or reordering"):
            build_report(plan, rows[:-1])


if __name__ == "__main__":
    unittest.main()
