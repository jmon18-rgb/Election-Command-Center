#!/usr/bin/env python3
"""Never treat South Dakota's pre-election test totals as live returns."""
from datetime import datetime, timezone
import unittest
from sd_2026_house_official_source import assess, official_url, SOURCE

NOW=datetime(2026,11,4,3,0,tzinfo=timezone.utc)
HEADER=("South Dakota Secretary of State Unofficial Results "
        "General Election November 3, 2026 "
        "Results last updated:11/03/2026 8:35 PM CT "
        "Statewide Voter Turnout Precincts Reporting Statewide Races ")
RACE=("United States Representative Follow This Contest Export EXPORT: "
      "Precincts Fully: 660 / 669 | Partially: 0 / 669 "
      'Marty Jackley Republican 93,007 '
      'Nicole "Nikki" Gronli Democratic 83,230 '
      "total votes 176,237 Governor and Lieutenant Governor ")
def page(header=HEADER, race=RACE, banner=""):
    return "<html><body>"+header+banner+race+"</body></html>"

class SouthDakotaOfficialTests(unittest.TestCase):
    def test_2026_general_exact_official_page_and_live_count(self):
        report=assess(page(),NOW)
        self.assertEqual(report["status"],"SOURCE_REPORTED_UNOFFICIAL_VOTES")
        self.assertEqual(report["race"],"House|SD-00")
        self.assertEqual(report["total"],176237)
        self.assertEqual(report["candidates"][0]["name"],"Marty Jackley")
        self.assertEqual(report["candidates"][1]["name"],'Nicole "Nikki" Gronli')
        self.assertEqual(report["last_updated"],"2026-11-04T02:35:00+00:00")
        self.assertTrue(report["approved_for_live_vote_reconciliation"])
        self.assertIsNone(report["professional_call"])
    def test_pre_election_mock_precincts_and_results_are_never_votes(self):
        for words in ("Testing In Progress ","Mock Results ","Test Results "):
            with self.subTest(words=words):
                x=assess(page(banner=words),NOW)
                self.assertEqual(x["status"],"MOCK_RESULTS_BLOCKED")
                self.assertIsNone(x["total"])
                self.assertEqual(x["candidates"],[])
                self.assertFalse(x["approved_for_live_vote_reconciliation"])
        before=assess(page(),datetime(2026,10,25,14,tzinfo=timezone.utc))
        self.assertEqual(before["status"],"POLLS_NOT_CLOSED")
        self.assertIsNone(before["total"])
    def test_wrong_year_same_site_redirect_and_stale_time(self):
        self.assertEqual(assess(page(header=HEADER.replace("2026 ","2024 ")),NOW)
                         ["status"],"WRONG_ELECTION")
        self.assertFalse(official_url(SOURCE+"&redirect=https://evil.example"))
        self.assertFalse(official_url("http://electionresults.sd.gov/resultsSW.aspx?map=CTY&type=SWR"))
        self.assertEqual(assess(page(),NOW,
            response_url="https://evil.example/resultsSW.aspx?map=CTY&type=SWR")
            ["status"],"UNTRUSTED_SOURCE_OR_REDIRECT")
        self.assertEqual(assess(page(header=HEADER.replace(
            "11/03/2026 8:35 PM", "10/22/2026 8:35 PM")),NOW)
            ["status"],"SOURCE_TIMESTAMP_NOT_CURRENT")
        self.assertEqual(assess(page(),datetime(2026,11,4,1,59,tzinfo=timezone.utc))
            ["status"],"POLLS_NOT_CLOSED")
        self.assertEqual(assess(page(),datetime(2026,11,4,9,tzinfo=timezone.utc))
            ["status"],"SOURCE_TIMESTAMP_NOT_CURRENT")
    def test_candidate_arithmetic_duplicates_and_competing_office(self):
        self.assertEqual(assess(page(race=RACE.replace("176,237", "176,238")),NOW)
            ["status"],"CONTEST_ARITHMETIC_INVALID")
        self.assertEqual(assess(page(race=RACE.replace(
            'Nicole "Nikki" Gronli','Marty Jackley')),NOW)
            ["status"],"DUPLICATE_CANDIDATE")
        self.assertEqual(assess(page(race=RACE.replace(
            "United States Representative","State House Representative")),NOW)
            ["status"],"HOUSE_CONTEST_ABSENT_OR_DUPLICATE")
        self.assertEqual(assess(page(race=RACE.replace(
            "Governor and Lieutenant Governor","")),NOW)
            ["status"],"NO_CONTEST_BOUNDARY")
        self.assertEqual(assess(page(race=RACE.replace(
            "Governor and Lieutenant Governor",
            "United States Representative Governor and Lieutenant Governor")),NOW)
            ["status"],"HOUSE_CONTEST_ABSENT_OR_DUPLICATE")
        self.assertEqual(assess(page(race=RACE.replace(
            "Nicole \"Nikki\" Gronli Democratic 83,230",
            "Unknown unsupported party Unaffiliated 83,230")),NOW)
            ["status"],"CANDIDATES_NOT_VERIFIABLE")
    def test_script_injection_does_not_count_as_election_source(self):
        attack=page().replace("United States Representative",
            "<script>United States Representative</script>Unknown contest")
        self.assertEqual(assess(attack,NOW)["status"],
                         "HOUSE_CONTEST_ABSENT_OR_DUPLICATE")

if __name__=="__main__":
    unittest.main()
