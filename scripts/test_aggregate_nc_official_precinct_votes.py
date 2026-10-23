import unittest
from aggregate_nc_official_precinct_votes import aggregate
HEAD="County\tElection Date\tPrecinct\tContest Group ID\tContest Type\tContest Name\tChoice\tChoice Party\tVote For\tElection Day\tEarly Voting\tAbsentee by Mail\tProvisional\tTotal Votes\tReal Precinct\n"
def line(county,date,precinct,contest,choice,party,votes):
 return "\t".join([county,date,precinct,"42","C",contest,choice,party,"1",str(votes),"0","0","0",str(votes),"Y"])+"\n"
class Tests(unittest.TestCase):
 def test_aggregate_precincts_exact_contest(self):
  txt=HEAD+line("WAKE","11/05/2024","01","US PRESIDENT","A","DEM",40)+line("WAKE","11/05/2024","02","US PRESIDENT","A","DEM",30)+line("WAKE","11/05/2024","01","US PRESIDENT","B","REP",50)+line("WAKE","11/05/2024","01","US SENATE","A","DEM",100)
  x=aggregate(txt,date="11/05/2024",contest="US PRESIDENT",county_fips={"WAKE":"37183"})
  self.assertEqual(x[0]["county_id"],"37183")
  self.assertEqual(x[0]["candidates"][0]["votes"],70)
  self.assertEqual(x[0]["candidates"][1]["votes"],50)
 def test_wrong_contest_fails(self):
  with self.assertRaises(ValueError):aggregate(HEAD+line("WAKE","11/05/2024","01","X","A","D",1),date="11/05/2024",contest="Y",county_fips={"WAKE":"37183"})
 def test_method_mismatch_rejected(self):
  txt=HEAD+line("WAKE","11/05/2024","01","X","A","D",10).replace("\t10\t0\t0\t0\t10\tY","\t9\t0\t0\t0\t10\tY")
  with self.assertRaises(ValueError):aggregate(txt,date="11/05/2024",contest="X",county_fips={"WAKE":"37183"})
 def test_unmapped_county_fails(self):
  with self.assertRaises(ValueError):aggregate(HEAD+line("WAKE","11/05/2024","01","X","A","D",1),date="11/05/2024",contest="X",county_fips={})
if __name__=="__main__":unittest.main()
