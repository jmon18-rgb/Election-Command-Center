#!/usr/bin/env python3
"""Nonpublishing four-state 2026 civicAPI discovery (Ohio, Wisconsin,
Nebraska, Kansas). Never export or print vote totals; verify provider metadata.
"""
from test_civicapi_live_source import source

TARGETS=[
    ("OH","Senate","US Senate"),
    ("OH","Governor","Governor"),
    ("WI","Governor","Governor"),
    ("NE","Senate","US Senate"),
    ("NE","Governor","Governor"),
    ("KS","Senate","US Senate"),
    ("KS","Governor","Governor"),
]
DAY="2026-11-03"

def main():
    exact=[]
    for state,office,query in TARGETS:
        doc=source("/race/search",{
            "country":"US","province":state,"startDate":DAY,
            "endDate":DAY,"query":query,"limit":20})
        rows=doc.get("races")
        if not isinstance(rows,list) or len(rows)>20:
            raise ValueError("Malformed search list: "+state+"/"+office)
        office_class="US Senate" if office=="Senate" else "Governor"
        stage="General" if office=="Senate" else "Statewide"
        matches=[
            x for x in rows if isinstance(x,dict)
            and x.get("country")=="US" and x.get("province")==state
            and str(x.get("election_date","")).startswith(DAY)
            and x.get("municipality") is None and x.get("district") is None
            and x.get("type")==office_class and x.get("election_type")==stage
            and type(x.get("id")) is int and x["id"]>0
            and isinstance(x.get("election_name"),str)]
        print("DISCOVERY",state,office,"returned",len(rows),
              "provider_count",doc.get("count"),
              "qualified",len(matches))
        for row in matches:
            print("CANDIDATE",state,office,row["id"],repr(row["election_name"]))
        if len(matches)!=1:
            print("UNVERIFIED",state,office,
                  "zero or ambiguous exact-stage source matches")
            continue
        row=matches[0]
        detail=source("/race/"+str(row["id"]),{"light":""})
        for key in ("country","province","district","election_name","election_date"):
            if detail.get(key)!=row.get(key):
                raise ValueError("Search/detail mismatch "+state+" "+office+" "+key)
        if detail.get("election_type")!=row.get("type"):
            raise ValueError("Wrong detail office type "+state+" "+office)
        candidates=detail.get("candidates")
        if not isinstance(candidates,list) or not 2<=len(candidates)<=60:
            raise ValueError("Malformed candidate shape "+state+" "+office)
        exact.append((state,office,row["id"],row["election_name"]))
        print("VERIFIED",state,office,row["id"],repr(row["election_name"]),
              "candidate_count",len(candidates))
    print("BATCH DISCOVERY COMPLETE",len(exact),"of",len(TARGETS))
    # These source IDs were verified independently in the Oct. 13 GitHub
    # discovery job. An ID re-assignment is a compatibility break, not a
    # reason to accept a different race with the same office title.
    required={
        ("OH","Senate",87527,"Ohio US Senate Special"),
        ("OH","Governor",87365,"Ohio Governor"),
        ("WI","Governor",87491,"Wisconsin Governor"),
        ("NE","Senate",87254,"Nebraska US Senate"),
        ("NE","Governor",87255,"Nebraska Governor"),
        ("KS","Senate",87162,"Kansas US Senate"),
        ("KS","Governor",87163,"Kansas Governor"),
    }
    missing=required-set(exact)
    if missing:
        raise ValueError("Indexed source record missing/reassigned: "+repr(sorted(missing)))

if __name__=="__main__":
    main()
