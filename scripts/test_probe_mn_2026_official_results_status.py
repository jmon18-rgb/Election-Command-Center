#!/usr/bin/env python3
"""No election-night mock page may produce votes, calls or approval."""
import unittest
from datetime import datetime, timezone
from probe_mn_2026_official_results_status import assess, accepted_redirect

EARLY = datetime(2026, 10, 24, 20, tzinfo=timezone.utc)
LATE = datetime(2026, 11, 4, 2, 5, tzinfo=timezone.utc)
GENERAL = "<h1>State General Election</h1><p>Tuesday, November 3, 2026</p>"

class MinnesotaOfficialStatusTests(unittest.TestCase):
    def test_test_results_banner_fails_closed_even_after_polls_close(self):
        for now in (EARLY, LATE):
            for marker in ("TEST RESULTS", "Testing in Progress", "MOCK RESULTS"):
                out = assess(GENERAL + "<b>" + marker + "</b>", now)
                self.assertEqual(out["status"], "MOCK_TEST_RESULTS_BLOCKED")
                self.assertTrue(out["test_marker_seen"])
                self.assertFalse(out["validated_live_feed"])
                self.assertFalse(out["race_ids_verified"])
                self.assertFalse(out["may_update_model"])
                self.assertIsNone(out["candidate_votes"])
                self.assertIsNone(out["professional_calls"])

    def test_lack_of_test_banner_does_not_approve_results(self):
        early = assess(GENERAL, EARLY)
        self.assertEqual(early["status"], "POLL_CLOSE_NOT_REACHED")
        late = assess(GENERAL, LATE)
        self.assertEqual(late["status"], "PAGE_FOUND_SOURCE_INGESTION_UNVERIFIED")
        for result in (early, late):
            self.assertFalse(result["may_update_model"])
            self.assertFalse(result["validated_live_feed"])
            self.assertIsNone(result["candidate_votes"])

    def test_primary_and_historical_pages_are_never_2026_general(self):
        for html in ("<h1>State Primary</h1>Tuesday, August 11, 2026",
                     "<h1>State General Election</h1>Tuesday, November 5, 2024",
                     "<h1>2026 Candidate List</h1>General ballot",
                     ""):
            self.assertEqual(assess(html, LATE)["status"],
                             "WRONG_OR_UNKNOWN_2026_GENERAL_PAGE")
        self.assertEqual(assess(GENERAL, LATE, False)["status"],
                         "SOURCE_UNAVAILABLE_NOT_ASSESSED")

    def test_exact_official_host_and_path_only(self):
        self.assertTrue(accepted_redirect("https://electionresults.sos.mn.gov/201"))
        self.assertTrue(accepted_redirect("https://electionresults.sos.mn.gov/201/"))
        for url in ("http://electionresults.sos.mn.gov/201",
                    "https://evil.example/201",
                    "https://attacker@electionresults.sos.mn.gov/201",
                    "https://electionresults.sos.mn.gov/202",
                    "https://electionresults.sos.mn.gov/201?mock=0"):
            self.assertFalse(accepted_redirect(url))
        with self.assertRaises(ValueError):
            assess(GENERAL, datetime(2026, 11, 4, 2))

if __name__ == "__main__":
    unittest.main()
