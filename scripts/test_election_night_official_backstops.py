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

    def test_new_california_invalid_details_keep_exact_human_references(self):
        ca=next(row for row in self.links["links"] if row["state"]=="CA")
        self.assertEqual(ca["url"],
            "https://voterguide.sos.ca.gov/voter-info/election-results.htm")
        self.assertEqual(ca["mode"],"november_2026_results_not_yet_published")
        self.assertIn("not itself a live race feed",ca["scope_note"])
        pages={row["id"]:row for row in self.links["public_editorial_calls"]["race_pages"]}
        for district in (20,21,23,24,25):
            identity=f"House|CA-{district:02d}"
            self.assertIn(identity,ca["race_ids"])
            page=pages[identity]
            path=urlparse(page["url"]).path.removesuffix("/results")
            self.assertEqual(path,
                f"/races/2026-11-03/california-us-house-{district}-general-election")
            self.assertEqual(page["verified_at"],"2026-10-25")
            self.assertIn("no actual result or winner call verified",page["verification"])

    def test_all_current_machine_readable_gaps_have_a_grounded_official_link(self):
        self.assertEqual(len(self.ledger["races"]),506)
        gaps={r["id"] for r in self.ledger["races"]
              if r["gap_status"]=="UNRESOLVED_SOURCE_GAP"}
        mapped=[ident for x in self.links["links"] for ident in x["race_ids"]]
        self.assertTrue(gaps.issubset(set(mapped)), "Every current unresolved race must have an official human-check page")
        self.assertEqual(len(mapped),len(set(mapped)),"Do not duplicate missing races")
        self.assertEqual(self.links["status"],
                         "OFFICIAL_HUMAN_FALLBACK_LINKS_NOT_AUTOMATED_RESULTS")

    def test_each_machine_identity_gap_has_a_free_exact_2026_media_race_page(self):
        newsroom=self.links["public_editorial_calls"]
        self.assertEqual(newsroom["status"],
         "PUBLIC_MANUAL_NEWSROOM_CHECKS_NOT_VOTE_FEEDS_OR_AUTOMATED_CALLS")
        self.assertEqual(newsroom["provider"],"Decision Desk HQ Votes Free")
        self.assertEqual(newsroom["newsroom_social"],"https://x.com/DecisionDeskHQ")
        expected={r["id"] for r in self.ledger["races"]
                  if r["gap_status"]=="UNRESOLVED_SOURCE_GAP"}
        pages=newsroom["race_pages"]
        ids=[r["id"] for r in pages]
        self.assertEqual(len(ids),len(set(ids)), "No duplicate manual pages")
        self.assertTrue(expected.issubset(set(ids)),
                        "Every active gap has an exact reviewed manual race page")
        for row in pages:
            p=urlparse(row["url"])
            self.assertEqual(p.scheme,"https")
            self.assertEqual(p.hostname,"votes.decisiondeskhq.com")
            self.assertTrue(p.path.startswith("/races/2026-11-03/"))
            self.assertTrue(p.path.endswith(("-general-election", "-general-election/results")),
                            "Exact public DDHQ result routes are allowed; forecast-only routes are not")
            self.assertFalse(p.query or p.fragment or p.username or p.password)
            self.assertFalse(any(k in row for k in (
             "winner","winner_call","reported_votes","result","forecast_probability")))
        self.assertIn("FORECASTS",newsroom["information"])
        self.assertIn("not",newsroom["information"].lower())

    def test_current_gap_repair_uses_observed_directory_links_without_live_claims(self):
        evidence=json.loads((ROOT/"data/current_gap_manual_reference_directory_evidence.json").read_text())
        self.assertTrue(evidence["no_actual_results_verified"])
        observed={url for row in evidence["directories"] for url in row["declared_race_links"]}
        search=evidence["special_search"]
        self.assertEqual(search["heading"],"2026 Wisconsin US House 2")
        self.assertEqual(search["resolved_url"],
            "https://votes.decisiondeskhq.com/races/2026-11-03/wisconsin-us-house-2-general-election")
        observed.add(search["resolved_url"])
        pages={r["id"]:r for r in self.links["public_editorial_calls"]["race_pages"]}
        for ident in evidence["repaired_gap_ids"]:
            row=pages[ident]
            self.assertIn(row["url"],observed,ident)
            self.assertIn("no actual result or winner call verified",row["verification"])
            self.assertFalse(any(k in row for k in ("reported_votes","winner","winner_call","forecast_probability")))
        wi=next(r for r in self.links["links"] if r["state"]=="WI")
        self.assertEqual(wi["mode"],"county_results_directory_only")
        self.assertIn("no central statewide unofficial",wi["scope_note"])
        for state in ("OR","TN"):
            row=next(r for r in self.links["links"] if r["state"]==state)
            self.assertEqual(row["mode"],"november_2026_results_not_yet_published")

    def test_texas_roster_and_new_jersey_county_directory_are_not_live_feeds(self):
        tx=next(x for x in self.links["links"] if x["state"]=="TX")
        self.assertEqual(tx["url"],"https://electionresults.sos.state.tx.us/results.html")
        self.assertEqual(set(tx["race_ids"]),
                         {"House|TX-23","House|TX-33","Senate|TX","Governor|TX"})
        self.assertEqual(tx["mode"],"november_2026_results_not_yet_published")
        self.assertIn("blank ballot fields",tx["scope_note"])
        nj=next(x for x in self.links["links"] if x["state"]=="NJ")
        self.assertEqual(nj["url"],"https://www.nj.gov/state/elections/election-night-results.shtml")
        self.assertEqual(nj["mode"],"county_results_directory_only")
        self.assertIn("neither official nor unofficial",nj["scope_note"])
        self.assertIn("not an independently reconciled",nj["scope_note"])


    def test_nj12_withdrawal_has_grounded_manual_references_not_a_restored_feed(self):
        evidence=json.loads((ROOT/"data/new_jersey_house_12_manual_reference_evidence.json").read_text())
        self.assertEqual(evidence["id"],"House|NJ-12")
        nj=next(row for row in self.links["links"] if row["state"]=="NJ")
        self.assertEqual(set(nj["race_ids"]),{"House|NJ-07","House|NJ-12"})
        self.assertEqual(nj["url"],evidence["official"]["url"])
        self.assertEqual(nj["mode"],"county_results_directory_only")
        self.assertIn("neither official nor unofficial",nj["scope_note"])
        self.assertIn("not an independently reconciled NJ-07 or NJ-12 district total",nj["scope_note"])
        self.assertFalse(evidence["official"]["new_retrieval_performed"])
        page=next(row for row in self.links["public_editorial_calls"]["race_pages"]
                  if row["id"]=="House|NJ-12")
        observed=evidence["ddhq"]
        self.assertEqual(page["url"],observed["url"])
        self.assertEqual(page["url"],"https://votes.decisiondeskhq.com/races/2026-11-03/new-jersey-us-house-12-general-election")
        self.assertEqual(observed["observed_header"],"2026 New Jersey US House 12")
        self.assertEqual(observed["observed_election_date"],"2026-11-03")
        self.assertEqual(observed["observed_state"],"NJ")
        self.assertEqual(observed["observed_office"],"House")
        self.assertEqual(observed["observed_district"],12)
        self.assertEqual(observed["verification_level"],"READER_VISIBLE_BASE_PAGE_IDENTITY_ONLY")
        self.assertEqual(observed["page_kind"],"PUBLIC_PRE_ELECTION_FORECAST_LANDING")
        self.assertTrue(observed["public_page_read_without_account"])
        self.assertTrue(observed["results_navigation_seen"])
        self.assertFalse(observed["results_body_read"])
        self.assertFalse(observed["fresh_native_HTTP_or_last_published_time_claimed"])
        self.assertIn("cached reader",page["verification"])
        self.assertIn("no actual result or winner call verified",page["verification"])
        self.assertTrue(evidence["no_actual_results_verified"])
        for key in ("automatic_vote_ingestion_authorized","automated_call_authorized",
                    "native_results_machine_identifier_verified","rights_or_license_grant_claimed",
                    "county_results_complete_or_matched_claimed"):
            self.assertFalse(evidence[key])
        self.assertFalse(any(key in page for key in
                            ("reported_votes","winner","winner_call","forecast_probability",
                             "provider_race_id","source_registry")))

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
             "november_2026_results_not_yet_published",
             "county_results_directory_only"})
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
        local=mass.get("municipal_unofficial_check")
        self.assertEqual(local["scope"],"BOSTON_CITY_ONLY_NOT_MASSACHUSETTS_STATEWIDE")
        self.assertEqual(local["url"],
          "https://content.boston.gov/departments/elections/unofficial-election-results")
        self.assertEqual(local["current_page_cycle"],"2026-09-01_state_primary")
        self.assertFalse(local["general_2026_live_returns_verified"])
        self.assertFalse(local["auto_vote_ingestion_authorized"])
        self.assertEqual(local["verified_at"],"2026-10-24")
        self.assertFalse(any(token in mass.get("mode","") for token in
          ("unofficial_results_landing","2026_results_landing")),
          "Massachusetts does not provide statewide unofficial election-night returns")

        miss=next(x for x in self.links["links"] if x["state"]=="MS")
        self.assertEqual(miss["mode"],"certified_only_not_election_night")
        self.assertEqual(miss["race_ids"],["Senate|MS"])

if __name__=="__main__":
    unittest.main()
