#!/usr/bin/env python3
"""All fixtures synthetic; 2026 North Dakota votes are NOT accessed."""
import datetime as dt
import unittest
from probe_nd_2026_general_results_portal import (
    OFFICIAL, PORTAL, evaluate, safe_link, get_html, SCHEDULE_EXPECTED
)

EARLY = dt.datetime(2026,10,24,23,tzinfo=dt.timezone.utc)
JUST_BEFORE = dt.datetime(2026,11,4,2,59,59,tzinfo=dt.timezone.utc)
AFTER = dt.datetime(2026,11,4,3,tzinfo=dt.timezone.utc)
LINK = '<a href="https://resultsnd.sos.nd.gov/">General Election Results - November 3, 2026</a>'
PAGE = '<h1>Current Election Cycle Results — 2026</h1>'+LINK
PORTAL_PAGE = '<h1>Election Night Reporting</h1><div>Results Download Menu</div>'


class NorthDakota2026PortalMetadata(unittest.TestCase):
    def test_preclose_and_afterclose_are_not_live_house_coverage(self):
        for at in (EARLY, JUST_BEFORE, AFTER):
            data = evaluate(PAGE, PORTAL_PAGE, at)
            self.assertTrue(data["official_2026_general_link_confirmed"])
            self.assertTrue(data["portal_metadata_reachable"])
            self.assertFalse(data["browser_cors_verified"])
            self.assertFalse(data["download_endpoint_identity_verified"])
            self.assertFalse(data["export_schema_verified"])
            self.assertFalse(data["house_nd_00_machine_source_verified"])
            self.assertFalse(data["independent_race_call_provider_verified"])
            self.assertFalse(data["may_update_forecast"])
            self.assertFalse(data["may_move_geographic_needle"])
            self.assertIsNone(data["verified_2026_votes"])
            self.assertIsNone(data["winner_calls"])
            self.assertIsNone(data["reporting_percentage"])
            self.assertEqual(data["source_says"], SCHEDULE_EXPECTED)
        self.assertEqual(evaluate(PAGE,PORTAL_PAGE,JUST_BEFORE)["status"],
                         "ND_OFFICIAL_PORTAL_PRE_CLOSE_NOT_LIVE_VOTES")
        self.assertEqual(evaluate(PAGE,PORTAL_PAGE,AFTER)["status"],
                         "ND_POST_CLOSE_PORTAL_ONLY_NO_VERIFIED_MACHINE_RESULTS")

    def test_primary_archive_and_duplicate_links_fail_closed(self):
        bad = [
          '<a href="https://results.sos.nd.gov/">General Election Results - November 3, 2026</a>',
          '<a href="https://resultsnd.sos.nd.gov/?cycle=2024">General Election Results - November 3, 2026</a>',
          '<a href="https://resultsnd.sos.nd.gov.evil.example/">General Election Results - November 3, 2026</a>',
          '<a href="http://resultsnd.sos.nd.gov/">General Election Results - November 3, 2026</a>',
          '<a href="https://attacker@resultsnd.sos.nd.gov/">General Election Results - November 3, 2026</a>',
          '<a href="https://resultsnd.sos.nd.gov/primary">General Election Results - November 3, 2026</a>',
          '<a href="https://resultsnd.sos.nd.gov/">2026 Primary Election - June 9, 2026</a>',
          '<a href="https://resultsnd.sos.nd.gov/">2024 General Election Results - November 5, 2024</a>',
        ]
        for page in bad:
            with self.subTest(page=page):
                x = evaluate(page, PORTAL_PAGE, AFTER)
                self.assertFalse(x["official_2026_general_link_confirmed"])
                self.assertFalse(x["house_nd_00_machine_source_verified"])
                self.assertEqual(x["status"],"ND_2026_GENERAL_PORTAL_LINK_NOT_EXACT")
        multi = evaluate(PAGE + LINK, PORTAL_PAGE, AFTER)
        self.assertTrue(multi["ambiguous_2026_general_links"])
        self.assertFalse(multi["official_2026_general_link_confirmed"])

    def test_no_data_source_preview_and_outage(self):
        self.assertEqual(evaluate(PAGE, PORTAL_PAGE+" TEST RESULTS", AFTER)["status"],
                         "ND_OFFICIAL_PORTAL_DISPLAYS_TEST_RESULTS")
        self.assertEqual(evaluate(PAGE, "", AFTER, portal_available=False)["status"],
                         "ND_2026_GENERAL_PORTAL_FETCH_UNAVAILABLE")
        self.assertEqual(evaluate("", PORTAL_PAGE, AFTER, office_available=False)["status"],
                         "ND_OFFICIAL_2026_GENERAL_LINK_UNAVAILABLE")
        with self.assertRaises(ValueError):
            evaluate(PAGE, PORTAL_PAGE, dt.datetime(2026,11,4,3))

    def test_exact_official_https_hosts_and_no_unsupported_url(self):
        self.assertTrue(safe_link(OFFICIAL,"www.sos.nd.gov","/elections/election-results"))
        self.assertTrue(safe_link(PORTAL,"resultsnd.sos.nd.gov","/"))
        for bad in ("https://resultsnd.sos.nd.gov:444/",
                    "https://resultsnd.sos.nd.gov.invalid/",
                    "http://resultsnd.sos.nd.gov/",
                    "https://resultsnd.sos.nd.gov/?e=2024",
                    "https://resultsnd.sos.nd.gov/2024",
                    "https://user@resultsnd.sos.nd.gov/"):
            self.assertFalse(safe_link(bad, "resultsnd.sos.nd.gov", "/"))

if __name__=="__main__":
    unittest.main()
