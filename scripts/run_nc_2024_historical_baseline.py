#!/usr/bin/env python3
"""Fetch and reconcile original NC 2024 election and Census county sources.

Explicit opt-in --fetch; refuse to publish a forecast or election-night votes.
"""
import argparse
import hashlib
import json
import urllib.request
from pathlib import Path
from fetch_nc_2024_county_reference import URL as CENSUS_URL, transform
from stage_nc_2024_county_mode import URL as NCSBE_URL, fetch_official, parse_tsv
from build_nc_2024_county_baseline import build

def generate(census_response, election_tsv, *, archive_sha256, member):
    csv = transform(census_response)
    staged = parse_tsv(election_tsv)
    report = build(staged, csv)
    report["source_provenance"] = {
        "census_url": CENSUS_URL,
        "census_response_sha256": hashlib.sha256(census_response.encode()).hexdigest(),
        "ncsbe_url": NCSBE_URL,
        "ncsbe_archive_sha256": archive_sha256,
        "ncsbe_member": member}
    report["may_update_live_model"] = False
    return report

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--fetch",action="store_true",required=True)
    ap.add_argument("--output",type=Path,required=True)
    args=ap.parse_args()
    request=urllib.request.Request(CENSUS_URL,headers={"Accept":"application/json","User-Agent":"ElectionCommandCenter/1.0"})
    with urllib.request.urlopen(request,timeout=30) as response:
        census=response.read(150_000).decode("utf-8")
    tsv,digest,member=fetch_official()
    out=generate(census,tsv,archive_sha256=digest,member=member)
    args.output.write_text(json.dumps(out,indent=2)+"\n")
    print("Historical NC county baseline checked: "+str(out["county_count"])+" counties; research only.")

if __name__=="__main__":
    main()
