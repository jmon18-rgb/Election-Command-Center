#!/usr/bin/env python3
"""Stage MIT/MEDSL Senate results for historical model validation, not 2026 odds.

Uses the Harvard Dataverse dataset DOI rather than an unverified mirror.
Retains regular/special contests independently; independently and third-party
candidates are not reassigned to major parties. No implied 2026 holdovers.
"""
import csv
import datetime as dt
import hashlib
import io
import json
import math
import re
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/"data/senate_history_2020_2022_2024.json"
DOI="doi:10.7910/DVN/PEJ5QU"
BASE="https://dataverse.harvard.edu"
DATASET=BASE+"/dataset.xhtml?persistentId="+urllib.parse.quote(DOI,safe=":/")
API=BASE+"/api/datasets/:persistentId/?persistentId="+urllib.parse.quote(DOI,safe="")
YEARS=(2020,2022,2024)
EXPECTED_FIELDS={"year","state_po","stage","special","party","candidatevotes"}
STATE_CODES={
"AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
"KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
"NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
"VT","VA","WA","WV","WI","WY"
}

def request_json(url):
    req=urllib.request.Request(url,headers={"User-Agent":"BlueWavesElectionResearch/1.0 (+https://github.com/jmon18-rgb/Election-Command-Center)"})
    with urllib.request.urlopen(req,timeout=45) as response:
        return json.load(response)

def resolve_datafile(doc):
    """Select the exact latest published Senate dataset; refuse substitution."""
    files=doc.get("data",{}).get("latestVersion",{}).get("files",[])
    candidates=[file.get("dataFile",{}) for file in files
                if file.get("dataFile",{}).get("filename")=="1976-2024-senate-state.tab"]
    if len(candidates)!=1 or type(candidates[0].get("id")) is not int:
        raise ValueError("MIT Senate 1976-2024 original table not uniquely found")
    return candidates[0]["id"]

def download():
    metadata=request_json(API)
    file_id=resolve_datafile(metadata)
    url=f"{BASE}/api/access/datafile/{file_id}?format=original"
    req=urllib.request.Request(url,headers={"User-Agent":"BlueWavesElectionResearch/1.0; public historical data"})
    with urllib.request.urlopen(req,timeout=60) as response:
        payload=response.read(5_000_001)
    if not 100_000<len(payload)<=5_000_000:
        raise ValueError("Historical Senate source download outside expected bounds")
    return payload.decode("utf-8-sig"),file_id,hashlib.sha256(payload).hexdigest()

def normalize_party(text):
    p=str(text or "").strip().upper()
    if p in ("DEMOCRAT","DEMOCRATIC","DEM","D"):return "D"
    if p in ("REPUBLICAN","REP","GOP","R"):return "R"
    return "OTHER"

def as_votes(raw):
    value=str(raw or "").strip().replace(",","")
    if not re.fullmatch(r"[0-9]+(?:\\.0+)?",value):return None
    num=int(float(value))
    return num if 0<=num<=50_000_000 else None

def parse_source(text,source_file_id=None,sha256=None):
    if not isinstance(text,str) or not text.strip():raise ValueError("No source records")
    first_line=text.splitlines()[0]
    delimiter="\\t" if first_line.count("\\t")>first_line.count(",") else ","
    reader=csv.DictReader(io.StringIO(text),delimiter=delimiter)
    reader.fieldnames=[str(x).strip().lower().replace(" ","_") for x in (reader.fieldnames or [])]
    columns=set(reader.fieldnames)
    if not EXPECTED_FIELDS<=columns:
        raise ValueError("MIT Senate source missing fields: "+str(sorted(EXPECTED_FIELDS-columns)))
    all_rows=defaultdict(lambda:{"D":0,"R":0,"OTHER":0,"candidates":[],
                                 "invalid_vote_rows":0,"candidate_rows":0})
    for row in reader:
        if str(row.get("year","")).strip() not in {str(y) for y in YEARS}:continue
        if str(row.get("stage") or "").strip().upper() not in ("GEN","GENERAL"):continue
        office=str(row.get("office") or "").strip().upper()
        if office and office not in ("US SENATE","U.S. SENATE","SENATE"):continue
        state=str(row.get("state_po") or "").strip().upper()
        if state not in STATE_CODES:continue
        special=str(row.get("special") or "FALSE").strip().lower()
        if special not in ("true","false","1","0","yes","no"):
            raise ValueError("Unknown Senate regular/special flag for "+state)
        contest="special" if special in ("true","1","yes") else "regular"
        year=int(row["year"])
        key=(year,state,contest)
        candidate=str(row.get("candidate") or "").strip()
        votes=as_votes(row.get("candidatevotes"))
        bucket=all_rows[key]
        bucket["candidate_rows"]+=1
        if votes is None:
            bucket["invalid_vote_rows"]+=1
            continue
        party=normalize_party(row.get("party"))
        bucket[party]+=votes
        bucket["candidates"].append({"name":candidate or "Name missing from source",
                                      "party":str(row.get("party") or "").strip(),
                                      "party_group":party,"votes":votes})
    out=[]
    for (year,state,contest),v in sorted(all_rows.items()):
        total=v["D"]+v["R"]+v["OTHER"]
        if total<=0:raise ValueError("No recorded votes for Senate contest "+str((year,state,contest)))
        if v["invalid_vote_rows"]:raise ValueError("Source missing candidate vote values in "+str((year,state,contest)))
        two=v["D"]+v["R"]
        out.append({
            "election_year":year,"state":state,"election_type":contest,
            "historical_race_id":f"{year}-{state}-SEN-"+contest,
            "recorded_dem_votes":v["D"],"recorded_rep_votes":v["R"],
            "recorded_other_votes":v["OTHER"],"recorded_total_candidate_votes":total,
            "recorded_two_party_vote_total":two,
            "dem_share_of_two_party":round(v["D"]/two,6) if two else None,
            "dem_share_of_all_candidates":round(v["D"]/total,6),
            "missing_major_party_vote":v["D"]==0 or v["R"]==0,
            "has_third_party_or_independent_votes":v["OTHER"]>0,
            "candidate_rows":v["candidate_rows"],
            "candidates":v["candidates"],
            "eligible_as_2026_forecast_prior":False,
            "historical_election_result_not_poll":True
        })
    counts={str(y):sum(r["election_year"]==y for r in out) for y in YEARS}
    for y,num in counts.items():
        if not 30<=num<=40:
            raise ValueError(f"Historical Senate {y} has implausible contest count: {num}")
    assert len({r["historical_race_id"] for r in out})==len(out)
    assert all(r["election_type"] in ("regular","special") for r in out)
    return {
        "schema_version":"1.0",
        "status":"historical_senate_results_research_only",
        "source_dataset":"MIT Election Data and Science Lab — U.S. Senate statewide 1976–2024, v8",
        "source_doi":DOI,"source_url":DATASET,"source_license":"CC0 1.0",
        "source_datafile_id":source_file_id,"source_file_sha256":sha256,
        "imported_at":dt.datetime.now(dt.timezone.utc).isoformat(),
        "years":list(YEARS),"contests_by_year":counts,
        "contest_count":len(out),"contests_without_both_major_party_votes":sum(r["missing_major_party_vote"] for r in out),
        "contest_records":out,
        "is_election_forecast":False,
        "can_predict_2026_senate":False,
        "limitations":[
         "Each year contains only Senate seats that were on that year's ballot. Other seats were holdovers.",
         "A state may hold both regular and special elections in one year; keep them distinct.",
         "A missing D or R candidate vote is not imputed. Independent candidacies are kept in Other.",
         "Recorded party candidate votes are not equivalent to historical pre-election polling errors.",
         "Historical Senate contests do not establish the 2026 current nominees, seat incumbency or caucusing."
        ]
    }

def main():
    text,file_id,checksum=download()
    doc=parse_source(text,file_id,checksum)
    DEST.write_text(json.dumps(doc,ensure_ascii=False,separators=(",",":"))+"\\n",encoding="utf-8")
    print("MIT Senate historical outcomes staged:",doc["contests_by_year"],
          "missing major-party vote contests:",doc["contests_without_both_major_party_votes"])

if __name__=="__main__":main()
