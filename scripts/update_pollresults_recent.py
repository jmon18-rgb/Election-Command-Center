#!/usr/bin/env python3
"""Collect posted-time-sorted 2026 polling with source links and LV/RV flags.

Supplemental NYT-derived source: https://pollresults.org/ (CC BY 4.0).
This supplements the daily recent-polls panel, not the headline poll model.
Matched source IDs only can enrich existing observation metadata.
"""
import datetime as dt
import json
import re
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/pollresults_recent.json"
PRIMARY=ROOT/"data/polls.json"
BASE="https://api.pollresults.org/v1.0/politics/results/"
OFFICES=("senate","house","governor")
NOW=dt.datetime.now(dt.timezone.utc)
CUTOFF=(NOW-dt.timedelta(days=21)).date()
HEADERS={"Accept":"application/json",
         "User-Agent":"InSearchOfBlueWaves/1.0 noncommercial election-data audit"}

def dtparse(raw):
    for fmt in ("%m/%d/%y %H:%M","%m/%d/%Y %H:%M","%m/%d/%y","%m/%d/%Y"):
        try:return dt.datetime.strptime(str(raw or ""),fmt)
        except ValueError:pass
    return None

def source_link(item):
    for key in ("urlTopline","urlArticle","url","urlCrosstab"):
        value=(item.get(key) or "").strip()
        if value.startswith("https://") or value.startswith("http://"):
            return value
    return None

def normalize_race(office,item,q):
    state=str(item.get("state") or "").upper()
    if not re.fullmatch(r"[A-Z]{2}",state):return None
    if office=="senate":return state+"-SEN"
    if office=="governor":return state+"-GOV"
    seat=str(q.get("seatNumber") or "").strip().upper()
    if seat.isdigit():return state+"-"+str(int(seat)).zfill(2)
    if seat in ("AL","AT","AT LARGE"):return state+"-01"
    return None

def convert(office,p):
    if str(p.get("cycle"))!="2026" or p.get("type")!=office:return []
    created=dtparse(p.get("createdAt"))
    end=dtparse(p.get("endDate"))
    if created is None or end is None:return []
    pid=str(p.get("pollId") or "")
    if not pid:return []
    lean=str(p.get("partisan") or "").upper()
    lean="D" if lean in ("DEM","D") else "R" if lean in ("REP","R") else ""
    output=[]
    for q in p.get("questions") or []:
        if str(q.get("stage") or "").lower() not in ("general",""):continue
        candidates={}
        for a in q.get("answers") or []:
            party=str(a.get("party") or "").upper()
            if party not in ("DEM","REP"):continue
            try:
                pct=float(a["pct"])
                if not 0<=pct<=100:continue
            except (ValueError,TypeError,KeyError):continue
            if party not in candidates or pct>candidates[party]["pct"]:
                candidates[party]={"pct":pct,"name":str(a.get("candidateName") or a.get("answer") or "").strip()}
        if not all(k in candidates for k in ("DEM","REP")):continue
        code=normalize_race(office,p,q)
        if not code:continue
        pop=str(q.get("population") or "").strip().lower()
        poll={"race_code":code,"race_type":office,
              "state":str(p["state"]).upper(),"poll_id":pid,
              "question_id":str(q.get("questionId") or ""),
              "pollster":str(p.get("pollster") or p.get("displayName") or ""),
              "dem_name":candidates["DEM"]["name"],"rep_name":candidates["REP"]["name"],
              "dem":round(candidates["DEM"]["pct"],2),
              "rep":round(candidates["REP"]["pct"],2),
              "margin":round(candidates["DEM"]["pct"]-candidates["REP"]["pct"],2),
              "field_end":end.date().isoformat(),
              "field_start":dtparse(p.get("startDate")).date().isoformat() if dtparse(p.get("startDate")) else None,
              "posted_date":created.date().isoformat(),
              "posted_source_datetime":created.strftime("%Y-%m-%dT%H:%M:%S"),
              "posted_source_time":str(p.get("createdAt") or ""), # Time zone unspecified by source
              "posted_date_provenance":"Date PollResults added the poll, NOT independently verified public release date",
              "source_url":source_link(p),
              "sample_population":pop if pop else None,
              "sample_size":q.get("sampleSize"),
              "partisan_lean":lean,
              "source":"PollResults.org / NYT CC BY 4.0"}
        output.append(poll)
    return output

def get_page(office,cursor=None):
    params={"limit":"100"}
    if cursor:params["cursor"]=cursor
    url=BASE+office+"?"+urllib.parse.urlencode(params)
    with urllib.request.urlopen(urllib.request.Request(url,headers=HEADERS),timeout=28) as r:
        return json.loads(r.read(3_000_000).decode("utf-8"))

def collect():
    all_polls=[]
    counts={}
    for office in OFFICES:
        cursor=None
        scanned=0
        total=None
        for page in range(5):
            blob=get_page(office,cursor)
            total=blob.get("total")
            batch=blob.get("results") or []
            scanned+=len(batch)
            for entry in batch:
                created=dtparse(entry.get("createdAt"))
                if not created or created.date()<CUTOFF:continue
                all_polls.extend(convert(office,entry))
            if not batch or not blob.get("cursor"):break
            # Feed sorts by original posted date; do not fetch its full archive.
            times=[dtparse(x.get("createdAt")) for x in batch]
            if times and all(t and t.date()<CUTOFF for t in times):break
            cursor=blob["cursor"]
        counts[office]={"available_in_source":total,"records_examined":scanned}
    return all_polls,counts

def enrich_existing(polls):
    """Only match exact PollResults poll ID + office + field end + candidate shares."""
    if not PRIMARY.exists():return 0
    data=json.loads(PRIMARY.read_text(encoding="utf-8"))
    by={}
    for p in polls:
        key=(p["race_code"],p["poll_id"],p["field_end"],
             round(p["dem"],1),round(p["rep"],1))
        by.setdefault(key,[]).append(p)
    changed=0
    for race in data.get("races",[]):
        for obs in race.get("polls",[]):
            key=(race["race_code"],obs.get("poll_id"),obs.get("field_end"),
                 round(obs.get("dem",0),1),round(obs.get("rep",0),1))
            choices=by.get(key,[])
            if len(choices)!=1:continue
            p=choices[0]
            obs["upstream_posted_date"]=p["posted_date"]
            obs["source_poll_url"]=p["source_url"]
            obs["sample_population"]=p["sample_population"]
            obs["date_provenance"]="PollResults.org posting; NOT verified release date"
            changed+=1
        if race.get("polls"):race["latest"]=race["polls"][0]
    data["secondary_source"]={"provider":"PollResults.org","url":"https://pollresults.org/",
                               "matched_observations":changed,
                               "note":"Only exact ID, race, field date and shares matched; does not affect model weights."}
    PRIMARY.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    return changed

def main():
    polls,counts=collect()
    if len(polls)<30:raise RuntimeError("Too few valid supplemental 2026 poll records; keeping old data")
    seen={}
    # Preserve each question/population observation, rather than silently deduplicating LV/RV.
    for p in polls:
        key=(p["poll_id"],p["question_id"],p["race_code"])
        seen[key]=p
    distinct=list(seen.values())
    distinct.sort(key=lambda p:(p["posted_source_datetime"],p["poll_id"]),reverse=True)
    matches=enrich_existing(distinct)
    payload={"updated_at":NOW.isoformat(),"source":"PollResults.org / NYT-derived CC BY 4.0",
             "source_url":"https://pollresults.org/",
             "date_warning":"Posted date is when this API ingested a poll; not the first public release date.",
             "source_totals":counts,"matched_primary_observations":matches,
             "observations":distinct,
             "retention":"Posted within the previous 21 calendar days; up to five API pages per office; all candidate populations labeled.",
             "sort_policy":"Descending source createdAt date AND time; timezone unspecified, no cross-source UTC inference."}
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("PollResults supplemental rows",len(distinct),"exact primary matches",matches,
          "counts",json.dumps(counts))
if __name__=="__main__":main()
