#!/usr/bin/env python3
"""Stage 2022 and 2024 House general-election returns, never impute 2026.

Public CC0 copy of the MIT Election Data and Science Lab constituency results.
A 2024 numbered district is NOT necessarily a 2026 numbered district's geography.
"""
import csv
import datetime as dt
import gzip
import hashlib
import io
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from build_seat_universe import HOUSE_COUNTS

ROOT=Path(__file__).resolve().parents[1]
SOURCE="https://crproject.org/data/jsoncsv/mit-1976-2024-house.csv"
SOURCE_ORIGINAL="https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/IG0UN2"
DEST=ROOT/"data/house_history_2024_staging.json"
PINNED=ROOT/"data/house_historical_sources/mit-1976-2024-house.csv.gz"
MANIFEST=ROOT/"data/house_historical_sources/source.json"
PARTY_REVISION="exact_major_labels_and_verified_candidate_fusion_v1"

def clean_district(value):
    x=str(value or "").strip().upper()
    if x in ("","NA","N/A"):return None
    if x in ("AL","AT LARGE","AT-LARGE","0","00"):return 1
    if not x.isdigit():return None
    return int(x)

def count(value):
    # Missing remains missing; fractional counts must not be truncated.
    text=str(value if value is not None else "").strip().replace(",", "")
    if re.fullmatch(r"[0-9]+",text):return int(text)
    return None

def party_group(value):
    party=re.sub(r"\s+"," ",str(value or "").upper().strip())
    if party in {"DEMOCRAT","DEMOCRATIC","DEM","DFL","DEMOCRATIC-FARMER-LABOR",
                 "DEMOCRATIC-NPL","DEMOCRATIC-NONPARTISAN LEAGUE"}:return "dem"
    if party in {"REPUBLICAN","REP","GOP","REPUBLICAN, LIBERTARIAN"}:return "rep"
    return "other"

def candidate_key(row):
    name=re.sub(r"\s+"," ",str(row.get("candidate") or "").strip().casefold())
    if (str(row.get("writein") or "").upper()=="TRUE" or
        name in {"","na","n/a","blank","void","none","scattering","scattered","writein","write-in","write in"} or
        "write-in" in name or "write in" in name):return None
    return name

def stage(text, year=2024):
    if year not in (2022,2024):raise ValueError("Only 2022/2024 source snapshots approved")
    source=csv.DictReader(io.StringIO(text))
    columns=set(source.fieldnames or [])
    required={"year","state_po","district","stage","party","candidate","candidatevotes",
              "office","mode","fusion_ticket","writein"}
    if not required<=columns:
        raise ValueError("MIT House source changed schema; fields missing: "+str(sorted(required-columns)))
    aggregates=defaultdict(lambda:{"dem":0,"rep":0,"other":0,
                                     "candidate_rows":0,"missing_vote_rows":0,
                                     "fusion_vote_rows_attributed":0,"fusion_votes_attributed":0})
    ballot_rows=defaultdict(list)
    seen=0
    for row in source:
        if str(row.get("year") or "")!=str(year):continue
        if str(row.get("stage") or "").upper() not in ("GEN","GENERAL"):continue
        if str(row.get("special") or "").strip().lower() in ("true","1","yes"):continue
        if row["office"]!="US HOUSE" or row["mode"]!="TOTAL":
            raise ValueError("Wrong office or duplicate vote-method source scope")
        state=(row.get("state_po") or "").strip().upper()
        district=clean_district(row.get("district"))
        if not re.fullmatch("[A-Z]{2}",state) or district is None:continue
        # Exclude D.C./territorial non-voting delegates and impossible district
        # numbers: they are not part of the 435-member House control denominator.
        if state not in HOUSE_COUNTS or not (1<=district<=HOUSE_COUNTS[state]):continue
        key=f"{state}-{district:02d}"
        votes=count(row.get("candidatevotes"))
        a=aggregates[key]
        a["candidate_rows"]+=1
        if votes is None:
            a["missing_vote_rows"]+=1
            continue
        ballot_rows[key].append((candidate_key(row),party_group(row["party"]),votes,
                                 str(row["fusion_ticket"]).upper()=="TRUE"))
        seen+=1
    for key,rows in ballot_rows.items():
        major=defaultdict(set)
        for name,group,votes,fusion in rows:
            if name and group in ("dem","rep"):major[name].add(group)
        for name,group,votes,fusion in rows:
            # The pinned publisher explicitly marks every observed endorsed
            # minor-party row as a fusion ticket. Name alone is insufficient.
            if group=="other" and name and fusion and len(major[name])==1:
                group=next(iter(major[name]))
                aggregates[key]["fusion_vote_rows_attributed"]+=1
                aggregates[key]["fusion_votes_attributed"]+=votes
            aggregates[key][group]+=votes
    if len(aggregates)!=435:
        raise ValueError(f"{year} voting House must contain exactly 435 seat records; parsed "+str(len(aggregates)))
    records=[]
    for key,a in sorted(aggregates.items()):
        total=a["dem"]+a["rep"]
        records.append({
            f"{year}_race_code":key,"election_year":year,
            "recorded_dem_votes":a["dem"],"recorded_rep_votes":a["rep"],
            "recorded_other_votes":a["other"],
            "recorded_two_party_vote_total":total,
            "recorded_dem_share_two_party":round(a["dem"]/total,5) if total else None,
            "missing_major_party_votes":a["dem"]==0 or a["rep"]==0,
            "candidate_rows":a["candidate_rows"],
            "missing_vote_rows":a["missing_vote_rows"],
            "fusion_vote_rows_attributed":a["fusion_vote_rows_attributed"],
            "fusion_votes_attributed":a["fusion_votes_attributed"],
            "geography_comparable_to_2026":"not_verified",
            "eligible_as_2026_prior":False
        })
    return {"status":f"{year}_history_staged_not_2026_priors",
       "source_dataset":"MIT Election Data and Science Lab — US House 1976–2024",
       "source_original":SOURCE_ORIGINAL,
       "source_mirror":SOURCE,
       "source_license":"CC0 per mirror publisher; original dataset citation should be preserved",
       "extracted_at":dt.datetime.now(dt.timezone.utc).isoformat(),
       "source_schema":list(source.fieldnames),
       "source_candidate_rows_with_votes":seen,
       "party_mapping_revision":PARTY_REVISION,
       "fusion_vote_rows_attributed":sum(r["fusion_vote_rows_attributed"] for r in records),
       "fusion_votes_attributed":sum(r["fusion_votes_attributed"] for r in records),
       f"{year}_district_rows":len(records),
       "districts_missing_major_party_votes":sum(x["missing_major_party_votes"] for x in records),
       "map_warning":f"{year} House vote shares must NOT be mapped by district number into 2026 jurisdictions without confirming district geography across each election year.",
       "vote_warning":"Explicit major-party aliases and publisher-marked fusion lines for an exactly matching candidate with one major-party affiliation are combined. Other candidates, write-ins, blanks and voids remain other source rows; other is not a named-candidate-only ballot count. Zero recorded party votes is not an inferred electorate share.",
       "records":records}

def main():
    manifest=json.loads(MANIFEST.read_text(encoding="utf-8"))
    data=gzip.decompress(PINNED.read_bytes())
    if hashlib.sha256(data).hexdigest()!=manifest["sha256"]:raise ValueError("Pinned original House source changed")
    text=data.decode("utf-8-sig")
    for year in (2022,2024):
        parsed=stage(text,year=year)
        parsed.update(extracted_at=manifest["captured_at"],source_sha256=manifest["sha256"],
                      source_archive="data/house_historical_sources/mit-1976-2024-house.csv.gz")
        out=ROOT/"data"/f"house_history_{year}_staging.json"
        if "--check" in sys.argv:
            if json.loads(out.read_text(encoding="utf-8"))!=parsed:raise ValueError("Historical staging does not reproduce: "+str(year))
        else:out.write_text(json.dumps(parsed,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8",newline="\n")
        print(f"Staged {parsed[f'{year}_district_rows']} {year} voting House districts, "+
              f"{parsed['source_candidate_rows_with_votes']} valid candidate vote rows; NOT 2026 forecasts.")

if __name__=="__main__":main()
