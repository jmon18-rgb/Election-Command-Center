#!/usr/bin/env python3
"""Launch gate for separately attributed November 2026 civicAPI watchlist data.

Verify REAL browser-CORS response, office identity, single exact General race,
and the matching detailed-race contract; do not ingest votes into primary feed.
"""
import json
import urllib.parse
import urllib.request

BASE="https://civicapi.org/api/v2"
ORIGIN="https://jmon18-rgb.github.io"
GENERAL_DAY="2026-11-03"

def source(path,params=None):
    url=BASE+path+("?"+urllib.parse.urlencode(params) if params else "")
    req=urllib.request.Request(url,headers={
        "Origin":ORIGIN,"Accept":"application/json",
        "User-Agent":"BlueWavesPersonalElectionNight/1.0"
    })
    with urllib.request.urlopen(req,timeout=25) as response:
        headers=response.headers
        body=response.read(300000)
        if response.status!=200 or headers.get("Access-Control-Allow-Origin") not in ("*",ORIGIN):
            raise ValueError("civicAPI response is not direct-browser compatible")
        if "json" not in headers.get("Content-Type","").lower() or len(body)>=300000:
            raise ValueError("civicAPI source not a bounded JSON result")
    return json.loads(body)

def match(item,record):
    state,office,district=item
    if not isinstance(record,dict) or record.get("country")!="US" or record.get("province")!=state:
        return False
    if not str(record.get("election_date","")).startswith(GENERAL_DAY):
        return False
    if record.get("municipality") or type(record.get("id")) is not int or record["id"]<=0:
        return False
    if "Primary" in record.get("election_name","") or "Primary" in record.get("election_type",""):
        return False
    if office=="Senate":
        return record.get("type")=="US Senate" and record.get("election_type")=="General" and record.get("district") is None
    if office=="House":
        return record.get("type")=="House of Representatives" and record.get("election_type")=="General" and record.get("district")==district
    if office=="Governor":
        return record.get("type")=="Governor" and record.get("election_type")=="Statewide" and record.get("district") is None
    return False

def main():
    examples=[
        (("NH","Senate",None),"US Senate"),
        (("NH","House","NH-01"),"US House 1"),
        (("NH","Governor",None),"Governor"),
        (("NV","Governor",None),"Governor")
    ]
    for item,query in examples:
        state,office,district=item
        results=source("/race/search",{
            "country":"US","province":state,
            "startDate":GENERAL_DAY,"endDate":GENERAL_DAY,
            "query":query,"limit":20
        })
        rows=results.get("races")
        if not isinstance(rows,list) or len(rows)>20:
            raise ValueError("Search result cardinality invalid")
        matches=[row for row in rows if match(item,row)]
        if len(matches)!=1:
            raise ValueError("Could not uniquely match "+str(item)+": "+str(len(matches)))
        row=matches[0]
        detail=source("/race/"+str(row["id"]),{"light":""})
        for key in ("country","province","district","election_date","election_name","election_type"):
            if detail.get(key)!=row.get(key):
                raise ValueError("Detailed race mismatches discovery record for "+str(item)+": "+key+" search="+repr(row.get(key))+" detail="+repr(detail.get(key)))
        candidates=detail.get("candidates")
        if not isinstance(candidates,list) or len(candidates)<2 or len(candidates)>60:
            raise ValueError("Unexpected candidate list in civicAPI detailed record")
        if any(type(x.get("votes")) is not int or x["votes"]<0
               or type(x.get("winner")) is not bool for x in candidates):
            raise ValueError("Invalid candidate totals or winner call shape")
        print("civicAPI CORS and 2026 race identity verified",state,office,row["id"],
              "candidate_count",len(candidates))

if __name__=="__main__":
    main()
