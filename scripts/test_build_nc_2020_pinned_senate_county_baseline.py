import copy
import csv
import io
import unittest
from pathlib import Path

from build_nc_2020_pinned_senate_county_baseline import build,ORIGINAL_SHA
from audit_nc_2020_senate_official_zip import SOURCE,CERTIFIED

ROOT=Path(__file__).resolve().parents[1]

def fixture():
 reference=(ROOT/"data/nc_2024_county_fips_reference.csv").read_text()
 counties=list(csv.DictReader(io.StringIO(reference)))
 rows=[]
 for i,row in enumerate(counties):
  dem=CERTIFIED["DEM"]//100+int(i<CERTIFIED["DEM"]%100)
  rep=CERTIFIED["REP"]//100+int(i<CERTIFIED["REP"]%100)
  rows.append({"county_id":row["statefp"]+row["countyfp"],
    "candidates":[
     {"party":"DEM","name":"Cal Cunningham","votes":dem},
     {"party":"REP","name":"Thom Tillis","votes":rep}]})
 audit={
  "schema":"nc-2020-senate-zip-source-audit-v1",
  "source_url":SOURCE,"archive_sha256_discovered":ORIGINAL_SHA,
  "contest_name_discovered":"US SENATE",
  "contest_group_id_discovered":"1374",
  "election_date":"2020-11-03","county_count":100,
  "certified_statewide_major_party_votes":CERTIFIED,
  "may_move_national_needle":False,"historical_counties":rows}
 return audit,reference

class PinnedOfficialSenateBaselineTests(unittest.TestCase):
 def setUp(self):
  self.audit,self.crosswalk=fixture()

 def test_pinned_100_counties_nonpredictive(self):
  v=build(self.audit,self.crosswalk)
  self.assertEqual(v["source_sha256"],ORIGINAL_SHA)
  self.assertEqual(len(v["counties"]),100)
  self.assertEqual(v["certified_statewide_major_party_votes"],CERTIFIED)
  self.assertTrue(v["same_office_as_2026_senate"])
  self.assertFalse(v["same_candidates_as_2026_senate"])
  self.assertFalse(v["may_move_national_needle"])
  self.assertIsNone(v["ballots_remaining_forecast"])

 def test_wrong_fingerprint_or_contest_fail_closed(self):
  for field in ("source_url","archive_sha256_discovered",
                "contest_name_discovered","contest_group_id_discovered"):
   a=copy.deepcopy(self.audit);a[field]="wrong"
   with self.assertRaises(ValueError):
    build(a,self.crosswalk)

 def test_misattributed_counties_or_nominees_rejected(self):
  for kind in ("duplicate","missing","wrong_nominee","extra_dem"):
   a=copy.deepcopy(self.audit)
   if kind=="duplicate":
    a["historical_counties"][1]["county_id"]=a["historical_counties"][0]["county_id"]
   if kind=="missing":
    a["historical_counties"].pop()
   if kind=="wrong_nominee":
    a["historical_counties"][0]["candidates"][0]["name"]="Not Cunningham"
   if kind=="extra_dem":
    a["historical_counties"][0]["candidates"].append(
      {"party":"DEM","name":"Other","votes":3})
   with self.assertRaises(ValueError):
    build(a,self.crosswalk)

 def test_certified_count_reconciliation(self):
  a=copy.deepcopy(self.audit)
  a["historical_counties"][2]["candidates"][0]["votes"]+=1
  with self.assertRaises(ValueError):
   build(a,self.crosswalk)
  with self.assertRaises(ValueError):
   build(self.audit,self.crosswalk+"\n")

if __name__=="__main__":
 unittest.main()
