#!/usr/bin/env python3
"""Actual Fairfax County 2024 Senate report-clock audit; RESEARCH ONLY.

Uses tiny manually transcribed published candidate counts, not full election
vendor PDFs, AP archive data, or production 2026 geographic nowcast inputs.
Times are Electionware summary SECTION generation clocks, never download
capture timestamps or actual precinct-report times.
"""
from __future__ import annotations
import datetime as dt
import json
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "fairfax_2024_senate_election_clock_research.json"
BASE = "/elections/sites/elections/files/Assets/Documents/PDF/"
EXPECTED = (
    ("2024-11-05T19:08:00-05:00", "2024November_results_unofficial.pdf"),
    ("2024-11-05T22:50:00-05:00", "2024November_results_unofficial-010.pdf"),
    ("2024-11-05T23:27:00-05:00", "2024November_results_unofficial-011.pdf"),
    ("2024-11-06T00:13:00-05:00", "2024November_results_unofficial-012.pdf"),
)
VALID_PROVENANCE = {
    "ORIGINAL_PDF_ELECTION_SUMMARY_PAGE_VISUALLY_CHECKED",
    "SEARCH_INDEX_ORIGINAL_PDF_NOT_VISUALLY_CHECKED",
}

def validate(doc):
    if not isinstance(doc, dict) or doc.get("schema") != (
        "official-fairfax-2024-senate-clock-research-v1"
    ) or doc.get("status") != (
        "DESCRIPTIVE_SINGLE_COUNTY_ACTUAL_REPORT_SEQUENCE_NOT_CALIBRATED"
    ) or doc.get("election") != "2024-11-05" or doc.get("authority") != (
        "Fairfax County Office of Elections"
    ) or doc.get("contest") != "2024 Virginia United States Senate" or (
        doc.get("location") != {"state":"VA","county":"Fairfax","fips":"51059"}
    ) or doc.get("candidate_a") != "Timothy M. Kaine" or (
        doc.get("candidate_b") != "Hung Cao"
    ) or doc.get("candidate_a_party") != "D" or (
        doc.get("candidate_b_party") != "R"
    ):
        raise ValueError("Wrong 2024 election, source or geography")
    for field in (
        "source_publication_clocks_independently_verified",
        "source_rights_reviewed",
        "original_report_pdfs_redistributed",
        "independent_timestamp_archive_verified",
        "precinct_or_multicounty_clock_replay",
        "voting_method_bias_generalizable",
        "synthetic_vote_data_present",
        "may_modify_2026_geographic_needle",
        "may_update_2026_forecast",
    ):
        if doc.get(field) is not False:
            raise ValueError("Research-only rights/geographic promotion violation: " + field)
    if doc.get("clocks_are_electionware_section_generation_not_archived_capture") is not True:
        raise ValueError("Report clock is not an independent timestamped capture")
    if doc.get("approved_calibration_inputs") != 0 or (
        doc.get("source_page_number") != 3
    ) or doc.get("vote_mode_names") != [
        "early_voting", "election_day", "election_night_mail"
    ]:
        raise ValueError("Research sample is not authorized for production")
    rows = doc.get("sequential_snapshots")
    if not isinstance(rows, list) or len(rows) != len(EXPECTED):
        raise ValueError("Incomplete exact four-checkpoint chronological source")
    prior = None
    normalized = []
    verified_original = 0
    for i, (row, (expected_stamp, file)) in enumerate(zip(rows, EXPECTED)):
        if not isinstance(row, dict) or (
            row.get("section_generated_local") != expected_stamp
        ):
            raise ValueError("Wrong section clock, source or replay order")
        parsed = dt.datetime.fromisoformat(expected_stamp)
        if parsed.utcoffset() != dt.timedelta(hours=-5) or (
            prior is not None and parsed <= prior
        ):
            raise ValueError("Report clock is not unique chronological Eastern time")
        prior = parsed
        url = urlsplit(row.get("url", ""))
        if (url.scheme != "https" or url.hostname != "www.fairfaxcounty.gov"
            or url.path != BASE + file or url.query or url.fragment or (
            url.username is not None or url.password is not None)):
            raise ValueError("Untrusted 2024 county original PDF URL")
        status = row.get("evidence_level")
        if status not in VALID_PROVENANCE:
            raise ValueError("Source confidence unrecorded")
        if status.startswith("ORIGINAL_PDF"):
            verified_original += 1
        by_party = []
        for party in ("dem", "rep"):
            method = row.get(party + "_votes_by_mode")
            if (not isinstance(method, list) or len(method) != 3 or any(
                type(v) is not int or not 0 <= v <= 2**53-1 for v in method
            )):
                raise ValueError("Invalid source vote-mode counts")
            by_party.append(sum(method))
        d, r = by_party
        write = row.get("write_in_votes")
        cast = row.get("votes_cast_total")
        if (type(write) is not int or type(cast) is not int or
            not (0 <= write < cast <= 2**53-1) or d <= 0 or r <= 0 or
            d + r + write != cast):
            raise ValueError("Source candidate-plus-write-in arithmetic mismatch")
        if normalized:
            prev = normalized[-1]
            if d < prev["D"] or r < prev["R"] or cast <= prev["votes_cast"]:
                raise ValueError("Revisions/duplicates need independent source review")
            if any(row[p + "_votes_by_mode"][0] != rows[0][p + "_votes_by_mode"][0]
                   for p in ("dem","rep")):
                raise ValueError("Early voting already reported cannot jump")
            if any(row[p + "_votes_by_mode"][j] < rows[i - 1][p + "_votes_by_mode"][j]
                   for p in ("dem","rep") for j in range(3)):
                raise ValueError("Unexpected vote method decrease needs manual review")
        normalized.append({
            "section_clock": expected_stamp,
            "D": d, "R": r,
            "votes_cast": cast,
            "two_party_D_share": d / (d + r),
            "vote_method_tallies": {
                "D": list(row["dem_votes_by_mode"]),
                "R": list(row["rep_votes_by_mode"]),
            },
            "visual_original_pdf_verified": status.startswith("ORIGINAL_PDF"),
        })
    if verified_original != 2:
        raise ValueError("Original-PDF inspection status must not be inflated")
    final = doc.get("terminal_benchmark")
    if (not isinstance(final, dict) or final.get("source") != (
        "Virginia Department of Elections official Fairfax County 2024 election results"
    ) or final.get("url") != (
        "https://enr.elections.virginia.gov/results/public/fairfax-county/elections/2024NovemberGeneral"
    ) or type(final.get("dem_votes")) is not int or
        type(final.get("rep_votes")) is not int or (
        final.get("is_a_county_final_not_a_near_midnight_election_night_snapshot") is not True
    ) or final.get("final_vote_method_denominators_not_loaded") is not True):
        raise ValueError("Terminal official county result is missing or wrong")
    fd, fr = final["dem_votes"], final["rep_votes"]
    if fd <= normalized[-1]["D"] or fr <= normalized[-1]["R"]:
        raise ValueError("Later complete county totals cannot trail election-night tally")
    if (fd, fr) != (393906, 186266):
        raise ValueError("Official final benchmark has unexpectedly changed")
    last_share = fd / (fd + fr)
    for i, row in enumerate(normalized):
        row["two_party_D_share_error_vs_final_pp"] = round(
            100 * (row["two_party_D_share"] - last_share), 4
        )
        row["two_party_ballots_fraction_of_final"] = round(
            (row["D"] + row["R"]) / (fd + fr), 6
        )
        if i:
            old = normalized[i - 1]
            delta_d = row["D"] - old["D"]
            delta_r = row["R"] - old["R"]
            if delta_d < 0 or delta_r < 0 or delta_d + delta_r <= 0:
                raise ValueError("Invalid chronological county reporting increment")
            row["incremental_two_party_D_share"] = round(
                delta_d / (delta_d + delta_r), 6
            )
    return {
        "schema": "fairfax-2024-senate-single-county-descriptive-replay-v1",
        "status": "SOURCE_MATCHED_REAL_COUNTS_NOT_CALIBRATED",
        "geography": "VA Fairfax County only",
        "office": "2024 US Senate",
        "first_page_originals_visually_verified": verified_original,
        "source_generation_clock_not_capture_time": True,
        "approved_needle_calibration_inputs": 0,
        "may_modify_2026_odds": False,
        "source_rights_reviewed": False,
        "final_D_share": round(last_share, 6),
        "chronological_samples": normalized,
    }

def main():
    result = validate(json.loads(DATA.read_text(encoding="utf-8")))
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
