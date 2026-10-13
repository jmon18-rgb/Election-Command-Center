#!/usr/bin/env python3
"""Nonpublishing civicAPI exact statewide Nov 3 2026 source discovery.
Third batch of five uncovered states: AL MT NM OK TN.
Print only identity / candidate count metadata; never publish votes.
"""
from test_civicapi_live_source import source

DAY="2026-11-03"
TARGETS=[
    ("AL","Senate","US Senate"),
    ("AL","Governor","Governor"),
    ("MT","Senate","US Senate"),
    ("NM","Senate","US Senate"),
    ("NM","Governor","Governor"),
    ("OK","Senate","US Senate"),
    ("OK","Governor","Governor"),
    ("TN","Senate","US Senate"),
    ("TN","Governor","Governor"),
]

def main():
    verified=[]
    for state,office,query in TARGETS:
        results=source("/race/search",{
            "country":"US","province":state,"startDate":DAY,"endDate":DAY,
            "query":query,"limit":20})
        rows=results.get("races")
        if not isinstance(rows,list) or len(rows)>20:
            raise ValueError("Invalid search rows "+state+"/"+office)
        stage="General" if office=="Senate" else "Statewide"
        race_type="US Senate" if office=="Senate" else "Governor"
        exact=[r for r in rows if isinstance(r,dict) and r.get("country")=="US"
               and r.get("province")==state and r.get("district") is None
               and r.get("municipality") is None and r.get("type")==race_type
               and r.get("election_type")==stage
               and str(r.get("election_date","")).startswith(DAY)
               and type(r.get("id")) is int and r["id"]>0
               and isinstance(r.get("election_name"),str)
               and "primary" not in r["election_name"].lower()
               and "runoff" not in r["election_name"].lower()]
        print("FIVE NEXT SEARCH",state,office,"count",results.get("count"),
              "returned",len(rows),"matches",len(exact),flush=True)
        for row in exact:
            print("FIVE NEXT CANDIDATE",state,office,row["id"],
                  repr(row["election_name"]),flush=True)
        if len(exact)!=1 or results.get("count",0)>20:
            print("FIVE NEXT UNVERIFIED",state,office,flush=True)
            continue
        row=exact[0]
        detail=source("/race/"+str(row["id"]),{"light":""})
        for field in ("country","province","district","election_date","election_name"):
            if detail.get(field)!=row.get(field):
                raise ValueError("Source search/detail mismatch "+state+"/"+office+"/"+field)
        if detail.get("election_type")!=row["type"]:
            raise ValueError("Wrong office-class "+state+"/"+office)
        candidates=detail.get("candidates")
        if not isinstance(candidates,list) or not 2<=len(candidates)<=60:
            raise ValueError("Unexpected candidate shape "+state+"/"+office)
        verified.append((state,office,row["id"],row["election_name"]))
        print("FIVE NEXT VERIFIED",state,office,row["id"],
              repr(row["election_name"]),"candidates",len(candidates),flush=True)
    print("FIVE NEXT TOTAL",len(verified),"of",len(TARGETS),flush=True)
    if not verified:
        raise ValueError("No verified source races for this batch")

if __name__=="__main__":
    main()
