#!/usr/bin/env python3
"""Two different actual 2024 federal contests; one Fairfax County clock.

Original local Election Summary PDFs are not an archived capture sequence.
Descriptive reporting-method and cross-office error analysis only. Never feed
this output to the 2026 forecast, national needle or professional call desk.
"""
import json
from pathlib import Path
from datetime import datetime, timedelta
from urllib.parse import urlsplit
from audit_fairfax_2024_senate_clock_replay import validate as validate_senate

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"data/fairfax_2024_paired_office_clock_research.json"
BASE="/elections/sites/elections/files/Assets/Documents/PDF/"
FILES=(
 ("2024-11-05T19:08:00-05:00","2024November_results_unofficial.pdf"),
 ("2024-11-05T22:50:00-05:00","2024November_results_unofficial-010.pdf"),
 ("2024-11-06T00:13:00-05:00","2024November_results_unofficial-012.pdf"),
)
TERMINAL=(386438,181895)

def validate(doc,senate):
    if not isinstance(doc,dict) or doc.get("schema")!=(
        "fairfax-2024-official-paired-president-senate-clock-v1"
    ) or doc.get("status")!=(
        "SAME_COUNTY_CROSS_OFFICE_DESCRIPTIVE_RESEARCH_NOT_NATIONAL_CALIBRATION"
    ) or (doc.get("state"),doc.get("county"),doc.get("fips"))!=(
        "VA","Fairfax","51059") or doc.get("election_date")!="2024-11-05" or (
        doc.get("contest")!="2024 President and Vice President") or (
        doc.get("candidate_D")!="Kamala D. Harris") or (
        doc.get("candidate_R")!="Donald J. Trump"
    ) or doc.get("paired_senate_data_path")!=(
        "data/fairfax_2024_senate_election_clock_research.json"
    ) or doc.get("modes")!=["early_voting","election_day","election_night_mail"]:
        raise ValueError("Unmatched race/geography/research provenance")
    for field in (
        "publication_capture_clocks_verified",
        "rights_for_original_data_republication_reviewed",
        "full_precinct_geography_matched",
        "out_of_sample_multi_county_backtest_completed",
        "transferable_reporting_order_bias_established",
        "may_update_2026_model","may_update_2026_live_needle"
    ):
        if doc.get(field) is not False:
            raise ValueError("Unverified president/Senate replay promotion: "+field)
    if doc.get("original_pdfs_not_redistributed") is not True or (
        doc.get("approved_calibration_inputs") != 0
    ) or doc.get("local_clock_kind")!=(
        "Electionware Election Summary section generation time, not independent archived capture"
    ):
        raise ValueError("Cannot authorize county research as national needle inputs")
    final=doc.get("official_final")
    if not isinstance(final,dict) or (final.get("D_votes"),final.get("R_votes"))!=TERMINAL or (
        final.get("source")!="Virginia Department of Elections Fairfax County official 2024 General Election"
    ) or final.get("url")!=(
        "https://enr.elections.virginia.gov/results/public/fairfax-county/elections/2024NovemberGeneral"
    ) or final.get("independently_staged_final_is_not_nighttime_vote_snapshot") is not True:
        raise ValueError("Presidential official final mismatch")
    if not isinstance(senate,dict) or (
        senate.get("schema")!="fairfax-2024-senate-single-county-descriptive-replay-v1"
    ) or senate.get("status")!="SOURCE_MATCHED_REAL_COUNTS_NOT_CALIBRATED" or (
        senate.get("geography")!="VA Fairfax County only"
    ) or senate.get("approved_needle_calibration_inputs")!=0 or (
        senate.get("may_modify_2026_odds") is not False):
        raise ValueError("Untrusted or promoted 2024 Senate comparison")
    senate_by_time={r["section_clock"]:r for r in senate["chronological_samples"]}
    rows=doc.get("chronological_presidential_snapshots")
    if not isinstance(rows,list) or len(rows)!=3:
        raise ValueError("Missing presidential reporting checkpoints")
    previous=None
    baseline=TERMINAL[0]/sum(TERMINAL)
    comparison=[]
    for row,(expected_time,expected_file) in zip(rows,FILES):
        if not isinstance(row,dict) or (
            row.get("section_clock")!=expected_time) or (
            row.get("file")!=expected_file) or (
            row.get("source_status")!="ORIGINAL_ELECTION_SUMMARY_VISUALLY_VERIFIED"
        ) or row.get("original_pdf_page")!=2:
            raise ValueError("Unverified presidential PDF section clock")
        p=urlsplit(row.get("source_url",""))
        if (p.scheme!="https" or p.hostname!="www.fairfaxcounty.gov" or
            p.path!=BASE+expected_file or p.query or p.fragment or
            p.username or p.password):
            raise ValueError("Invalid county official original PDF source")
        stamp=datetime.fromisoformat(expected_time)
        if stamp.utcoffset()!=timedelta(hours=-5):
            raise ValueError("Invalid local 2024 reporting clock")
        observed=[]
        for party in ("D","R"):
            votes=row.get(party+"_by_mode")
            if not isinstance(votes,list) or len(votes)!=3 or any(
                type(n) is not int or n<0 or n>2**53-1 for n in votes
            ):
                raise ValueError("Invalid source presidential ballot modes")
            observed.append(sum(votes))
        d,r=observed
        total=row.get("all_candidates_votes_cast")
        if (type(total) is not int or total<=d+r or d<=0 or r<=0 or
            total>2**53-1 or d>TERMINAL[0] or r>TERMINAL[1]):
            raise ValueError("President D/R and third-party count inconsistent")
        if previous:
            if (d<=previous["D"] or r<=previous["R"] or
                total<=previous["total"]):
                raise ValueError("Non-increasing county results require individual correction review")
            if any(row[k+"_by_mode"][i] < previous[k+"_by_mode"][i]
                   for k in ("D","R") for i in range(3)):
                raise ValueError("Method decrements must be explicitly reviewed")
            if row["D_by_mode"][0]!=previous["D_by_mode"][0] or (
                row["R_by_mode"][0]!=previous["R_by_mode"][0]
            ):
                raise ValueError("Same fully reported early vote unexpectedly changed")
        previous={"D":d,"R":r,"total":total,"D_by_mode":row["D_by_mode"],
                  "R_by_mode":row["R_by_mode"]}
        sr=senate_by_time.get(expected_time)
        if not sr or not sr.get("visual_original_pdf_verified") or (
            sr.get("votes_cast") is None
        ):
            raise ValueError("Missing matching visually verified Senate office clock")
        ds=d/(d+r)
        ss=sr["two_party_D_share"]
        comparison.append({
            "section_clock":expected_time,
            "president_D":d,"president_R":r,
            "president_D_two_party_pct":round(100*ds,4),
            "senate_D_two_party_pct":round(100*ss,4),
            "president_D_share_error_vs_official_final_pp":round(100*(ds-baseline),4),
            "senate_D_share_error_vs_official_final_pp":
                sr["two_party_D_share_error_vs_final_pp"],
            "president_minus_senate_D_two_party_share_pp":round(100*(ds-ss),4),
            "president_fraction_of_final_two_party_ballots":
                round((d+r)/sum(TERMINAL),6),
            "president_early_method_D":row["D_by_mode"][0],
            "president_election_day_method_D":row["D_by_mode"][1],
            "president_mail_method_D":row["D_by_mode"][2],
            "same_county_not_independent_geographic_holdout":True
        })
    if any(x["president_fraction_of_final_two_party_ballots"]>=1 for x in comparison):
        raise ValueError("Incomplete election night snapshots cannot equal certified final")
    return {
        "schema":"fairfax-2024-two-office-clock-descriptive-analysis-v1",
        "status":"ACTUAL_OFFICIAL_MULTI_OFFICE_COUNTY_NOT_CALIBRATED",
        "office_count":2,"same_county":"VA Fairfax County",
        "visual_verified_shared_checkpoints":len(comparison),
        "approved_national_needle_inputs":0,
        "may_modify_2026_forecast":False,
        "final_president_dem_two_party_share":round(baseline,6),
        "final_senate_dem_two_party_share":senate["final_D_share"],
        "comparisons":comparison
    }

def main():
    doc=json.loads(SOURCE.read_text(encoding="utf-8"))
    senate=json.loads((ROOT/"data/fairfax_2024_senate_election_clock_research.json").read_text(encoding="utf-8"))
    result=validate(doc,validate_senate(senate))
    print(json.dumps(result,indent=2))

if __name__=="__main__":
    main()
