#!/usr/bin/env python3
"""Stage 2022 and 2024 House general-election returns, never impute 2026.

Public CC0 copy of the MIT Election Data and Science Lab constituency results.
A 2024 numbered district is NOT necessarily a 2026 numbered district's geography.
"""
import csv
import datetime as dt
import io
import json
import re
import urllib.request
from collections import defaultdict
from pathlib import Path
from build_seat_universe import HOUSE_COUNTS

ROOT=Path(__file__).resolve().parents[1]
SOURCE="https://crproject.org/data/jsoncsv/mit-1976-2024-house.csv"
SOURCE_ORIGINAL="https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/IG0UN2"
DEST=ROOT/"data/house_history_2024_staging.json"

def clean_district(value):
    x=str(value or "").strip().upper()
    if x in ("","NA","N/A"):return None
    if x in ("AL","AT LARGE","AT-LARGE","0","00"):return 1
    if not x.isdigit():return None
    return int(x)

def count(value):
    try:
        v=int(float(str(value or "").replace(",","")))
        if v>=0:return v
    except (TypeError,ValueError):pass
    return None

def stage(text, year=2024):
    if year not in (2022,2024):raise ValueError("Only 2022/2024 source snapshots approved")
    source=csv.DictReader(io.StringIO(text))
    columns=set(source.fieldnames or [])
    required={"year","state_po","district","stage","party","candidatevotes"}
    if not required<=columns:
        raise ValueError("MIT House source changed schema; fields missing: "+str(sorted(required-columns)))
    # Treat DFL, Democratic-NPL, and combined party labels as *actual*
    # major-party ballots, not votes for an 'other' candidate. Fusion states
    # (especially New York) report several lines for the SAME candidate.
    # Aggregate candidate identities before summing party totals: votes cast
    # for that candidate under an endorsed minor-party line still belong to
    # their candidate's two-party total.
    aggregates=defaultdict(lambda:{"dem":0,"rep":0,"other":0,
                                     "candidate_rows":0,"missing_vote_rows":0,
                                     "fusion_vote_rows_attributed":0})
    ballot_rows=defaultdict(list)
    seen=0
    for row in source:
        if str(row.get("year") or "")!=str(year):continue
        if str(row.get("stage") or "").upper() not in ("GEN","GENERAL"):continue
        if str(row.get("special") or "").strip().lower() in ("true","1","yes"):continue
        state=(row.get("state_po") or "").strip().upper()
        district=clean_district(row.get("district"))
        if not re.fullmatch("[A-Z]{2}",state) or district is None:continue
        # Exclude D.C. and non-voting territorial delegates.
        if state not in HOUSE_COUNTS or not (1<=district<=HOUSE_COUNTS[state]):continue
        key=f"{state}-{district:02d}"
        votes=count(row.get("candidatevotes"))
        aggregates[key]["candidate_rows"]+=1
        if votes is None:
            aggregates[key]["missing_vote_rows"]+=1
            continue
        party=str(row.get("party") or "").upper().strip()
        # Normalize only unambiguous party labels; never reassign unnamed
        # or unverified independent candidates to a major party.
        compact=re.sub(r"[^A-Z0-9]+"," ",party).strip()
        if (party in ("DEMOCRAT","DEMOCRATIC","DEM","DFL","D F L",
                      "DEMOCRATIC-FARMER-LABOR","DEMOCRATIC NONPARTISAN LEAGUE",
                      "DEMOCRATIC-NPL","DEMOCRATIC/NPL","DEMOCRATIC-NONPARTISAN LEAGUE")
            or compact.startswith("DEMOCRATIC FARMER LABOR")
            or compact.startswith("DEMOCRATIC NONPARTISAN LEAGUE")
            or compact.startswith("DEMOCRATIC NPL")):
            group="dem"
        elif (party in ("REPUBLICAN","REP","GOP")
              or compact.startswith("REPUBLICAN ")):
            group="rep"
        else:
            group="other"
        name=re.sub(r"\s+"," ",str(row.get("candidate") or "").strip().casefold())
        if (not name or name in ("writein","write-in","write in","scattered","blank","none")
            or "write-in" in name or "write in" in name):
            name=None
        ballot_rows[key].append((name,group,votes))
        seen+=1
    for key,rows in ballot_rows.items():
        candidate_major=defaultdict(set)
        for name,group,votes in rows:
            if name and group in ("dem","rep"):
                candidate_major[name].add(group)
        for name,group,votes in rows:
            # A fusion line can only be reassigned when the SAME candidate
            # has exactly one unambiguous major-party line in this election.
            if group=="other" and name and len(candidate_major[name])==1:
                group=next(iter(candidate_major[name]))
                aggregates[key]["fusion_vote_rows_attributed"]+=1
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
       f"{year}_district_rows":len(records),
       "fusion_vote_rows_attributed":sum(r["fusion_vote_rows_attributed"] for r in records),
       "districts_missing_major_party_votes":sum(x["missing_major_party_votes"] for x in records),
       "map_warning":f"{year} House vote shares must NOT be mapped by district number into 2026 jurisdictions without confirming district geography across each election year.",
       "vote_warning":"Repeated ballot lines for a named candidate are combined only when a single major-party candidate identity is verified within the same House race. Ambiguous independents, write-ins and uncontested races remain separate.",
       "records":records}

def main():
    request=urllib.request.Request(SOURCE,headers={"User-Agent":"InSearchOfBlueWaves/1.0 research source audit"})
    with urllib.request.urlopen(request,timeout=45) as response:
        data=response.read(9_000_000)
    if len(data)<100_000 or len(data)>=9_000_000:raise ValueError("source download size outside expected bounds")
    text=data.decode("utf-8-sig")
    for year in (2022,2024):
        parsed=stage(text,year=year)
        out=ROOT/"data"/f"house_history_{year}_staging.json"
        out.write_text(json.dumps(parsed,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
        print(f"Staged {parsed[f'{year}_district_rows']} {year} voting House districts, "+
              f"{parsed['source_candidate_rows_with_votes']} valid candidate vote rows; NOT 2026 forecasts.")

if __name__=="__main__":main()
