#!/usr/bin/env python3
"""Collect safely redacted original Ohio NIST identity metadata for
Election Night approval review. No mock or real numeric vote totals retained.
The review report is NEVER a source approval.
"""
import argparse
import datetime as dt
import json
import urllib.request
from pathlib import Path

from probe_ohio_nist_xml_prefix import ROOT_ALTERNATIVE,NoRedirect
from build_approved_ohio_nist_results import MAX_BYTES
from prepare_ohio_nist_manual_review import collect

def download():
    req=urllib.request.Request(ROOT_ALTERNATIVE,headers={
       "Accept":"application/xml,text/xml,text/plain",
       "User-Agent":"ElectionCommandCenter/1.0 Ohio-NIST-Identity-Review-Only",
       "Cache-Control":"no-cache",
    })
    client=urllib.request.build_opener(NoRedirect)
    with client.open(req,timeout=30) as response:
        if response.status!=200:raise ValueError("Ohio official source not reachable for review")
        buf=response.read(MAX_BYTES+1)
        if len(buf)>MAX_BYTES:raise ValueError("Ohio XML exceeds safe source review limit")
        return buf

def probe(get=download,now=None):
    now=now or dt.datetime.now(dt.timezone.utc)
    if now.tzinfo is None:raise ValueError("Source review clock must be timezone-aware")
    raw=get()
    report=collect(raw)
    if report.get("numeric_vote_counts_extracted") is not False:
        raise ValueError("Unsafe review report contains vote counts")
    report["discovered_at"]=now.astimezone(dt.timezone.utc).isoformat()
    report["release_status"]="NOT APPROVED: mock or test publication possible until real 2026 election results independently confirmed"
    report["original_xml_stored"]=False
    report["operator_review_required"]=True
    return report

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--probe",action="store_true")
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    if not args.probe:p.error("Pass --probe to request official source metadata")
    try:
        report=probe()
    except Exception as error:
        report={
            "schema":"ohio-nist-metadata-review-draft-v1",
            "status":"OFFICIAL_SOURCE_METADATA_UNAVAILABLE_NOT_APPROVED",
            "reason":str(error)[:250],
            "numeric_vote_counts_extracted":False,
            "candidate_votes_published":False,
            "real_election_results_verified":False,
            "may_move_national_needle":False,
        }
    args.output.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps({
       "status":report["status"],
       "source_sha256":report.get("original_xml_sha256"),
       "counties_and_other_units":len(report.get("counties_and_other_reporting_units",[])),
       "contests_for_review":len(report.get("reviewable_senate_house_governor_contests",[])),
       "numeric_vote_counts_extracted":False,
       "ready_for_automatic_publication":False,
       "output":str(args.output),
    }))
if __name__=="__main__":main()
