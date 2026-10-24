#!/usr/bin/env python3
"""Read-only original NC 2020 Senate ZIP discovery for future same-office comparison.

This first audit establishes source URL, exact contest group, SHA, 100 county
identities and certified Senate D/R statewide totals. It does NOT preapprove
the source SHA for production or let historical data modify a 2026 needle.
"""
import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import urllib.request
import zipfile
from pathlib import Path

from aggregate_nc_official_precinct_votes import aggregate, REQUIRED
from run_nc_official_zip_historical_replay import load_verified_crosswalk

SOURCE="https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2020_11_03/results_pct_20201103.zip"
MEMBER="results_pct_20201103.txt"
OFFICIAL_DATE="11/03/2020"
CERTIFIED={"DEM":2_569_965,"REP":2_665_598}
MAX_ZIP=95_000_000

def identify(raw):
    rows=csv.DictReader(io.StringIO(raw),delimiter="\t")
    if not rows.fieldnames or not {"Election Date","Contest Name","Contest Group ID"}.issubset(rows.fieldnames):
        raise ValueError("Official 2020 TSV contest identity fields missing")
    found=set()
    for row in rows:
        name=str(row.get("Contest Name") or "").strip()
        if row.get("Election Date")==OFFICIAL_DATE and name.startswith("US SENATE"):
            group=str(row.get("Contest Group ID") or "").strip()
            if not group:
                raise ValueError("Official Senate contest group ID absent")
            found.add((name,group))
    if len(found)!=1:
        raise ValueError("Missing or ambiguous 2020 federal Senate contest group")
    return next(iter(found))

def normalize_2020_columns(raw):
    """Map 2020 NCSBE One Stop -> current early-vote field, strictly.

    2020 has a Real Precinct informational column and one trailing blank
    header. Both are excluded only after ensuring no unexpected payload
    appears under the unnamed column. Source ZIP bytes remain unchanged.
    """
    reader=csv.DictReader(io.StringIO(raw),delimiter="\t")
    expected=(REQUIRED-{"Early Voting"})|{"One Stop","Real Precinct",""}
    if (not reader.fieldnames or len(reader.fieldnames)!=len(set(reader.fieldnames))
        or set(reader.fieldnames)!=expected):
        raise ValueError("Unrecognized official 2020 One Stop source columns")
    export=[("Early Voting" if name=="One Stop" else name)
            for name in reader.fieldnames if name not in ("Real Precinct","")]
    if set(export)!=REQUIRED:
        raise ValueError("2020 normalized source fields not exactly expected")
    out=io.StringIO()
    writer=csv.DictWriter(out,fieldnames=export,delimiter="\t",lineterminator="\n")
    writer.writeheader()
    for row in reader:
        if row.get(None) or row.get("") not in ("",None):
            raise ValueError("Unexpected unofficial data in unnamed 2020 TSV field")
        cleaned={}
        for old in reader.fieldnames:
            if old in ("Real Precinct",""):
                continue
            cleaned["Early Voting" if old=="One Stop" else old]=row.get(old)
        writer.writerow(cleaned)
    return out.getvalue()


def inspect(payload,crosswalk,expected_totals=CERTIFIED,expected_counties=100):
    if not isinstance(payload,bytes) or not payload or len(payload)>MAX_ZIP:
        raise ValueError("Missing or oversized official 2020 ZIP")
    sha=hashlib.sha256(payload).hexdigest()
    try:
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            members=archive.infolist()
            if len(members)!=1 or members[0].filename!=MEMBER or (
                members[0].file_size>150_000_000 or
                members[0].file_size>200*max(1,members[0].compress_size)):
                raise ValueError("Unexpected official 2020 precinct archive structure")
            raw=archive.read(MEMBER).decode("utf-8-sig")
    except (zipfile.BadZipFile,UnicodeError,RuntimeError) as exc:
        raise ValueError("Unreadable official 2020 precinct archive") from exc
    name,group=identify(raw)
    # Historical source calls early in-person ballots "One Stop".
    # Strictly convert that source field without reinterpreting vote methods.
    normalized=normalize_2020_columns(raw)
    counties=aggregate(normalized,date=OFFICIAL_DATE,contest=name,
                       contest_group_id=group,county_fips=crosswalk)
    if len(counties)!=expected_counties or len({c["county_id"] for c in counties})!=len(counties):
        raise ValueError("Incomplete or duplicate official 2020 Senate counties")
    observed={"DEM":0,"REP":0}
    for county in counties:
        found={}
        for c in county["candidates"]:
            party=c["party"]
            if party in observed:
                if party in found or type(c["votes"]) is not int or c["votes"]<0:
                    raise ValueError("Duplicate or invalid major-party official county count")
                found[party]=c["votes"]
                observed[party]+=c["votes"]
        if set(found)!=set(observed) or sum(found.values())<=0:
            raise ValueError("Missing major-party county candidate totals")
    if observed!=expected_totals:
        raise ValueError("Official ZIP Senate D/R total not equal certified contest votes")
    return {"schema":"nc-2020-senate-zip-source-audit-v1",
      "status":"OFFICIAL_SOURCE_DISCOVERY_NEEDS_INDEPENDENT_SHA_APPROVAL",
      "year":2020,"office":"Senate","election_date":"2020-11-03",
      "source_url":SOURCE,"archive_sha256_discovered":sha,
      "archive_member":MEMBER,"contest_name_discovered":name,
      "contest_group_id_discovered":group,
      "county_count":len(counties),"certified_statewide_major_party_votes":observed,
      "source_2020_schema_normalized":"One Stop to Early Voting; Real Precinct metadata dropped",
      "source_sha_pinned_for_model":False,
      "same_office_as_2026_senate":True,
      "same_candidates_as_2026_senate":False,
      "2026_prediction_calibrated":False,
      "may_move_national_needle":False,
      "historical_counties":counties}

def fetch():
    req=urllib.request.Request(SOURCE,headers={
        "User-Agent":"ElectionCommandCenter/1.0 official-NC-2020-senate-audit"})
    with urllib.request.urlopen(req,timeout=50) as response:
        if response.status!=200:
            raise ValueError("Official NC 2020 ZIP HTTP response not 200")
        data=response.read(MAX_ZIP+1)
    if len(data)>MAX_ZIP:
        raise ValueError("Official source response too large")
    return data

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--crosswalk",type=Path,default=Path("data/nc_2024_county_fips_reference.csv"))
    args=parser.parse_args()
    result=inspect(fetch(),load_verified_crosswalk(args.crosswalk.read_text()))
    args.output.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({k:result[k] for k in (
      "status","source_url","archive_sha256_discovered","contest_name_discovered",
      "contest_group_id_discovered","county_count",
      "certified_statewide_major_party_votes","may_move_national_needle")},indent=2))

if __name__=="__main__":
    main()
