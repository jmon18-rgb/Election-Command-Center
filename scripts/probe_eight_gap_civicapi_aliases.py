#!/usr/bin/env python3
"""One-shot alternative-name discovery for eight unresolved 2026 races.

No guesses, no vote publishing, and immediate stop on provider 429/5xx.
An exact date/state/office/district + verified detail is mandatory.
"""
import json
import re
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from probe_house_coverage_2026 import fetch, detail_matches, explicitly_mock, exact_2026_general_date
from probe_missing_statewide_sources_2026 import CLOSE_UTC

GAPS = ("House|AK-00", "House|DE-00", "House|ND-00",
        "House|NH-01", "House|NH-02", "House|SD-00",
        "House|WY-00", "Senate|MA")
assert len(GAPS)==8
PROBE_NAMES = ("Representative in Congress", "U.S. Representative")
SENATE_NAMES = ("United States Senator", "U.S. Senate")
CIVIC = "https://civicapi.org/api/v2"
LIMIT = 100

def title_matches(key, row):
    if not isinstance(row, dict) or explicitly_mock(row) or (
        row.get("country") != "US" or row.get("municipality") is not None or
        row.get("election_type") != "General" or
        not exact_2026_general_date(row.get("election_date")) or
        type(row.get("id")) is not int or row["id"] <= 0):
        return False
    office, seat = key.split("|")
    state = seat[:2]
    if row.get("province") != state:
        return False
    name = str(row.get("election_name") or "")
    if office == "House":
        if row.get("district") != seat or row.get("type") != "House of Representatives":
            return False
        dist = int(seat[3:])
        if dist == 0:
            return bool(re.search(r"(?i)\\b(?:representative in congress|u\\.?s\\.? representative|house of representatives)\\b",name))
        return bool(re.search(
           rf"(?i)\\b(?:representative in congress|u\\.?s\\.? representative|house of representatives)\\s+(?:district\\s+)?{dist}\\b",
           name))
    return office == "Senate" and row.get("district") is None and (
        row.get("type") == "US Senate" and
        bool(re.search(r"(?i)\\b(?:united states senator|u\\.?s\\.? senate|u\\.?s\\.? senator)\\b",name)))

def find_one(key, request=fetch, now=None):
    office, seat = key.split("|")
    state = seat[:2]
    search_names = PROBE_NAMES if office == "House" else SENATE_NAMES
    now = now or datetime.now(timezone.utc)
    found = {}
    for term in search_names:
        params={"country":"US","province":state,"startDate":"2026-11-03",
                "endDate":"2026-11-03","query":term,"limit":str(LIMIT)}
        try:
            page=request("/race/search", params)
            rows=page.get("races") if isinstance(page,dict) else None
            count=page.get("count") if isinstance(page,dict) else None
            if not isinstance(rows,list) or len(rows)>LIMIT or (
               count is not None and (type(count) is not int or count!=len(rows))):
                return {"key":key,"status":"SEARCH_TRUNCATED_OR_INVALID","term":term}
            for row in rows:
                if title_matches(key,row):
                    found[row["id"]]=row
        except urllib.error.HTTPError as ex:
            if ex.code in (429,502,503,504):
                return {"key":key,"status":"STOP_UPSTREAM_OUTAGE","http":ex.code}
            return {"key":key,"status":"SEARCH_HTTP_ERROR","http":ex.code}
        except (ValueError,TimeoutError,OSError) as ex:
            return {"key":key,"status":"SEARCH_UNAVAILABLE","error_type":type(ex).__name__}
    if len(found)!=1:
        return {"key":key,"status":"ALIAS_NOT_INDEXED" if not found else "AMBIGUOUS_RACE",
                "matched_rows":len(found)}
    row=next(iter(found.values()))
    try:
        detail=request(f"/race/{row['id']}",{"light":""})
        if office == "House":
            okay=detail_matches(row,detail)
        else:
            okay=(isinstance(detail,dict) and not explicitly_mock(detail) and
                detail.get("country")==row["country"] and
                detail.get("province")==row["province"] and
                detail.get("election_date")==row["election_date"] and
                detail.get("election_name")==row["election_name"] and
                detail.get("election_type")==row["type"] and
                detail.get("district")==row["district"] and
                detail.get("id",row["id"])==row["id"] and
                isinstance(detail.get("candidates"),list) and
                len(detail["candidates"])>=2)
        if not okay:
            return {"key":key,"status":"DETAIL_IDENTITY_REJECTED"}
        count_votes=sum(c.get("votes",0) for c in detail["candidates"])
        if not isinstance(count_votes,int) or count_votes<0 or (
            count_votes and now<CLOSE_UTC[state]):
            return {"key":key,"status":"PRE_CLOSE_VOTES_REJECTED"}
        return {"key":key,"status":"EXACT_2026_CANDIDATE_IDENTITY_VERIFIED",
                "race_id":row["id"],"candidate_count":len(detail["candidates"]),
                "live_votes_approved":False}
    except urllib.error.HTTPError as ex:
        return {"key":key,"status":"DETAIL_HTTP_ERROR","http":ex.code}
    except (ValueError,TimeoutError,OSError):
        return {"key":key,"status":"DETAIL_UNAVAILABLE"}

def main():
    rows=[]
    for key in GAPS:
        result=find_one(key)
        rows.append(result)
        if result["status"]=="STOP_UPSTREAM_OUTAGE":
            break
    print(json.dumps({"schema":"eight-gap-civicapi-alias-probe-v1",
      "checked_at":datetime.now(timezone.utc).isoformat(),
      "confirmed_identity":sum(r["status"]=="EXACT_2026_CANDIDATE_IDENTITY_VERIFIED" for r in rows),
      "unverified_gap_count_before":8,"public_live_votes_confirmed":False,
      "review_before_source_ledger_promotion":True,"rows":rows},indent=2))
if __name__=="__main__":main()
