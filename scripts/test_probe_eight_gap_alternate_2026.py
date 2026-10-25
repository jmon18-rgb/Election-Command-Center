#!/usr/bin/env python3
import datetime as dt
import io
import json
import unittest

from probe_eight_gap_alternate_2026 import EIGHT, RACES, ENDPOINT, fetch_state, probe, shape

BEFORE = dt.datetime(2026, 10, 25, 16, tzinfo=dt.timezone.utc)
AFTER = dt.datetime(2026, 11, 4, 3, tzinfo=dt.timezone.utc)


class TestGapAlternative(unittest.TestCase):
    def test_exact_eight_race_universe(self):
        self.assertEqual(len(EIGHT), 8)
        self.assertEqual(len(RACES), 7)
        self.assertEqual(RACES["NH"], ("House|NH-01", "House|NH-02"))
        self.assertEqual(RACES["MA"], ("Senate|MA",))

    def test_pre_election_empty_and_truncated_not_approved(self):
        self.assertEqual(shape([], "NH", now=BEFORE)["status"],
                         "BEFORE_DOCUMENTED_GENERAL_RESULT_START")
        self.assertEqual(shape({"results": []}, "NH", now=AFTER)["status"],
                         "NO_2026_RESULTS_YET")
        self.assertEqual(shape({"results": [{"raceId": "x"}]}, "NH", now=BEFORE)["status"],
                         "BEFORE_DOCUMENTED_GENERAL_RESULT_START")
        self.assertEqual(shape({"foo": []}, "NH", now=AFTER)["status"],
                         "UNRECOGNIZED_ENVELOPE_NO_SOURCE_APPROVAL")
        self.assertEqual(shape({"results": ["not a race"]}, "NH", now=AFTER)["status"],
                         "MALFORMED_OR_TRUNCATED_PROVIDER_ROWS")
        with self.assertRaises(ValueError):
            shape([], "FL", now=AFTER)
        with self.assertRaises(ValueError):
            shape([], "NH", now=AFTER.replace(tzinfo=None))

    def test_post_election_id_never_auto_approved(self):
        v = shape({"rows": [
            {"raceId": "2026-house-nh-01", "result": {"votes": 4000}},
            {"raceId": "2026-house-nh-02", "result": None},
            {"raceId": "evil<script>", "result": {"winner": True}},
        ]}, "NH", now=AFTER)
        self.assertEqual(v["status"], "POST_START_ROWS_REQUIRE_EXACT_IDENTITY_REVIEW")
        self.assertEqual(v["bounded_provider_race_id_examples"],
                         ["2026-house-nh-01", "2026-house-nh-02"])

    def test_bounded_error_telemetry_and_nonpromotion(self):
        def fake(state):
            if state == "NH":
                raise OSError("provider unavailable")
            return {"results": []}
        result = probe(fetch=fake, now=AFTER)
        self.assertEqual(result["results"]["NH"]["status"],
                         "UNAVAILABLE_NOT_SOURCE_EVIDENCE")
        self.assertEqual(result["unverified_gap_count"], 8)
        self.assertEqual(result["approved_source_race_ids"], [])
        self.assertFalse(result["approved_for_live_2026_votes"])
        self.assertFalse(result["may_update_model_or_control"])
        self.assertTrue(result["licensing_and_browser_cors_review_required"])

    def test_strict_pinned_url_and_response_content(self):
        class Resp:
            status = 200
            headers = {"Content-Type": "application/json; charset=utf-8"}
            def __init__(self, bad=False):
                self.bad = bad
            def __enter__(self):
                return self
            def __exit__(self, *a):
                return False
            def geturl(self):
                return ENDPOINT + "?state=NH" if not self.bad else "https://evil.test/nh"
            def read(self, n):
                return b'{"results":[]}'
        class Opener:
            def __init__(self, bad=False):
                self.bad = bad
            def open(self, req, timeout):
                self.asserted_url = req.full_url
                return Resp(self.bad)
        good = Opener()
        self.assertEqual(fetch_state("NH", opener=good), {"results": []})
        self.assertEqual(good.asserted_url, ENDPOINT + "?state=NH")
        with self.assertRaises(ValueError):
            fetch_state("NH", opener=Opener(True))
        with self.assertRaises(ValueError):
            fetch_state("XX", opener=good)


if __name__ == "__main__":
    unittest.main()
