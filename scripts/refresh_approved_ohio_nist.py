#!/usr/bin/env python3
"""Five-minute guarded Ohio official NIST Election Night candidate publication.

Disabled until actual Ohio Nov 3 public returns are manually reviewed and
source/geographic/candidate IDs approved. No pre-election MOCK data fetched
or published by an unapproved build. No calls, ballots left, or probabilities.
"""
import argparse
import datetime as dt
import json
from pathlib import Path
import urllib.request

from build_approved_ohio_nist_results import (
    ROOT_ALTERNATIVE, MAX_BYTES, LIVE_START, approve, iso_date, parse,
)
from probe_ohio_nist_xml_prefix import NoRedirect

OUTPUT=Path("data/ohio_nist_candidate_votes_2026.json")
END=dt.datetime(2026,11,6,6,tzinfo=dt.timezone.utc)


def source_fetch():
    req=urllib.request.Request(ROOT_ALTERNATIVE,method="GET",headers={
       "User-Agent":"ElectionCommandCenter/1.0 Ohio-Official-Approved-ElectionNight",
       "Accept":"text/plain,application/xml,text/xml",
       "Cache-Control":"no-cache",
    })
    opener=urllib.request.build_opener(NoRedirect)
    with opener.open(req,timeout=30) as response:
        if response.status!=200:
            raise ValueError("Approved Ohio source GET status not 200")
        data=response.read(MAX_BYTES+1)
        if len(data)>MAX_BYTES:
            raise ValueError("Official Ohio NIST XML exceeds bound")
        return data


def reject_vote_regression(previous,new):
    if previous is None:
        return
    if (not isinstance(previous,dict) or
        previous.get("schema")!="ohio-nist-candidate-county-2026-v1" or
        previous.get("election_date")!="2026-11-03" or
        previous.get("source",{}).get("url")!=ROOT_ALTERNATIVE or
        previous.get("may_move_national_needle") is not False or
        previous.get("ballots_remaining","missing") is not None or
        previous.get("reporting_fraction","missing") is not None):
        raise ValueError("Previous Ohio county snapshot fails source identity contract")
    older=iso_date(previous["source"]["generated_at"])
    newer=iso_date(new["source"]["generated_at"])
    if newer<older:
        raise ValueError("Official Ohio NIST source generation time regressed")
    before={r["dashboard_race_id"]:r for r in previous.get("races",[])}
    after={r["dashboard_race_id"]:r for r in new.get("races",[])}
    if not set(before).issubset(after):
        raise ValueError("Ohio report lost a previously approved contest")
    for race_id,old in before.items():
        previous_counties={c["county_fips"]:c for c in old.get("counties",[])}
        current_counties={c["county_fips"]:c for c in after[race_id].get("counties",[])}
        if not set(previous_counties).issubset(current_counties):
            raise ValueError("Ohio approved source lost an observed reporting county")
        for fips,row in previous_counties.items():
            vote_counts={
                (c["name"].strip().casefold(),c["party"]):c["votes"]
                for c in current_counties[fips]["candidates"]
            }
            for c in row["candidates"]:
                identity=(c["name"].strip().casefold(),c["party"])
                if vote_counts.get(identity,-1)<c["votes"]:
                    raise ValueError("Ohio source candidate vote regression requires manual review")


def refresh(approval_doc,previous,source,now):
    if approval_doc.get("enabled") is not True:
        return {"status":"DISABLED_SOURCE_NOT_READ","snapshot":None}
    approved_time=approve(approval_doc,now)
    if approved_time>END:
        raise ValueError("Ohio source refresh is outside Election Night window")
    new=parse(source,approval_doc,approved_time)
    reject_vote_regression(previous,new)
    if previous and new["source"]["xml_sha256"]==previous["source"]["xml_sha256"]:
        return {"status":"UNCHANGED","snapshot":previous}
    return {"status":"UPDATED","snapshot":new}


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--approval",type=Path,default=Path("data/ohio_nist_source_approval_2026.json"))
    args=p.parse_args()
    source_approval=json.loads(args.approval.read_text())
    if source_approval.get("enabled") is not True:
        print(json.dumps({"status":"DISABLED_SOURCE_NOT_READ",
                         "source_fetched":False,"2026_votes_published":False}))
        return
    now=dt.datetime.now(dt.timezone.utc)
    approve(source_approval,now)  # Gate BEFORE HTTP source fetch.
    if not LIVE_START<=now<=END:
        print(json.dumps({"status":"OUTSIDE_2026_ELECTION_WINDOW","source_fetched":False}))
        return
    previous=json.loads(OUTPUT.read_text()) if OUTPUT.is_file() else None
    source=source_fetch()
    result=refresh(source_approval,previous,source,now)
    if result["status"]=="UPDATED":
        OUTPUT.write_text(json.dumps(result["snapshot"],indent=2)+"\n")
    print(json.dumps({"status":result["status"],
                      "candidate_counts_source_attributed":result["status"]!="DISABLED_SOURCE_NOT_READ",
                      "source_sha":result["snapshot"]["source"]["xml_sha256"] if result["snapshot"] else None,
                      "race_calls_produced":False,
                      "ballots_remaining_estimated":False,
                      "national_needle_changed":False}))


if __name__=="__main__":
    main()
