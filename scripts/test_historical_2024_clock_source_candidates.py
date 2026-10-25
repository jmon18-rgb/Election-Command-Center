#!/usr/bin/env python3
"""2024 public archive discovery metadata is not a license to ingest AP votes."""
import datetime as dt
import json
import re
from pathlib import Path
import unittest
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT/"data"/"historical_2024_clock_source_candidates.json"

class ArchivedElection2024ResearchLeadTests(unittest.TestCase):
    def test_no_rights_or_votedata_promotion(self):
        x=json.loads(PATH.read_text())
        self.assertEqual(x["schema"],"2024-election-clock-source-candidate-metadata-v1")
        self.assertEqual(x["status"],"REAL_2024_CAPTURE_TIMESTAMPS_FOUND_RIGHTS_NOT_CLEARED")
        self.assertEqual(x["election_date"],"2024-11-05")
        self.assertFalse(x["candidate"]["permission_for_data_ingestion"])
        self.assertFalse(x["candidate"]["permission_for_redistribution"])
        self.assertFalse(x["candidate"]["professionally_reviewed_rights"])
        self.assertFalse(x["candidate"]["source_capture_provenance_verified_independently"])
        self.assertFalse(x["may_update_2026_model"])
        self.assertFalse(x["geographic_needle_calibrated"])
        self.assertEqual(x["approved_backtest_inputs"],0)
        # No AP-derived vote results, candidate names, poll odds or raw JSON
        # are to be published in this metadata manifest.
        forbidden=("dem_votes","rep_votes","candidate_votes","reported_votes",
                   "race_totals","winner","vote_share","cached_payload")
        text=json.dumps(x).lower()
        for key in forbidden:
            self.assertNotIn('"'+key+'":',text)

    def test_virginia_state_enr_research_lead_is_nonproduction(self):
        x=json.loads(PATH.read_text())["alternative_state_source_lead"]
        self.assertEqual(x["state"],"VA")
        self.assertEqual(x["offices"],["president","senate"])
        self.assertEqual(x["election_date"],"2024-11-05")
        self.assertEqual(len(x["published_evidence"]),2)
        for entry in x["published_evidence"]:
            uri=urlsplit(entry["url"])
            self.assertEqual(uri.scheme,"https")
            self.assertEqual(uri.hostname,"digitalpollwatchers.org")
        self.assertEqual(
            urlsplit(x["original_state_results_page"]).hostname,
            "enr.elections.virginia.gov")
        for field in (
            "original_archived_json_files_obtained",
            "contemporaneous_snapshot_timestamps_independently_verified",
            "permission_for_data_ingestion","permission_for_redistribution",
            "source_rights_reviewed",
            "county_level_observations_independently_verified",
            "geographic_boundary_crosswalk_verified",
            "eligible_for_2026_needle_calibration"
        ):
            self.assertIs(x[field],False,
                          "Unverified alternative archive cannot unlock the needle")

    def test_fairfax_original_county_report_clock_lead_never_unlocks_needle(self):
        x=json.loads(PATH.read_text())
        lead=x["county_official_pdf_replay_lead"]
        self.assertEqual(lead["authority"],"Fairfax County Office of Elections")
        self.assertEqual(lead["state"],"VA")
        self.assertEqual(lead["election_date"],"2024-11-05")
        self.assertEqual(lead["scope"],"FAIRFAX_COUNTY_ONLY_NOT_VIRGINIA_STATEWIDE")
        self.assertEqual(urlsplit(lead["official_results_index"]).hostname,
                         "www.fairfaxcounty.gov")
        self.assertEqual(lead["original_pdf_snapshots_verified"],1)
        self.assertTrue(lead["contains_heterogeneous_section_generation_timestamps"])
        self.assertFalse(lead["reported_section_clock_is_publication_or_capture_clock"])
        for flag in (
            "independent_archived_capture_times_verified","vote_count_sequence_verified",
            "same_race_consistency_checked",
            "complete_certified_final_geography_matched",
            "rights_cleared_for_internal_research","redistribution_permission_cleared",
            "eligible_for_2026_needle_calibration","may_move_2026_forecast"
        ):
            self.assertIs(lead[flag],False)
        self.assertEqual(lead["approved_backtest_inputs"],0)
        self.assertEqual(len(lead["reports"]),4)
        snapshots=[]
        for row in lead["reports"]:
            self.assertRegex(row["file"],r"^2024November_results_unofficial-0(?:04|08|11|12)\\.pdf$")
            url=urlsplit(row["url"])
            self.assertEqual(url.scheme,"https")
            self.assertEqual(url.hostname,"www.fairfaxcounty.gov")
            self.assertTrue(url.path.endswith("/"+row["file"]))
            self.assertFalse(url.query or url.fragment)
            self.assertIn(row["evidence_level"],(
                "SEARCH_INDEX_ELECTION_SUMMARY_EXCERPT_ORIGINAL_PDF_UNCHECKED",
                "ORIGINAL_PDF_FIRST_ELECTION_SUMMARY_PAGE_VISUALLY_VERIFIED"
            ))
            stamp=dt.datetime.fromisoformat(row["reported_section_clock_local"])
            self.assertEqual(stamp.utcoffset(),dt.timedelta(hours=-5))
            snapshots.append(stamp.astimezone(dt.timezone.utc))
        self.assertEqual(snapshots,sorted(set(snapshots)),
                         "Original report section clocks must be chronological and unique")
        self.assertEqual(snapshots[0],dt.datetime(2024,11,6,1,38,tzinfo=dt.timezone.utc))
        self.assertEqual(snapshots[-1],dt.datetime(2024,11,6,5,13,tzinfo=dt.timezone.utc))
        self.assertEqual(sum(x["evidence_level"].startswith("ORIGINAL_PDF")
                             for x in lead["reports"]),1)
        # A report-generation timestamp is not an original archived HTTP
        # retrieval time or permission to reuse an election vendor's output.
        self.assertEqual(x["approved_backtest_inputs"],0)

    def test_independent_git_timestamp_evidence_only(self):
        x=json.loads(PATH.read_text())
        self.assertEqual(x["candidate"]["repository"],
                         "cuihaoleo/2024-us-election-result-snapshots")
        samples=x["candidate"]["samples"]
        self.assertGreaterEqual(len(samples),2)
        first=dt.datetime(2024,11,5,23,tzinfo=dt.timezone.utc)
        last=dt.datetime(2024,11,7,tzinfo=dt.timezone.utc)
        stamps=[]
        shas=set()
        for item in samples:
            sha=item["git_sha"]
            self.assertRegex(sha,r"^[0-9a-f]{40}$")
            self.assertNotIn(sha,shas)
            shas.add(sha)
            uri=urlsplit(item["url"])
            self.assertEqual(uri.scheme,"https")
            self.assertEqual(uri.hostname,"github.com")
            self.assertEqual(uri.path,
             "/cuihaoleo/2024-us-election-result-snapshots/commit/"+sha)
            self.assertEqual(uri.query,"")
            self.assertEqual(uri.fragment,"")
            date=dt.datetime.fromisoformat(
                item["commit_time_utc"].replace("Z","+00:00"))
            self.assertTrue(first<=date<last)
            stamps.append(date)
        self.assertEqual(stamps,sorted(stamps))
        self.assertGreater((stamps[-1]-stamps[0]).total_seconds(),3600)

if __name__=="__main__":
    unittest.main()
