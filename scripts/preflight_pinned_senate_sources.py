#!/usr/bin/env python3
"""A bounded rotating REAL HTTP/CORS + race-identity preflight for the pinned
outside-primary 2026 U.S. Senate race endpoints. Not a result or call feed.

Daily default: always ME/Ohio special + five rotating other pinned 2026
Senate identities (all 18 checked over four days). On Nov 3 the workflow
checks a small rotating group hourly. This avoids a sudden bulk crawl of
the free external service.
"""
import argparse
import datetime as dt
import json
import re
from pathlib import Path

from preflight_election_night_providers import fetch_json

BASE = "https://civicapi.org/api/v2/race/"
PRIORITY = ("Senate|ME", "Senate|OH-special")
MAX_PER_PROBE = 7
ROWS_PER_SHARD = 5

def parse_pins(ledger, adapter_text):
    if not isinstance(adapter_text, str):
        raise ValueError("Curated 2026 statewide source adapter text is unavailable")
    if (not isinstance(ledger, dict) or ledger.get("election")!="2026-11-03" or
        ledger.get("status")!="SOURCE_IDENTITY_AUDIT_NOT_LIVE_RESULTS_COVERAGE" or
        not isinstance(ledger.get("races"), list) or len(ledger["races"])!=506):
        raise ValueError("Pinned Senate canary needs the validated 506-race source ledger")
    declared={}
    pattern=r"'(Senate\|[A-Z]{2}(?:-special)?)':\{state:'([A-Z]{2})',name:'([^']+)',office:'Senate',id:(\d+)\}"
    for match in re.finditer(pattern,adapter_text):
        ident,state,name,race_id=match.groups()
        if ident in declared:raise ValueError("Duplicate curated Senate adapter")
        declared[ident]={"state":state,"name":name,"id":int(race_id)}
    records={}
    for row in ledger["races"]:
        if row.get("office")!="Senate" or row.get("source_identity_status")!="PINNED_PREVIOUSLY_VERIFIED_ID":
            continue
        name=row.get("id")
        pin=row.get("pinned_civicapi_id")
        if (name not in declared or row.get("provider_scope")=="Open America 22-state scope" or
            type(pin) is not int or pin!=declared[name]["id"] or
            row.get("state")!=declared[name]["state"] or name in records):
            raise ValueError("Pinned Senate race identity differs from exact 2026 curated adapter")
        records[name]={"race":name,**declared[name]}
    if len(records)!=18 or any(name not in records for name in PRIORITY):
        raise ValueError("Expected 18 exact 2026 Senate supplemental IDs and two priority races")
    return records

def select(pins,now):
    if now.tzinfo is None:raise ValueError("UTC-aware clock required")
    rest=sorted(set(pins)-set(PRIORITY))
    if len(rest)!=16:raise ValueError("Expected 16 non-priority curations")
    # Bound free-provider calls to seven; the fourth day checks the final
    # race rather than silently dropping it or making extra requests.
    pages=(len(rest)+ROWS_PER_SHARD-1)//ROWS_PER_SHARD
    # The scheduled Election Night check runs HOURLY. A date-only rotation
    # would check the same seven sources every hour and leave most races
    # unchecked for the duration of the election.
    utc=now.astimezone(dt.timezone.utc)
    start=dt.datetime(2026,11,3,23,tzinfo=dt.timezone.utc)
    end=dt.datetime(2026,11,5,6,tzinfo=dt.timezone.utc)
    if start<=utc<end:
        slot=int((utc-start).total_seconds()//3600)%pages
    else:
        slot=utc.date().toordinal()%pages
    return [pins[x] for x in PRIORITY]+[
        pins[x] for x in rest[slot*ROWS_PER_SHARD:(slot+1)*ROWS_PER_SHARD]]

def validate_detail(item, doc):
    if (not isinstance(doc,dict) or type(doc.get("id")) is not int or
        doc["id"]!=item["id"] or doc.get("country")!="US" or
        doc.get("province")!=item["state"] or
        doc.get("municipality") not in (None,"") or
        doc.get("district") not in (None,"") or
        not isinstance(doc.get("election_date"),str) or
        not doc["election_date"].startswith("2026-11-03") or
        doc.get("election_name")!=item["name"] or
        doc.get("election_type")!="US Senate" or
        not isinstance(doc.get("candidates"),list) or
        len(doc["candidates"])>60):
        raise ValueError("Pinned civicAPI detail returned mismatched 2026 Senate contest")
    return {"status":"HTTP_CORS_AND_EXACT_RACE_IDENTITY_VALID_NOT_LIVE_VERIFIED",
            "race":item["race"],"id":item["id"],
            "positive_count_coverage_verified":False,
            "winner_call_verified":False}

def probe(pins,now,read=fetch_json):
    results=[]
    for item in select(pins,now):
        url=BASE+str(item["id"])
        try:
            info=validate_detail(item,read(url))
            results.append(info)
        except Exception as err:
            # Individual provider outage or wrong race identity is reported
            # without treating an absent source as zero votes or a race call.
            results.append({"race":item["race"],"id":item["id"],
               "status":"FAILED_TRANSPORT_CORS_OR_EXACT_IDENTITY",
               "reason":str(err)[:200]})
    assert len(PRIORITY)<=len(results)<=MAX_PER_PROBE
    return {"schema":"pinned-2026-senate-rotation-preflight-v1",
      "checked_at":now.isoformat(),"civicapi_sources_total":len(pins),
      "checked_this_run":len(results),
      "not_probed_this_run":len(pins)-len(results),
      "not_a_live_vote_feed":True,"authoritative_calls_verified":0,
      "results":results}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--ledger",type=Path,default=Path("data/election_night_source_coverage.json"))
    parser.add_argument("--adapter",type=Path,default=Path("scripts/civicapi_state_batch.js"))
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    records=parse_pins(json.loads(args.ledger.read_text()),args.adapter.read_text())
    now=dt.datetime.now(dt.timezone.utc)
    report=probe(records,now)
    args.output.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))
    failures=[x for x in report["results"] if x["status"].startswith("FAILED")]
    # Flag actual Election Night source failures in CI, without ever counting
    # a pinned ID as successful vote delivery.
    if failures and dt.datetime(2026,11,3,23,tzinfo=dt.timezone.utc)<=now<dt.datetime(2026,11,5,6,tzinfo=dt.timezone.utc):
        raise SystemExit("Important pinned Senate source transport or identity failed on Election Night")

if __name__=="__main__":
    main()
