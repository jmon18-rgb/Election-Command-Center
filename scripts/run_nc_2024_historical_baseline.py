#!/usr/bin/env python3
"""Fetch and reconcile original NC 2024 election and Census county sources.

Explicit opt-in --fetch; refuse to publish a forecast or election-night votes.
"""
import argparse
import hashlib
import json
import time
import urllib.request
from pathlib import Path
import csv
import io
import re
from fetch_nc_2024_county_reference import URL as CENSUS_URL, transform
from stage_nc_2024_county_mode import URL as NCSBE_URL, fetch_official, parse_tsv
from build_nc_2024_county_baseline import build

CENSUS_ADJACENCY_URL = 'https://www2.census.gov/geo/docs/reference/county_adjacency/county_adjacency2024.txt'

def transform_adjacency(body):
    reader=csv.DictReader(io.StringIO(body),delimiter='|')
    if reader.fieldnames!=['County Name','County GEOID','Neighbor Name','Neighbor GEOID']:
        raise ValueError('Unexpected Census 2024 adjacency schema')
    counties={}
    for row in reader:
        code=row['County GEOID']
        if not code.startswith('37'): continue
        if not re.fullmatch(r'37\d{3}',code):
            raise ValueError('Invalid 2024 county FIPS')
        label=row['County Name']
        if not label.endswith(' County, NC'):
            raise ValueError('Invalid official NC county name')
        name=label[:-len(' County, NC')]
        if code in counties and counties[code]!=name:
            raise ValueError('Conflicting Census county identity')
        counties[code]=name
    if len(counties)!=100 or len(set(counties.values()))!=100:
        raise ValueError('Incomplete Census 2024 NC county geography')
    out=io.StringIO()
    writer=csv.writer(out,lineterminator='\n')
    writer.writerow(['statefp','countyfp','name'])
    for fips,name in sorted(counties.items()):
        writer.writerow(['37',fips[2:],name])
    return out.getvalue()


def generate(census_response, election_tsv, *, archive_sha256, member, census_format="api"):
    csv = transform(census_response) if census_format=="api" else transform_adjacency(census_response)
    staged = parse_tsv(election_tsv)
    report = build(staged, csv)
    report["source_provenance"] = {
        "census_url": CENSUS_URL if census_format=="api" else CENSUS_ADJACENCY_URL,
        "census_response_sha256": hashlib.sha256(census_response.encode()).hexdigest(),
        "ncsbe_url": NCSBE_URL,
        "ncsbe_archive_sha256": archive_sha256,
        "ncsbe_member": member}
    report["may_update_live_model"] = False
    return report

def fetch_census_reference():
    request=urllib.request.Request(CENSUS_URL,headers={
        "Accept":"application/json","User-Agent":"ElectionCommandCenter/1.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request,timeout=30) as response:
                payload=response.read(150_000).decode("utf-8")
            # Fail closed, but provide a short sanitized public response preview.
            try:
                transform(payload)
            except (ValueError, json.JSONDecodeError) as exc:
                preview=repr(payload[:160].replace("\n"," "))
                raise ValueError("Unexpected Census API body prefix: "+preview) from exc
            return payload
        except (ValueError, json.JSONDecodeError) as exc:
            if attempt==2:
                raise ValueError("Census county response invalid; expected 100 counties. "
                                 "Check provider response/content type (empty or HTML is rejected).") from exc
        except (TimeoutError, OSError) as exc:
            if attempt==2: raise
        time.sleep(1+attempt)
    raise ValueError("No valid Census county reference")


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--fetch",action="store_true",required=True)
    ap.add_argument("--output",type=Path,required=True)
    args=ap.parse_args()
    # Census ACS API sometimes serves a 'Missing Key' HTML page. Use the
    # independently documented 2024 Census county adjacency TXT instead.
    request=urllib.request.Request(CENSUS_ADJACENCY_URL,headers={
        'User-Agent':'ElectionCommandCenter/1.0'})
    with urllib.request.urlopen(request,timeout=30) as response:
        census=response.read(3_000_000).decode('utf-8-sig')
    transform_adjacency(census)
    tsv,digest,member=fetch_official()
    out=generate(census,tsv,archive_sha256=digest,member=member,census_format='adjacency')
    args.output.write_text(json.dumps(out,indent=2)+"\n")
    print("Historical NC county baseline checked: "+str(out["county_count"])+" counties; research only.")

if __name__=="__main__":
    main()
