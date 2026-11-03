#!/usr/bin/env python3
"""Prevent a machine-readable coverage gap from having an invented result path."""
import json
from pathlib import Path
import unittest
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]
PREVIEW_URLS={
 "House|KY-01":"https://votes.decisiondeskhq.com/races/2026-11-03/kentucky-us-house-1-general-election/forecast",
 "House|KY-04":"https://votes.decisiondeskhq.com/races/2026-11-03/kentucky-us-house-4-general-election/forecast",
 "House|KY-05":"https://votes.decisiondeskhq.com/races/2026-11-03/kentucky-us-house-5-general-election/forecast",
 "House|ME-02":"https://votes.decisiondeskhq.com/races/2026-11-03/maine-us-house-2-general-election/forecast",
 "House|NE-02":"https://votes.decisiondeskhq.com/races/2026-11-03/nebraska-us-house-2-general-election/forecast",
 "House|NV-03":"https://votes.decisiondeskhq.com/races/2026-11-03/nevada-us-house-3-general-election/forecast",
}

def _qualified_manual_preview(item):
    note=item.get("scope_note", "")
    return (item.get("link_role")=="forecast_preview_not_results"
            and item.get("id") in PREVIEW_URLS
            and PREVIEW_URLS.get(item.get("id"))==item.get("url")
            and item.get("verification_scope")=="search_index_identity_only"
            and item.get("source_reference")==item.get("url")
            and item.get("results_link_verified") is False
            and item.get("current_access_verified") is False
            and item.get("current_access_status")=="UNKNOWN_NOT_VERIFIED"
            and isinstance(note,str) and all(text in note for text in (
                "Results link not verified", "current page access not verified",
                "no live results or calls verified", "not a vote feed")))

def _qualified_ma04_candidate_guide(item):
    note=item.get("scope_note", "")
    return (item.get("id")=="House|MA-04" and item.get("url")=="https://www.wbur.org/news/2026/10/14/massachusetts-how-to-vote-deadlines-mail-in-early"
            and item.get("link_role")=="candidate_guide_not_results"
            and item.get("verification_scope")=="publisher_reader_candidate_identity_only"
            and item.get("source_reference")==item.get("url")
            and item.get("results_link_verified") is False
            and item.get("current_access_verified") is False
            and item.get("current_access_status")=="UNKNOWN_NOT_VERIFIED"
            and isinstance(note,str) and all(text in note for text in (
                "Candidate identities only", "results not verified", "current native page access not verified",
                "no live results or calls verified", "not a vote feed")))


def _qualified_ma_house_candidate_guide(item, expected_id):
    note=item.get("scope_note","")
    return (expected_id in ["House|MA-01","House|MA-02","House|MA-03","House|MA-04","House|MA-05","House|MA-06","House|MA-07","House|MA-08","House|MA-09"] and item.get("id")==expected_id
            and item.get("url")=="https://www.wbur.org/news/2026/10/14/massachusetts-how-to-vote-deadlines-mail-in-early"
            and item.get("link_role")=="candidate_guide_not_results"
            and item.get("verification_scope")=="publisher_reader_candidate_identity_only"
            and item.get("source_reference")==item.get("url")
            and item.get("results_link_verified") is False
            and item.get("current_access_verified") is False
            and item.get("current_access_status")=="UNKNOWN_NOT_VERIFIED"
            and isinstance(note,str) and all(text in note for text in (
                "Candidate identities only","results not verified","current native page access not verified",
                "no live results or calls verified","not a vote feed")))


def _qualified_ma04_official_candidate_reference(item):
    return (item.get("state")=="MA" and item.get("race_ids")==["House|MA-01","House|MA-02","House|MA-03","House|MA-04","House|MA-05","House|MA-06","House|MA-07","House|MA-08","House|MA-09"]
            and item.get("url")=="https://www.sec.state.ma.us/divisions/elections/research-and-statistics/2026-state-election-candidates.htm" and item.get("source_reference")==item.get("url")
            and item.get("reference_role")=="official_candidate_identity_results_unverified"
            and item.get("mode")=="candidate_identity_reference_results_unverified"
            and item.get("general_2026_results_verified") is False
            and item.get("primary_results_used_as_general_votes") is False
            and isinstance(item.get("scope_note"),str) and "no current" in item["scope_note"])


def _official_manual_reference_host_allowed(item):
    """Human-reference catalog test only; never a provider or ingestion allowlist."""
    parsed=urlparse(item["url"])
    if _qualified_ma04_official_candidate_reference(item):
        return True
    if "reference_role" in item or item.get("state") in ("KY","NV"):
        expected={
            "KY":("https://vrsws.sos.ky.gov/liveresults/Data",
                  {f"House|KY-{n:02d}" for n in range(1,6)}),
            "NV":("https://www.nvsos.gov/sos/elections/election-information/2026-election-information",
                  {"House|NV-03","House|NV-04"}),
        }.get(item.get("state"))
        return bool(expected and item.get("reference_role")=="official_reference_results_unverified"
                    and item["url"]==expected[0] and item.get("source_reference")==item["url"]
                    and set(item.get("race_ids",[]))==expected[1]
                    and item.get("mode")=="results_landing_timing_unconfirmed"
                    and item.get("general_2026_results_verified") is False
                    and item.get("primary_results_used_as_general_votes") is False
                    and isinstance(item.get("scope_note"),str) and "no current" in item["scope_note"])
    if item.get("race_ids")==["House|NY-13"] or parsed.hostname=="vote.nyc":
        note=item.get("scope_note","")
        return (item["url"]=="https://vote.nyc/page/election-results-summary"
                and item.get("state")=="NY"
                and item.get("race_ids")==["House|NY-13"]
                and item.get("mode")=="county_results_directory_only"
                and item.get("source_reference")==item["url"]
                and item.get("general_2026_results_verified") is False
                and item.get("primary_results_used_as_general_votes") is False
                and "2026 primary" in note
                and "November 3 general results not verified" in note
                and "not an independently reconciled NY-13 district total" in note)
    return bool(parsed.hostname and parsed.hostname.endswith((".gov",".us","wyo.gov","nh.gov")))


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
                        "Every active gap has a qualified manual race reference; previews are not Results routes")
        for row in pages:
            if _qualified_ma04_candidate_guide(row) or _qualified_ma_house_candidate_guide(row,row.get("id")):
                self.assertFalse(any(k in row for k in (
                 "winner","winner_call","reported_votes","result","forecast_probability")))
                continue
            p=urlparse(row["url"])
            self.assertEqual(p.scheme,"https")
            self.assertEqual(p.hostname,"votes.decisiondeskhq.com")
            self.assertTrue(p.path.startswith("/races/2026-11-03/"))
            if "link_role" in row:
                self.assertTrue(_qualified_manual_preview(row),
                                "Only the six exact qualified previews are allowed, not Results routes")
            else:
                self.assertTrue(p.path.endswith(("-general-election", "-general-election/results")),
                                "Exact public DDHQ result routes are allowed; unqualified forecasts are not")
            self.assertFalse(p.query or p.fragment or p.username or p.password)
            self.assertFalse(any(k in row for k in (
             "winner","winner_call","reported_votes","result","forecast_probability")))
        self.assertIn("FORECASTS",newsroom["information"])
        self.assertIn("not",newsroom["information"].lower())

    def test_six_search_only_previews_are_finite_and_never_result_routes(self):
        pages={row["id"]:row for row in self.links["public_editorial_calls"]["race_pages"]}
        previews={key:row for key,row in pages.items() if row.get("link_role")=="forecast_preview_not_results"}
        self.assertEqual(set(previews),set(PREVIEW_URLS))
        evidence=json.loads((ROOT/"data/current_gap_manual_reference_directory_evidence.json").read_text())
        observations={row["race_id"]:row for row in evidence["search_observations"]}
        self.assertEqual(len(observations),15)
        for ident,row in observations.items():
            page=pages[ident]
            self.assertEqual(page["url"],row["url"])
            self.assertEqual(page["search_title"],row["title"])
            self.assertEqual(page["search_reference"],row["search_reference"])
            self.assertEqual(page["search_observed_at"],row["observed_at"])
            self.assertEqual(page["verification_scope"],"search_index_identity_only")
            self.assertFalse(row["native_body_owned"])
            self.assertFalse(row["source_HTTP_status_known"])
            self.assertFalse(row["results_link_verified"])
            self.assertIn("no actual result or winner call verified",page["verification"])
        for ident,row in previews.items():
            self.assertTrue(_qualified_manual_preview(row))
            self.assertEqual(row["url"],PREVIEW_URLS[ident])
            self.assertEqual(observations[ident]["link_role"],"forecast_preview_not_results")
            for changes in ({"id":"House|AK-00"},{"url":row["url"]+"?results=true"},
                            {"url":row["url"].removesuffix("/forecast")},
                            {"link_role":"results"},{"verification_scope":"native_results"},
                            {"source_reference":"https://votes.decisiondeskhq.com/"},
                            {"results_link_verified":True},{"current_access_verified":True},
                            {"current_access_status":"AVAILABLE"},{"scope_note":"Forecast"}):
                with self.subTest(ident=ident,changes=changes):
                    self.assertFalse(_qualified_manual_preview({**row,**changes}))
        for state in ("KY","NV"):
            row=next(x for x in self.links["links"] if x["state"]==state)
            self.assertTrue(_official_manual_reference_host_allowed(row))
            for changes in ({"reference_role":"official_results"},{"url":row["url"]+"?results=1"},
                            {"general_2026_results_verified":True},
                            {"primary_results_used_as_general_votes":True},
                            {"source_reference":"https://example.invalid/"},{"scope_note":"Official results"}):
                with self.subTest(state=state,changes=changes):
                    self.assertFalse(_official_manual_reference_host_allowed({**row,**changes}))

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
        kansas=next(row for row in evidence["directories"] if row["state"]=="KS")
        for ident in ("House|KS-03","House|KS-04"):
            self.assertIn(pages[ident]["url"],kansas["declared_race_links"])
            self.assertEqual(pages[ident]["source_directory"],kansas["source"])
            self.assertIn("no actual result or winner call verified",pages[ident]["verification"])
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

    def test_ma04_has_exact_candidate_identity_references_not_results(self):
        official=next(x for x in self.links["links"] if x.get("race_ids")==["House|MA-01","House|MA-02","House|MA-03","House|MA-04","House|MA-05","House|MA-06","House|MA-07","House|MA-08","House|MA-09"])
        guide=next(x for x in self.links["public_editorial_calls"]["race_pages"] if x["id"]=="House|MA-04")
        self.assertTrue(_qualified_ma04_official_candidate_reference(official))
        self.assertTrue(_qualified_ma04_candidate_guide(guide))
        old_ma=next(x for x in self.links["links"] if x["state"]=="MA")
        self.assertEqual(old_ma["race_ids"],["Senate|MA"])
        self.assertEqual(old_ma["mode"],"certified_only_not_election_night")
        evidence=json.loads((ROOT/"data/massachusetts_house_04_manual_reference_evidence.json").read_text())
        self.assertEqual(official["url"],evidence["official"]["url"])
        self.assertEqual(guide["url"],evidence["newsroom"]["url"])
        self.assertFalse(evidence["automatic_vote_ingestion_authorized"])
        self.assertFalse(evidence["automated_call_authorized"])
        for changes in ({"id":"House|MA-03"},{"url":guide["url"]+"?results=1"},
                        {"url":guide["url"]+"/"},{"link_role":"results"},
                        {"source_reference":"https://www.wbur.org/"},{"results_link_verified":True},
                        {"current_access_verified":True},{"current_access_status":"AVAILABLE"},
                        {"verification_scope":"native_results"},{"scope_note":"Results"}):
            self.assertFalse(_qualified_ma04_candidate_guide({**guide,**changes}))
        for changes in ({"race_ids":["House|MA-03"]},{"race_ids":["House|MA-04","Senate|MA"]},
                        {"url":official["url"]+"?results=1"},{"reference_role":"official_results"},
                        {"source_reference":"https://www.sec.state.ma.us/"},
                        {"general_2026_results_verified":True},{"scope_note":"Official results"}):
            self.assertFalse(_qualified_ma04_official_candidate_reference({**official,**changes}))

    def test_ma_house_candidate_family_is_finite_and_context_bound(self):
        ids=["House|MA-01","House|MA-02","House|MA-03","House|MA-04","House|MA-05","House|MA-06","House|MA-07","House|MA-08","House|MA-09"]
        evidence=json.loads((ROOT/"data/massachusetts_house_manual_reference_evidence.json").read_text())
        self.assertEqual([row["id"] for row in evidence["races"]],ids)
        self.assertIsNone(evidence["races"][0]["official_names_parties"][0]["party"])
        official=next(row for row in self.links["links"] if row.get("race_ids")==ids)
        self.assertTrue(_qualified_ma04_official_candidate_reference(official))
        for i,race_id in enumerate(ids):
            guide=next(row for row in self.links["public_editorial_calls"]["race_pages"] if row["id"]==race_id)
            self.assertTrue(_qualified_ma_house_candidate_guide(guide,race_id))
            wrong_id=ids[(i+1)%len(ids)]
            self.assertFalse(_qualified_ma_house_candidate_guide(guide,wrong_id))
            self.assertFalse(_qualified_ma_house_candidate_guide({**guide,"id":wrong_id},race_id))
            for changes in ({"url":guide["url"]+"?results=1"},{"link_role":"results"},
                            {"current_access_verified":True},{"results_link_verified":True},
                            {"verification_scope":"native_results"},{"scope_note":"Results"}):
                self.assertFalse(_qualified_ma_house_candidate_guide({**guide,**changes},race_id))
        self.assertFalse(_qualified_ma_house_candidate_guide({**guide,"id":"House|MA-10"},"House|MA-10"))
        self.assertFalse(_qualified_ma_house_candidate_guide(guide,None))
        for bad_ids in (list(reversed(ids)),ids+["Senate|MA"],ids[:-1],[ids[0]]*9):
            self.assertFalse(_qualified_ma04_official_candidate_reference({**official,"race_ids":bad_ids}))

    def test_links_cannot_masquerade_as_live_results(self):
        for item in self.links["links"]:
            parsed=urlparse(item["url"])
            self.assertEqual(parsed.scheme,"https")
            self.assertTrue(_official_manual_reference_host_allowed(item))
            self.assertTrue(item["race_ids"])
            self.assertTrue(all(x.split("|",1)[1][:2]==item["state"] for x in item["race_ids"]))
            self.assertIn(item["mode"],{
             "unofficial_results_landing","results_landing_timing_unconfirmed",
             "post_election_results_landing","certified_only_not_election_night",
             "official_results_landing","2026_results_landing",
             "pre_election_mock_results_only",
             "november_2026_results_not_yet_published",
             "county_results_directory_only","candidate_identity_reference_results_unverified"})
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


    def test_ny13_manual_NYC_scope_is_exact_and_never_primary_vote_admission(self):
        evidence=json.loads((ROOT/"data/new_york_house_13_manual_reference_evidence.json").read_text())
        self.assertEqual(evidence["id"],"House|NY-13")
        nyc=next(row for row in self.links["links"] if row["race_ids"]==["House|NY-13"])
        self.assertEqual(nyc["url"],evidence["official"]["url"])
        self.assertEqual(nyc["source_reference"],nyc["url"])
        self.assertEqual(nyc["mode"],"county_results_directory_only")
        self.assertIn("2026 primary",nyc["scope_note"])
        self.assertIn("November 3 general results not verified",nyc["scope_note"])
        self.assertIn("not an independently reconciled NY-13 district total",nyc["scope_note"])
        self.assertFalse(nyc["general_2026_results_verified"])
        self.assertFalse(nyc["primary_results_used_as_general_votes"])
        self.assertEqual(evidence["jurisdiction"]["official_county_labels"],["New York","Bronx"])
        self.assertEqual(nyc["jurisdiction_reference"],evidence["jurisdiction"]["url"])
        page=next(row for row in self.links["public_editorial_calls"]["race_pages"] if row["id"]=="House|NY-13")
        observed=evidence["ddhq"]
        self.assertEqual(page["url"],observed["url"])
        self.assertEqual(page["source_directory"],observed["source_directory"])
        self.assertEqual(observed["observed_header"],"2026 New York US House 13")
        self.assertEqual(observed["observed_election_date"],"2026-11-03")
        self.assertEqual(observed["source_display_clock_as_read"],"Oct 23, 2:32 PM")
        self.assertTrue(observed["http_status_not_exposed"])
        self.assertFalse(observed["results_body_read"])
        self.assertIn("no actual result or winner call verified",page["verification"])
        self.assertTrue(evidence["no_actual_results_verified"])
        for key in ("automatic_vote_ingestion_authorized","automated_call_authorized",
                    "native_results_machine_identifier_verified","rights_or_license_grant_claimed",
                    "county_results_complete_or_matched_claimed"):
            self.assertFalse(evidence[key])
        self.assertTrue(_official_manual_reference_host_allowed(nyc))
        mutations=[
            {"url":"https://vote.nyc/page/election-results-summary-2024"},
            {"url":"https://vote.nyc/page/election-results-summary/"},
            {"url":"https://vote.nyc/page/election-results-summary?race=13"},
            {"url":"https://www.vote.nyc/page/election-results-summary"},
            {"url":"https://vote.nyc.evil.example/page/election-results-summary"},
            {"url":"https://nyenr.elections.ny.gov/"},
            {"race_ids":["House|NY-26"]},
            {"race_ids":["House|NY-13","House|NY-26"]},
            {"state":"NJ"},
            {"mode":"2026_results_landing"},
            {"source_reference":"https://vote.nyc/"},
            {"general_2026_results_verified":True},
            {"primary_results_used_as_general_votes":True},
            {"scope_note":"NYC results"},
        ]
        for updates in mutations:
            with self.subTest(updates=updates):
                self.assertFalse(_official_manual_reference_host_allowed({**nyc,**updates}))
        for old in self.links["links"]:
            if old is not nyc:
                self.assertTrue(_official_manual_reference_host_allowed(old))

if __name__=="__main__":
    unittest.main()
