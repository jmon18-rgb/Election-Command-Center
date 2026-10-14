#!/usr/bin/env python3
"""Advisory discovery for the remaining outside-primary Senate gaps and first House seats.

Only exact November 3, 2026 general-election race identities are eligible.
No vote totals are copied. Provider CORS, candidate identity, and office type
must all pass before a result can become a production adapter.
"""
from test_civicapi_live_source import source

DAY="2026-11-03"
TARGETS=[
    ("MA","Senate",None,"US Senate"),
    ("MS","Senate",None,"US Senate"),
    ("NH","House","NH-01","US House 1"),
    ("NH","House","NH-02","US House 2"),
    ("NV","House","NV-03","US House 3"),
    ("ME","House","ME-02","US House 2"),
    ("CA","House","CA-13","US House 13"),
]

def exact(state,office,district,row):
    if not isinstance(row,dict):
        return False
    kind="US Senate" if office=="Senate" else "House of Representatives"
    if any((row.get("country")!="US",row.get("province")!=state,
            row.get("municipality") is not None,
            not str(row.get("election_date","")).startswith(DAY),
            row.get("type")!=kind,row.get("election_type")!="General",
            row.get("district")!=(None if office=="Senate" else district),
            type(row.get("id")) is not int or row["id"]<=0,
            not isinstance(row.get("election_name"),str),
            not isinstance(row.get("candidates"),list),
            len(row.get("candidates",[]))>60)):
        return False
    label=row["election_name"].lower()
    return "primary" not in label and "runoff" not in label and "special" not in label

def verify_detail(row,detail):
    if not isinstance(detail,dict):
        return False
    if any(detail.get(k)!=row.get(k) for k in
           ("country","province","district","election_name","election_date")):
        return False
    if detail.get("election_type")!=row.get("type"):
        return False
    candidates=detail.get("candidates")
    if not isinstance(candidates,list) or not 2<=len(candidates)<=60:
        return False
    return all(isinstance(c,dict) and isinstance(c.get("name"),str)
               and c["name"].strip() and type(c.get("votes")) is int
               and c["votes"]>=0 and type(c.get("winner")) is bool
               for c in candidates)

def main():
    verified=[]
    for state,office,district,query in TARGETS:
        doc=source("/race/search",{
            "country":"US","province":state,"startDate":DAY,
            "endDate":DAY,"query":query,"limit":20})
        rows=doc.get("races")
        if not isinstance(rows,list) or len(rows)>20:
            raise ValueError("Invalid bounded race search "+state+"/"+office)
        matches=[r for r in rows if exact(state,office,district,r)]
        if len(matches)!=1 or (type(doc.get("count")) is int and doc["count"]>20):
            print("GAP",state,office,district or "statewide",
                  "matches",len(matches),"returned",len(rows),flush=True)
            continue
        row=matches[0]
        detail=source("/race/"+str(row["id"]),{"light":""})
        if not verify_detail(row,detail):
            raise ValueError("Search/detail mismatch "+state+"/"+office+"/"+str(district))
        print("VERIFIED",state,office,district or "statewide",
              row["id"],repr(row["election_name"]),flush=True)
        verified.append((state,office,district,row["id"],row["election_name"]))
    print("VERIFIED TOTAL",len(verified),"of",len(TARGETS),flush=True)

if __name__=="__main__":
    main()
