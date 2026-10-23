import io
import unittest
import zipfile
from audit_nc_2020_senate_official_zip import (
 identify,inspect,normalize_2020_columns,MEMBER,SOURCE,CERTIFIED
)

HEADER=("County\tElection Date\tPrecinct\tContest Group ID\tContest Type\t"
 "Contest Name\tChoice\tChoice Party\tVote For\tElection Day\t"
 "One Stop\tAbsentee by Mail\tProvisional\tTotal Votes\tReal Precinct\t\n")

def entry(county,name,party,count,date="11/03/2020",contest="US SENATE",group="37"):
 return "\t".join([county,date,"01",group,"C",contest,
   name,party,"1",str(count),"0","0","0",str(count)])+"\n"

def archive(text,member=MEMBER):
 out=io.BytesIO()
 with zipfile.ZipFile(out,"w",compression=zipfile.ZIP_DEFLATED) as z:
  z.writestr(member,HEADER+text)
 return out.getvalue()

class OfficialSourceAuditTests(unittest.TestCase):
 def setUp(self):
  self.verified=(
    entry("WAKE","Cal Cunningham","DEM",40)+
    entry("WAKE","Thom Tillis","REP",30)+
    entry("DURHAM","Cal Cunningham","DEM",20)+
    entry("DURHAM","Thom Tillis","REP",30))
  self.fips={"WAKE":"37183","DURHAM":"37063"}

 def test_strict_one_stop_column_mapping(self):
  clean=normalize_2020_columns(HEADER+self.verified)
  self.assertIn("Early Voting",clean.splitlines()[0])
  self.assertNotIn("One Stop",clean.splitlines()[0])
  self.assertNotIn("Real Precinct",clean.splitlines()[0])
  for before,after in (("One Stop","Fake Column"),("Real Precinct","Unrecognized")):
   with self.assertRaises(ValueError):
    normalize_2020_columns((HEADER+self.verified).replace(before,after))

 def test_exact_two_county_synthetic_structure_not_production(self):
  doc=inspect(archive(self.verified),self.fips,
    expected_totals={"DEM":60,"REP":60},expected_counties=2)
  self.assertEqual(doc["source_url"],SOURCE)
  self.assertEqual(doc["county_count"],2)
  self.assertEqual(doc["certified_statewide_major_party_votes"],{"DEM":60,"REP":60})
  self.assertEqual(doc["source_sha_pinned_for_model"],False)
  self.assertEqual(doc["may_move_national_needle"],False)
  self.assertEqual(doc["source_sha_pinned_for_model"],False)
  self.assertTrue(len(doc["archive_sha256_discovered"])==64)

 def test_wrong_contest_group_and_time_cannot_enter_results(self):
  with self.assertRaises(ValueError):
   identify(HEADER+entry("WAKE","C","DEM",4,contest="US HOUSE"))
  with self.assertRaises(ValueError):
   identify(HEADER+self.verified+entry("WAKE","C","DEM",4,group="99"))
  with self.assertRaises(ValueError):
   identify(HEADER+entry("WAKE","C","DEM",4,date="11/05/2024"))

 def test_certified_totals_missing_county_or_bad_zip_rejected(self):
  with self.assertRaises(ValueError):
   inspect(archive(self.verified),self.fips,
     expected_totals={"DEM":60,"REP":59},expected_counties=2)
  with self.assertRaises(ValueError):
   inspect(archive(self.verified),{"WAKE":"37183"},
     expected_totals={"DEM":60,"REP":60},expected_counties=2)
  with self.assertRaises(ValueError):
   inspect(archive(self.verified,member="wrong.txt"),self.fips,
     expected_totals={"DEM":60,"REP":60},expected_counties=2)
  with self.assertRaises(ValueError):
   inspect(b"not a zip",self.fips,
     expected_totals={"DEM":60,"REP":60},expected_counties=2)

 def test_exact_candidate_count_reconciliation(self):
  fraud=entry("WAKE","C","DEM",100)
  fraud+="\t".join(["WAKE","11/03/2020","01","37","C",
                   "US SENATE","R","REP","1","40","0","0","0","39"])+"\n"
  with self.assertRaises(ValueError):
   inspect(archive(fraud),{"WAKE":"37183"},
     expected_totals={"DEM":100,"REP":39},expected_counties=1)

if __name__=="__main__":
 unittest.main()
