#!/usr/bin/env python3
"""Prevent a machine-readable coverage gap from having an invented result path."""
import json
from pathlib import Path
import unittest
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]

class OfficialBackstopsTests(unittest.TestCase):
    def setUp(self):
        self.ledger=json.loads((ROOT/"data/election_night_source_coverage.json").read_text())
        self.links=json.loads((ROOT/"data/election_night_official_backstops.json").read_text())

    def test_all_current_machine_readable_gaps_have_a_grounded_official_link(self):
        self.assertEqual(len(self.ledger["races"]),506)
        gaps={r["id"] for r in self.ledger["races"]
              if r["gap_status"]=="UNRESOLVED_SOURCE_GAP"}
        mapped=[ident for x in self.links["links"] for ident in x["race_ids"]]
        self.assertTrue(gaps.issubset(set(mapped)), "Every current unresolved race must have an official human-check page")
        self.assertEqual(len(mapped),len(set(mapped)),"Do not duplicate missing races")
        self.assertEqual(self.links["status"],
                         "OFFICIAL_HUMAN_FALLBACK_LINKS_NOT_AUTOMATED_RESULTS")

    def test_links_cannot_masquerade_as_live_results(self):
        for item in self.links["links"]:
            parsed=urlparse(item["url"])
            self.assertEqual(parsed.scheme,"https")
            self.assertTrue(parsed.hostname.endswith((".gov",".us","wyo.gov","nh.gov")))
            self.assertTrue(item["race_ids"])
            self.assertTrue(all(x.split("|",1)[1][:2]==item["state"] for x in item["race_ids"]))
            self.assertIn(item["mode"],{
             "unofficial_results_landing","results_landing_timing_unconfirmed",
             "post_election_results_landing","certified_only_not_election_night",
             "official_results_landing","2026_results_landing",
             "pre_election_mock_results_only",
             "november_2026_results_not_yet_published"})
        for state in ("ME","NE","OH"):
            row=next(x for x in self.links["links"] if x["state"]==state)
            self.assertIn("Senate|"+("OH-special" if state=="OH" else state),row["race_ids"])
        self.assertEqual(next(x for x in self.links["links"] if x["state"]=="NE")["mode"],
                         "pre_election_mock_results_only")
        self.assertEqual(next(x for x in self.links["links"] if x["state"]=="OH")["mode"],
                         "pre_election_mock_results_only")
        for state,official in (
            ("DE","https://elections.delaware.gov/results/"),
            ("WY","https://sos.wyo.gov/Elections/ElectionResults.aspx"),
        ):
            item=next(x for x in self.links["links"] if x["state"]==state)
            self.assertEqual(item["mode"],"november_2026_results_not_yet_published")
            self.assertEqual(item["verified_at"],"2026-10-24")
            self.assertEqual(item["url"],official)
            self.assertEqual(item["source_reference"],official)
            self.assertEqual(item["race_ids"],["House|"+state+"-00"])
        south_dakota=next(x for x in self.links["links"] if x["state"]=="SD")
        self.assertEqual(south_dakota["url"],
                         "https://electionresults.sd.gov/ResultsMedia.aspx")
        self.assertEqual(south_dakota["mode"],"pre_election_mock_results_only")
        self.assertEqual(south_dakota["race_ids"],["House|SD-00"])
        self.assertEqual(south_dakota["verified_at"],"2026-10-24")
        north_dakota=next(x for x in self.links["links"] if x["state"]=="ND")
        self.assertEqual(north_dakota["url"],
                         "https://resultsnd.sos.nd.gov/#election=348")
        self.assertFalse(urlparse(north_dakota["url"]).query)
        self.assertEqual(urlparse(north_dakota["url"]).fragment,"election=348",
                         "This is the official 2026 general UI route, NOT a machine source ID")
        self.assertEqual(north_dakota["race_ids"],["House|ND-00"])
        self.assertEqual(north_dakota["mode"],"2026_results_landing")
        self.assertEqual(north_dakota["verified_at"],"2026-10-24")
        self.assertEqual(north_dakota["source_reference"],
                         "https://www.sos.nd.gov/elections/election-results")
        minnesota=next(x for x in self.links["links"] if x["state"]=="MN")
        self.assertEqual(minnesota["url"],
          "https://electionresults.sos.mn.gov/201")
        self.assertEqual(minnesota["source_reference"],minnesota["url"])
        self.assertEqual(minnesota["race_ids"],["Senate|MN"])
        self.assertEqual(minnesota["mode"],"pre_election_mock_results_only")
        self.assertEqual(minnesota["verified_at"],"2026-10-24")
        mass=next(x for x in self.links["links"] if x["state"]=="MA")
        self.assertEqual(mass["mode"],"certified_only_not_election_night")
        self.assertEqual(mass["race_ids"],["Senate|MA"])
        self.assertEqual(mass["verified_at"],"2026-10-24")
        self.assertEqual(mass["source_reference"],
          "https://www.sec.state.ma.us/divisions/elections/voting-information/announcing-certifying.htm")
        self.assertFalse(any(token in mass.get("mode","") for token in
          ("unofficial_results_landing","2026_results_landing")),
          "Massachusetts does not provide statewide unofficial election-night returns")

        miss=next(x for x in self.links["links"] if x["state"]=="MS")
        self.assertEqual(miss["mode"],"certified_only_not_election_night")
        self.assertEqual(miss["race_ids"],["Senate|MS"])

if __name__=="__main__":
    unittest.main()
