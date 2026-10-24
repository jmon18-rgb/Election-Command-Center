#!/usr/bin/env python3
"""No election-night mock page may produce votes, calls or approval."""
import unittest
from datetime import datetime, timezone
from probe_mn_2026_official_results_status import (
    assess, accepted_redirect, accepted_export_url, accepted_export_index,
    discover_export_index, EXPECTED_EXPORTS, EXPORT_INDEX)

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

class MinnesotaExportsContractTests(unittest.TestCase):
    def page(self, rows, preface="Test Results Tuesday, November 3, 2026"):
        links = "".join(
            '<a href="https://electionresultsfiles.sos.mn.gov/20261103/' +
            file + '">' + label + '</a>'
            for label, file in rows.items())
        return (f'<h1>{preface}</h1><h2>Downloadable Text Files</h2>'
                f'<h3>Election results files:</h3>{links}')

    def test_mock_results_never_promote_discovered_votefile_links(self):
        page = self.page(EXPECTED_EXPORTS)
        for when in (EARLY, LATE):
            report = discover_export_index(page, when)
            self.assertEqual(report["status"], "MOCK_EXPORT_LINKS_QUARANTINED")
            self.assertEqual(report["exact_official_links_discovered"], 6)
            self.assertEqual(report["retrieved_vote_files"], 0)
            self.assertFalse(report["validated_live_feed"])
            self.assertFalse(report["race_ids_verified"])
            self.assertFalse(report["may_update_model"])
            self.assertFalse(report["geographic_needle_calibrated"])
            self.assertIsNone(report["candidate_votes"])
            self.assertIsNone(report["ballots_reported"])
            self.assertIsNone(report["winner_calls"])
            self.assertIn("next morning", report["precinct_file_timing"])

    def test_without_mock_banner_links_remain_unverified(self):
        page = self.page(EXPECTED_EXPORTS, "Tuesday, November 3, 2026")
        self.assertEqual(discover_export_index(page, EARLY)["status"],
                         "EXPORT_LINKS_PRE_CLOSE_ONLY")
        self.assertEqual(discover_export_index(page, LATE)["status"],
                         "EXPORT_LINKS_NOT_APPROVED_FOR_INGESTION")
        result = discover_export_index(page, LATE)
        self.assertEqual(result["exact_official_links_discovered"], 6)
        self.assertFalse(result["validated_live_feed"])
        self.assertFalse(result["geographic_needle_calibrated"])

    def test_partial_links_are_not_filled_with_imaginary_feeds(self):
        only_one = {"U.S. Senator by County":"ussenatecty.txt"}
        result = discover_export_index(self.page(only_one), LATE)
        self.assertEqual(result["exact_official_links_discovered"], 1)
        self.assertEqual(set(result["matched_links"]), set(only_one))

    def test_duplicate_crossorigin_and_wrong_election_href_fail_closed(self):
        good=self.page(EXPECTED_EXPORTS)
        senate='https://electionresultsfiles.sos.mn.gov/20261103/ussenatecty.txt'
        for bad in ("https://evil.example/20261103/ussenatecty.txt",
                    "https://electionresultsfiles.sos.mn.gov/20241105/ussenatecty.txt",
                    "https://electionresultsfiles.sos.mn.gov/20261103/ussenatecty.txt?fake=1",
                    "http://electionresultsfiles.sos.mn.gov/20261103/ussenatecty.txt",
                    "https://attacker@electionresultsfiles.sos.mn.gov/20261103/ussenatecty.txt"):
            result=discover_export_index(good.replace(senate,bad),LATE)
            self.assertEqual(result["status"],"UNSAFE_OR_AMBIGUOUS_EXPORT_IDENTITY")
            self.assertEqual(result["exact_official_links_discovered"],0)
        duplicate=good+'<a href="'+senate+'">U.S. Senator by County</a>'
        result=discover_export_index(duplicate,LATE)
        self.assertEqual(result["status"],"UNSAFE_OR_AMBIGUOUS_EXPORT_IDENTITY")
        self.assertEqual(result["matched_links"],{})

    def test_whitelisted_mn_host_election_and_filename(self):
        self.assertTrue(accepted_export_index(EXPORT_INDEX))
        self.assertFalse(accepted_export_index(EXPORT_INDEX.replace("201","200")))
        self.assertFalse(accepted_export_index(EXPORT_INDEX+"&preview=true"))
        for label,name in EXPECTED_EXPORTS.items():
            self.assertTrue(accepted_export_url(
              "https://electionresultsfiles.sos.mn.gov/20261103/"+name,name))
        self.assertFalse(accepted_export_url(
          "https://electionresultsfiles.sos.mn.gov/20261103/ussenate.txt",
          "ussenatecty.txt"))

    def test_wrong_day_wrong_kind_and_unavailable_never_approved(self):
        for page in ("<h1>November 5, 2024</h1>Downloadable Text Files Election results files:",
                     "<h1>August 11, 2026</h1>Downloadable Text Files Election results files:",
                     "<h1>November 3, 2026</h1>State Primary"):
            self.assertEqual(discover_export_index(page,LATE)["status"],
                             "WRONG_2026_EXPORT_INDEX")
        self.assertEqual(discover_export_index(
          self.page(EXPECTED_EXPORTS),LATE,available=False)["status"],
          "EXPORT_INDEX_UNAVAILABLE_NOT_ASSESSED")
        with self.assertRaises(ValueError):
            discover_export_index(self.page(EXPECTED_EXPORTS),
                                  datetime(2026,11,4,2))


if __name__ == "__main__":
    unittest.main()
