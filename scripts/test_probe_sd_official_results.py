#!/usr/bin/env python3
import unittest
from datetime import datetime, timezone
from probe_sd_official_results import assess

BEFORE = datetime(2026, 10, 23, tzinfo=timezone.utc)
AFTER = datetime(2026, 11, 4, 2, tzinfo=timezone.utc)
HEADER = "<h1>Unofficial Results General Election November 3, 2026</h1>"


class OfficialSouthDakotaSourceTests(unittest.TestCase):
    def test_realistic_pre_election_test_totals_never_used(self):
        page = HEADER + "<div>Ballots Cast 24,823</div><div>656 / 669</div><b>Testing In Progress</b>"
        for at in (BEFORE, AFTER):
            state = assess(page, at)
            self.assertEqual(state["status"], "TEST_RESULTS_BLOCKED")
            self.assertIsNone(state["votes"])
            self.assertFalse(state["production_votes_usable"])
            self.assertIsNone(state["winner_call"])

    def test_missing_testing_banner_never_grants_ingestion(self):
        self.assertEqual(assess(HEADER, BEFORE)["status"], "POLLS_NOT_CLOSED")
        state = assess(HEADER, AFTER)
        self.assertEqual(state["status"], "EXPORT_CONTRACT_NOT_VERIFIED")
        self.assertFalse(state["export_verified"])
        self.assertIsNone(state["votes"])

    def test_wrong_election_and_empty_response_fail_closed(self):
        self.assertEqual(assess("", AFTER)["status"], "WRONG_OR_UNKNOWN_ELECTION")
        self.assertEqual(assess("<h1>Primary Election July 28, 2026</h1>", AFTER)["status"],
                         "WRONG_OR_UNKNOWN_ELECTION")
        with self.assertRaises(ValueError):
            assess(HEADER, datetime(2026, 11, 4))


if __name__ == "__main__":
    unittest.main()
