#!/usr/bin/env python3
"""Discover 2026-11-03 civicAPI races in CA, DE, MS, SD, WY.
Search by exact state and election day; never print or store vote totals.
Production acceptance locks explicit office, stage, ID and name after discovery.
"""
from test_civicapi_live_source import source

DAY="2026-11-03"
TARGETS=[
    ("CA","Governor","Governor"),
    ("DE","Senate","US Senate"),
    ("MS","Senate","US Senate"),
    ("MD","Governor","Governor"),
    ("SD","Senate","US Senate"),
    ("SD","Governor","Governor"),
    ("WY","Senate","US Senate"),
    ("WY","Governor","Governor"),
]

def main():
    verified=[]
    for state,office,query in TARGETS:
        result=source("/race/search",{
            "country":"US","province":state,"startDate":DAY,
            "endDate":DAY,"query":query,"limit":20})
        rows=result.get("races")
        if not isinstance(rows,list) or len(rows)>20:
            raise ValueError("Invalid source search "+state+"/"+office)
        kind="US Senate" if office=="Senate" else "Governor"
        stage="General" if office=="Senate" else "Statewide"
        matches=[x for x in rows if isinstance(x,dict)
            and x.get("country")=="US" and x.get("province")==state
            and x.get("district") is None and x.get("municipality") is None
            and str(x.get("election_date","")).startswith(DAY)
            and x.get("type")==kind and x.get("election_type")==stage
            and type(x.get("id")) is int and x["id"]>0
            and isinstance(x.get("election_name"),str)
            and "primary" not in x["election_name"].lower()
            and "runoff" not in x["election_name"].lower()
            and "special" not in x["election_name"].lower()]
        print("NEXT FIVE SEARCH",state,office,"returned",len(rows),
              "source_count",result.get("count"),"matched",len(matches),flush=True)
        for x in matches:
            print("NEXT FIVE CANDIDATE",state,office,x["id"],
                  repr(x["election_name"]),flush=True)
        if len(matches)!=1 or result.get("count",0)>20:
            print("NEXT FIVE UNVERIFIED",state,office,flush=True)
            continue
        row=matches[0]
        detail=source("/race/"+str(row["id"]),{"light":""})
        for name in ("country","province","district","election_name","election_date"):
            if detail.get(name)!=row.get(name):
                raise ValueError("Search/detail mismatch "+state+"/"+office+"/"+name)
        if detail.get("election_type")!=row["type"]:
            raise ValueError("Incorrect source office class "+state+"/"+office)
        candidates=detail.get("candidates")
        if not isinstance(candidates,list) or not 2<=len(candidates)<=60:
            raise ValueError("Invalid candidates "+state+"/"+office)
        print("NEXT FIVE VERIFIED",state,office,row["id"],
              repr(row["election_name"]),"candidates",len(candidates),flush=True)
        verified.append((state,office,row["id"],row["election_name"]))
    print("NEXT FIVE TOTAL",len(verified),"of",len(TARGETS),flush=True)
    if not verified:
        raise ValueError("No source-verified 2026 races")

if __name__=="__main__":
    main()
