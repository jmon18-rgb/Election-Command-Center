#!/usr/bin/env python3
"""Deterministic fabricated precinct fixtures; no published vote totals guessed."""
import csv
import io
from stage_nc_2024_county_mode import parse_tsv
FIELDS=("county","election date","precinct","contest group id","contest type",
        "contest name","choice","choice party","vote for","election day",
        "early voting","absentee by mail","provisional","total votes","real precinct")
def csv_data(rows):
    f=io.StringIO()
    w=csv.DictWriter(f,delimiter="\t",fieldnames=FIELDS,lineterminator="\n")
    w.writeheader()
    for x in rows:w.writerow(x)
    return f.getvalue()
def make(county,party):
    isdem=party=="DEM"
    counts=(200,700,200,100) if isdem else (300,300,200,100)
    return dict(zip(FIELDS,(county,"11/05/2024","PRECINCT 01",4321,"F",
     "US PRESIDENT (VOTE FOR 1)","Fictional D" if isdem else "Fictional R",
     party,"1",*counts,sum(counts),"Y")))
rows=[make(c,p) for c in ("Alamance","Anson","Bertie") for p in ("DEM","REP")]
raw=csv_data(rows)
d=parse_tsv(raw,min_counties=3,expected_totals={"DEM":3600,"REP":2700})
assert d["county_name_count"]==3 and len(d["observations"])==12
assert d["presidential_dem_votes_2024"]==3600
assert d["presidential_rep_votes_2024"]==2700
assert d["status"]=="OFFICIAL_NC_2024_HISTORICAL_MODE_COUNTS_NOT_A_2026_NEEDLE"
assert sum(r["dem_votes_2024"] for r in d["observations"])==3600
assert sum(r["rep_votes_2024"] for r in d["observations"])==2700
def mustfail(x):
    try:parse_tsv(csv_data(x),min_counties=3,expected_totals={"DEM":3600,"REP":2700})
    except ValueError:return
    raise AssertionError("Malformed official source should fail closed")
bad=[dict(x) for x in rows]
bad[0]["election date"]="11/03/2026"
mustfail(bad)
bad=[dict(x) for x in rows]
bad[0]["total votes"]="999999"
mustfail(bad)
bad=[dict(x) for x in rows]
bad[0]["choice party"]="UNA"
mustfail(bad)
bad=[dict(x) for x in rows]
bad[0]["absentee by mail"]="-1"
mustfail(bad)
mustfail(rows[:-2])
print("Official North Carolina 2024 mode-separated results: strict schema, vote sums, source totals and wrong-year failures PASS")
