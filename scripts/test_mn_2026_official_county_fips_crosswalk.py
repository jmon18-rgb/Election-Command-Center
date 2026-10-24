#!/usr/bin/env python3
"""Exact MN SOS sequential county IDs versus current 2026 Census GEOIDs."""
import json,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PATH=ROOT/"data"/"mn_2026_official_county_fips_crosswalk.json"

class MinnesotaCountyFipsCrosswalkTests(unittest.TestCase):
 def test_exact_county_universe_and_independently_sourced_metadata(self):
  x=json.loads(PATH.read_text())
  self.assertEqual(x["schema"],
    "mn-official-2026-election-county-census-fips-crosswalk-v1")
  self.assertEqual(x["status"],
    "OFFICIAL_COUNTY_IDENTITY_CROSSWALK_NOT_LIVE_RESULTS")
  self.assertEqual(x["state"],"MN")
  self.assertEqual(x["election_date"],"2026-11-03")
  self.assertEqual(x["county_count"],87)
  self.assertEqual(x["verified_at"],"2026-10-24")
  self.assertEqual(x["source_election_counties"],
    "https://electionresultsfiles.sos.mn.gov/20261103/Cntytbl.txt")
  self.assertEqual(x["source_census_geoids"],
    "https://tigerweb.geo.census.gov/tigerwebmain/Files/acs26/tigerweb_acs26_county_mn.html")
  self.assertTrue(x["independent_source_name_join_reviewed"])
  self.assertTrue(x["requires_election_night_source_revalidation"])
  self.assertIsNone(x["candidate_votes"])
  self.assertIsNone(x["percent_reporting"])
  self.assertFalse(x["may_update_national_needle"])
  e=x["county_metadata"]
  f=x["county_id_to_fips"]
  self.assertEqual(len(e),87)
  self.assertEqual(len(f),87)
  self.assertEqual(set(e),set(f))
  self.assertEqual(set(e),{f"{i:02d}" for i in range(1,88)})
  self.assertEqual(len(set(v["county_name"].casefold() for v in e.values())),87)
  ids=set()
  for idx in range(1,88):
   key=f"{idx:02d}"
   entry=e[key]
   geoid=f[key]
   self.assertEqual(geoid,entry["fips"])
   self.assertRegex(geoid,r"^27\d{3}$")
   self.assertEqual(geoid,"27"+f"{2*idx-1:03d}")
   self.assertNotIn(geoid,ids)
   ids.add(geoid)
  # Anchors independently checked in MN SOS/Census sources, guard
  # against a shifted alphabetical county sequence and county-FIPS alias.
  for county, name, fips in (
    ("01","Aitkin","27001"),("03","Becker","27005"),
    ("08","Brown","27015"),("27","Hennepin","27053"),
    ("39","Lake Of The Woods","27077"),
    ("43","Mcleod","27085"),("62","Ramsey","27123"),
    ("69","St. Louis","27137"),("87","Yellow Medicine","27173")):
   self.assertEqual(e[county]["county_name"],name)
   self.assertEqual(e[county]["fips"],fips)

if __name__=="__main__":
 unittest.main()
