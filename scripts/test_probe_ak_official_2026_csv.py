#!/usr/bin/env python3
import unittest
from datetime import datetime, timezone
from probe_ak_official_2026_csv import assess, same_official, OFFICIAL

T = datetime(2026, 10, 24, 19, tzinfo=timezone.utc)
BASE = "<h1>Election Night Reporting</h1><p>Download Results by Precinct (csv)</p>"


class Alaska2026ResultsDiscoveryTests(unittest.TestCase):
    def test_real_official_prefix_not_guessing_csv(self):
        self.assertTrue(same_official(OFFICIAL))
        for url in [
            "http://www.elections.alaska.gov/enr26/",
            "https://evil.example/enr26/precinct.csv",
            "https://www.elections.alaska.gov.evil.example/enr26/x.csv",
            "https://www.elections.alaska.gov:1234/enr26/x.csv",
            "https://attacker@www.elections.alaska.gov/enr26/x.csv",
        ]:
            self.assertFalse(same_official(url), url)

    def test_advertised_download_without_literal_link_is_not_a_verified_feed(self):
        x = assess(BASE, checked_at=T)
        self.assertEqual(x["status"], "OFFICIAL_CSV_ADVERTISED_LINK_UNRESOLVED")
        self.assertEqual(x["official_csv_links"], [])
        self.assertFalse(x["source_id_approved"])
        self.assertFalse(x["may_ingest_votes"])
        self.assertIsNone(x["winner_call"])

    def test_actual_same_origin_csv_link_is_only_identity_hint(self):
        page = BASE + '<a href="/enr26/precincts.csv">CSV file</a>'
        x = assess(page, checked_at=T)
        self.assertEqual(x["status"], "OFFICIAL_CSV_LINK_FOUND_IDENTITY_UNVERIFIED")
        self.assertEqual(x["official_csv_links"],
                         ["https://www.elections.alaska.gov/enr26/precincts.csv"])
        self.assertFalse(x["source_id_approved"])
        self.assertFalse(x["may_move_forecast"])

    def test_official_looking_foreign_link_is_rejected(self):
        page = BASE + '<a href="https://untrusted.example/precincts.csv">CSV</a>'
        x = assess(page, checked_at=T)
        self.assertEqual(x["official_csv_links"], [])
        self.assertEqual(x["status"], "OFFICIAL_CSV_ADVERTISED_LINK_UNRESOLVED")

    def test_test_returns_blocked_even_if_realistic_file_link(self):
        page = BASE + ('<b>Testing In Progress</b><div>656 of 669 precincts reported</div>'
                       '<a href="precincts.csv">Download Results</a>')
        x = assess(page, checked_at=T)
        self.assertEqual(x["status"], "TEST_CONTENT_BLOCKED")
        self.assertFalse(x["may_ingest_votes"])

    def test_scripts_only_research_hints(self):
        page = BASE + '<script src="/enr26/js/results.js"></script>'
        x = assess(page, checked_at=T, script_summaries=[
            {"official_script": "https://www.elections.alaska.gov/enr26/js/results.js",
             "mentions_csv": True, "download_endpoint_verified": False}
        ])
        self.assertEqual(x["linked_script_count"], 1)
        self.assertEqual(x["official_csv_links"], [])
        self.assertFalse(x["source_id_approved"])
        self.assertTrue(x["linked_script_csv_hints"])

    def test_election_clock_does_not_automatically_approve_votes(self):
        late = datetime(2026, 11, 4, 6, tzinfo=timezone.utc)
        x = assess(BASE + '<a href="actual.csv">Results</a>', checked_at=late)
        self.assertFalse(x["may_ingest_votes"])
        self.assertFalse(x["source_id_approved"])
        self.assertIsNone(x["candidate_votes"])

    def test_unavailable_and_wrong_page_fail_closed(self):
        self.assertEqual(assess("", checked_at=T, http_ok=False)["status"],
                         "SOURCE_UNAVAILABLE")
        self.assertEqual(assess("<h1>Other page</h1>", checked_at=T)["status"],
                         "UNEXPECTED_PAGE")
        with self.assertRaises(ValueError):
            assess(BASE, checked_at=datetime(2026, 10, 24))

if __name__ == "__main__":
    unittest.main()
