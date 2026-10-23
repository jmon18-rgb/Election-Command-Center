import unittest
from probe_nc_election_download_selection import analyze
class Tests(unittest.TestCase):
 def test_readonly_election_discovery(self):
  d=analyze("<script>const electiondt = '2024';\nconst downloadUrl = '/enr/archive.zip';</script>",[("https://er.ncsbe.gov/enr/elections.txt",[{"id":1}])])
  self.assertEqual(d["election_lists"][0]["count"],1)
  self.assertFalse(d["verified_2026_county_votes"])
if __name__=="__main__":unittest.main()
