#!/usr/bin/env python3
"""Discover *actual* civicAPI Nov. 3 2026 statewide records for the next
five-state election-night batch. Nonpublishing: IDs and structural metadata
only, never vote totals. Discovery alone never grants production coverage.
"""
from test_civicapi_live_source import source

DAY="2026-11-03"
# Independently observed provider identities in source-real GitHub CI on Oct 13.
REQUIRED={
    ("IL","Senate"):(87129,"Illinois US Senate"),
    ("IL","Governor"):(87130,"Illinois Governor"),
    ("KY","Senate"):(87174,"Kentucky US Senate"),
    ("NJ","Senate"):(87302,"New Jersey US Senate"),
    ("NY","Governor"):(87329,"New York Governor"),
    ("OR","Senate"):(87374,"Oregon US Senate"),
    ("OR","Governor"):(87375,"Oregon Governor"),
}
TARGETS=[
    ("IL","Senate","US Senate"),
    ("IL","Governor","Governor"),
    ("KY","Senate","US Senate"),
    ("NJ","Senate","US Senate"),
    ("NY","Governor","Governor"),
    ("OR","Senate","US Senate"),
    ("OR","Governor","Governor"),
]

def main():
    matches_found=[]
    for state,office,query in TARGETS:
        doc=source("/race/search",{
            "country":"US","province":state,"startDate":DAY,
            "endDate":DAY,"query":query,"limit":20
        })
        rows=doc.get("races")
        if not isinstance(rows,list) or len(rows)>20:
            raise ValueError("Malformed source search "+state+" "+office)
        expected_type="US Senate" if office=="Senate" else "Governor"
        expected_stage="General" if office=="Senate" else "Statewide"
        exact=[x for x in rows if isinstance(x,dict) and x.get("country")=="US"
            and x.get("province")==state and x.get("district") is None
            and x.get("municipality") is None
            and x.get("type")==expected_type and x.get("election_type")==expected_stage
            and str(x.get("election_date","")).startswith(DAY)
            and type(x.get("id")) is int and x["id"]>0
            and isinstance(x.get("election_name"),str)
            and "primary" not in x["election_name"].lower()
            and "runoff" not in x["election_name"].lower()]
        print("FIVE-STATE DISCOVERY",state,office,"returned",len(rows),
              "count",doc.get("count"),"matches",len(exact),flush=True)
        for x in exact:
            print("FIVE-STATE CANDIDATE",state,office,x["id"],repr(x["election_name"]),flush=True)
        if len(exact)!=1 or doc.get("count",0)>20:
            print("FIVE-STATE UNVERIFIED",state,office,"ambiguous/missing/truncated")
            continue
        row=exact[0]
        detail=source("/race/"+str(row["id"]),{"light":""})
        for field in ("country","province","district","election_name","election_date"):
            if detail.get(field)!=row.get(field):
                raise ValueError("Detail identity mismatch "+state+" "+office+" "+field)
        if detail.get("election_type")!=row["type"]:
            raise ValueError("Office mismatch "+state+" "+office)
        if not isinstance(detail.get("candidates"),list) or not 2<=len(detail["candidates"])<=60:
            raise ValueError("Invalid candidates "+state+" "+office)
        matches_found.append((state,office,row["id"],row["election_name"]))
        print("FIVE-STATE VERIFIED",state,office,row["id"],repr(row["election_name"]),
              "candidates",len(detail["candidates"]),flush=True)
    print("FIVE-STATE COVERAGE",len(matches_found),"of",len(TARGETS),flush=True)
    required={(state,office,race_id,name)
              for (state,office),(race_id,name) in REQUIRED.items()}
    if set(matches_found)!=required:
        raise ValueError("Source IDs/names missing or changed: "+
                         repr(sorted(required-set(matches_found))))
if __name__=="__main__":
    main()
