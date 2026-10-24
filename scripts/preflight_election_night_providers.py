#!/usr/bin/env python3
"""Bounded public provider preflight; never treats discovered URLs as live votes.

Tests exact Open America 2026 House/Senate/Governor response shape and CORS;
also tests 2026 pinned Maine / Ohio civicAPI detail transport without claiming
candidate votes or professional race calls. No provider credentials required.
"""
import argparse
import datetime as dt
import json
from pathlib import Path
from national_results_coverage_pulse import (
    pulse, valid_candidates, state_poll_closings, _time
)
import urllib.error
import urllib.request

PRIMARY = "https://openamerica.io/elections/results.json?year=2026&office={office}"
SECONDARY = (
    "https://civicapi.org/api/v2/race/87188",  # Maine Senate curated 2026 id
    "https://civicapi.org/api/v2/race/87527",  # Ohio special Senate curated id
)
ORIGIN = "https://jmon18-rgb.github.io"
START = dt.datetime(2026, 11, 3, 23, tzinfo=dt.timezone.utc)
END = dt.datetime(2026, 11, 5, 6, tzinfo=dt.timezone.utc)


def validate_primary(doc, office, now):
    if not isinstance(now,dt.datetime) or now.tzinfo is None:
        raise ValueError("Source preflight must use timezone-aware observer clock")
    now=now.astimezone(dt.timezone.utc)
    if (not isinstance(doc, dict) or doc.get("api") != 1 or
            doc.get("year") != 2026 or doc.get("office") != office or
            doc.get("source") not in ("", "state") or
            not isinstance(doc.get("races"), dict) or len(doc["races"]) > 550 or
            not all(isinstance(doc.get(k), bool)
                    for k in ("live", "stale", "counting", "final")) or
            doc["live"] and (doc["stale"] or doc["final"] or not doc["counting"]) or
            not isinstance(doc.get("counts"), dict) or
            doc["counts"].get("races") != len(doc["races"])):
        raise ValueError("Open America 2026 office schema mismatch")
    at=_time(doc["as_of"]) if doc.get("as_of") else None
    if at is not None and at>now+dt.timedelta(minutes=15):
        raise ValueError("Future provider source timestamp")
    close_map=state_poll_closings()
    import re
    pattern = {
        "House": r"[A-Z]{2}-\d{2}",
        "Senate": r"[A-Z]{2}(?:-special)?",
        "Governor": r"[A-Z]{2}",
    }[office]
    positive = 0
    for key, row in doc["races"].items():
        if (re.fullmatch(pattern, key) is None or not isinstance(row, dict) or
                type(row.get("total")) is not int or row["total"] < 0 or
                row.get("called") is not False or bool(row.get("winner")) or
                not isinstance(row.get("cands"), list) or len(row["cands"]) > 60):
            raise ValueError("Invalid 2026 exact-race or unsourced winner call")
        if row.get("pct_in") is not None and (
                not isinstance(row["pct_in"], (int, float)) or
                not 0 <= row["pct_in"] <= 100):
            raise ValueError("Invalid reported precinct fraction")
        total=0
        for cand in row["cands"]:
            if (not isinstance(cand,dict) or
                    not isinstance(cand.get("n"),str) or not cand["n"].strip() or
                    not isinstance(cand.get("p"),str) or
                    type(cand.get("v")) is not int or cand["v"]<0 or
                    cand.get("pct") is not None and
                    (not isinstance(cand["pct"],(int,float)) or
                     not 0<=cand["pct"]<=100)):
                raise ValueError("Invalid candidate vote arithmetic")
            total+=cand["v"]
        if (total>row["total"] or not valid_candidates(row,row["total"])):
            raise ValueError("Candidate source arithmetic or identity invalid")
        if row["total"]>0:
            if now<START:
                raise ValueError("Pre-election provider unexpectedly reports candidate votes")
            close=close_map.get(key[:2])
            if not close or not at or now<close or at<close:
                raise ValueError("State-local poll closure or source timestamp not satisfied")
            if now-at>dt.timedelta(hours=3):
                raise ValueError("Stale source result cannot count as a live preflight sample")
            if doc["stale"] or not (doc["live"] or doc["final"]):
                raise ValueError("Inactive source snapshot is not reporting candidate votes")
            positive+=1
    return {"status": "SOURCE_TRANSPORT_AND_SCHEMA_VALID_NOT_LIVE_VERIFIED",
            "office": office, "listed_races": len(doc["races"]),
            "positive_vote_races": positive, "winner_calls_verified": 0}


def fetch_json(url):
    req=urllib.request.Request(url,headers={
        "Accept":"application/json", "Accept-Encoding":"identity",
        "Origin":ORIGIN,"User-Agent":"ElectionCommandCenter/1.0 source-preflight"})
    with urllib.request.urlopen(req,timeout=16) as response:
        if response.status!=200:
            raise ValueError("HTTP "+str(response.status))
        cors=response.headers.get("Access-Control-Allow-Origin","").strip()
        if cors not in ("*",ORIGIN):
            raise ValueError("Browser CORS not confirmed for this host")
        body=response.read(2_000_001)
        if len(body)>2_000_000:
            raise ValueError("Source JSON exceeds bounded fetch budget")
        return json.loads(body.decode("utf-8"))


def run_probes(now, coverage_ledger=None):
    results=[]
    primary_docs={}
    for office in ("Senate","House","Governor"):
        try:
            doc=fetch_json(PRIMARY.format(office=office))
            results.append({"provider":"Open America",**validate_primary(doc,office,now)})
            primary_docs[office]=doc
        except (urllib.error.URLError,TimeoutError,ValueError,UnicodeError,
                json.JSONDecodeError) as exc:
            results.append({"provider":"Open America","office":office,
                            "status":"FAILED_TRANSPORT_OR_SCHEMA",
                            "reason":str(exc)[:240]})
    for race,url in (("Senate|ME",SECONDARY[0]),("Senate|OH-special",SECONDARY[1])):
        try:
            doc=fetch_json(url)
            if not isinstance(doc,dict):
                raise ValueError("civicAPI detail response is not an object")
            results.append({"provider":"civicAPI","race":race,
                            "status":"DETAIL_HTTP_AND_BROWSER_CORS_REACHABLE_NOT_LIVE_VERIFIED",
                            "field_count":len(doc)})
        except (urllib.error.URLError,TimeoutError,ValueError,UnicodeError,
                json.JSONDecodeError) as exc:
            results.append({"provider":"civicAPI","race":race,
                            "status":"FAILED_TRANSPORT_OR_SCHEMA",
                            "reason":str(exc)[:240]})
    report={"schema":"election-night-transport-preflight-v1",
            "checked_at":now.isoformat().replace("+00:00","Z"),
            "provider_race_calls_verified":0,
            "source_votes_independently_verified":False,
            "probes":results}
    if coverage_ledger is not None:
        report["nationwide_506_observation_pulse"]=pulse(coverage_ledger,primary_docs,now)
    return report


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--probe",action="store_true")
    parser.add_argument("--output",default="/tmp/election-night-source-preflight.json")
    parser.add_argument("--coverage-ledger",type=Path,default=None)
    args=parser.parse_args()
    if not args.probe:
        parser.error("Use --probe (offline tests use the importable validators)")
    now=dt.datetime.now(dt.timezone.utc)
    ledger=json.loads(args.coverage_ledger.read_text()) if args.coverage_ledger else None
    audit=run_probes(now,ledger)
    with open(args.output,"w",encoding="utf-8") as f:
        json.dump(audit,f,indent=2)
        f.write("\n")
    print(json.dumps(audit,indent=2))
    failed=[row for row in audit["probes"] if row["status"]=="FAILED_TRANSPORT_OR_SCHEMA"]
    if failed:
        if START<=now<END:
            raise SystemExit("Election-night provider transport/CORS/identity outage")
        print("WARNING: pre-election provider readiness gaps. No live result assumptions made.")


if __name__=="__main__":
    main()
