#!/usr/bin/env python3
"""Pure NC official precinct TSV -> county candidate totals, exact contest only.

No provider credentials, no synthetic county FIPS, and no claim of 2026 results.
Expected 2024 source schema was audited against real official ZIP in PR #213.
"""
import csv,io
REQUIRED={"County","Election Date","Precinct","Contest Group ID",
 "Contest Type","Contest Name","Choice","Choice Party","Total Votes",\n "Election Day","Early Voting","Absentee by Mail","Provisional","Vote For"}
def aggregate(tsv,*,date,contest,county_fips):
 if not isinstance(tsv,str) or not isinstance(county_fips,dict) or not contest:
  raise ValueError("invalid input")
 reader=csv.DictReader(io.StringIO(tsv),delimiter="\t")
 if not reader.fieldnames or not REQUIRED.issubset(reader.fieldnames):
  raise ValueError("official TSV schema missing required columns")
 totals={};seen=False
 for line in reader:
  if line["Contest Name"]!=contest or line["Election Date"]!=date:continue
  seen=True
  county=line["County"].strip().upper()
  fips=county_fips.get(county)
  if not isinstance(fips,str) or len(fips)!=5 or not fips.isdigit():
   raise ValueError("unmapped county: "+county)
  candidate=line["Choice"].strip();party=(line["Choice Party"] or "").strip()
  if not candidate:raise ValueError("unnamed candidate")
  raw=(line["Total Votes"] or "").replace(",","").strip()
  if not raw.isdigit():raise ValueError("invalid official vote count")
  votes=int(raw)
  if votes>20_000_000:raise ValueError("vote count exceeds per-row limit")
  key=(fips,candidate,party)
  totals[key]=totals.get(key,0)+votes
 if not seen:raise ValueError("requested date/contest not present")
 rows={}
 for (fips,name,party),votes in totals.items():
  rows.setdefault(fips,[]).append({"name":name,"party":party,"votes":votes})
 return [{"county_id":fips,"candidates":sorted(cands,key=lambda c:(c["name"],c["party"]))}
   for fips,cands in sorted(rows.items())]
