#!/usr/bin/env python3
"""Read-only source discovery for four-state civicAPI adapter batch.

DO NOT store or republish source vote totals: only search metadata and
the structural identity of the race-by-ID source are printed.
"""
from test_civicapi_live_source import source
RACES=[
    ("NV","Governor","Governor"),
    ("ME","Senate","US Senate"),("ME","Governor","Governor"),
    ("MA","Senate","US Senate"),("MA","Governor","Governor"),
    ("AK","Senate","US Senate"),("AK","Governor","Governor"),
]

def main():
    good=[]
    for state,office,query in RACES:
        doc=source("/race/search",{
            "country":"US","province":state,"startDate":"2026-11-03",
            "endDate":"2026-11-03","query":query,"limit":20})
        rows=doc.get("races",[])
        if not isinstance(rows,list) or len(rows)>20:
            raise ValueError("Bad race search schema: "+state+" "+office)
        matches=[
            r for r in rows if r.get("country")=="US" and r.get("province")==state
            and str(r.get("election_date","")).startswith("2026-11-03")
            and r.get("district") is None and r.get("municipality") is None
            and r.get("type")==("US Senate" if office=="Senate" else "Governor")
            and r.get("election_type")==("General" if office=="Senate" else "Statewide")
            and "primary" not in r.get("election_name","").lower()
            and "special" not in r.get("election_name","").lower()
            and r.get("election_name")==
                {"AK":"Alaska","MA":"Massachusetts","ME":"Maine","NV":"Nevada"}[state]+
                (" US Senate" if office=="Senate" else " Governor")
            and type(r.get("id")) is int and r["id"]>0]
        if len(matches)>1:
            raise ValueError("Ambiguous civicAPI identity: "+state+" "+office)
        if not matches:
            print("STATE BATCH UNINDEXED",state,office,"source rows",len(rows))
            continue
        row=matches[0]
        detail=source("/race/"+str(row["id"]),{"light":""})
        for field in ("country","province","district","election_date","election_name"):
            if detail.get(field)!=row.get(field):
                raise ValueError("Search/detail mismatch "+state+" "+office+" "+field)
        if detail.get("election_type")!=row["type"]:
            raise ValueError("Wrong office class "+state+" "+office)
        if not isinstance(detail.get("candidates"),list) or len(detail["candidates"])<2:
            raise ValueError("Invalid candidate detail "+state+" "+office)
        good.append((state,office,row["id"]))
        print("STATE BATCH INDEXED",state,office,row["id"],
              "candidates",len(detail["candidates"]))
    print("STATE BATCH VERIFIED",len(good),"/",len(RACES))
    if ("NV","Governor",87260) not in good and not any(s=="NV" and o=="Governor" for s,o,_ in good):
        raise ValueError("Known NV governor source identity disappeared")

if __name__=="__main__":
    main()
