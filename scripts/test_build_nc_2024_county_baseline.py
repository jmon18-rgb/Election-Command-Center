import unittest
from build_nc_2024_county_baseline import build

names = ["COUNTY" + chr(65+i//26) + chr(65+i%26) for i in range(100)]
csv = "statefp,countyfp,name\n" + "".join("37,%03d,%s\n" % (2*i+1,n) for i,n in enumerate(names))
rows = [{"county_name": n, "mode":"election_day", "dem_votes_2024":10,
         "rep_votes_2024":20} for n in names]
source = {"state":"NC", "status":"OFFICIAL_NC_2024_HISTORICAL_MODE_COUNTS_NOT_A_2026_NEEDLE",
          "presidential_dem_votes_2024":1000,"presidential_rep_votes_2024":2000,
          "observations":rows}
class CountyBaselineTests(unittest.TestCase):
    def test_exact_county_vote_totals(self):
        result=build(source,csv)
        self.assertEqual((result["statewide_dem"],result["statewide_rep"]),(1000,2000))
        self.assertEqual(result["counties"][0]["county_fips"],"37001")
        self.assertFalse(result["may_update_live_model"])
        self.assertFalse(result["same_office_for_2026_senate_or_house"])
    def test_refuse_missing_votes(self):
        with self.assertRaises(ValueError):
            build({**source,"observations":rows[:-1]},csv)
    def test_refuse_corrupted_totals(self):
        with self.assertRaises(ValueError):
            build({**source,"presidential_dem_votes_2024":999},csv)
    def test_refuse_duplicate(self):
        with self.assertRaises(ValueError):
            build({**source,"observations":rows + [rows[0]]},csv)
if __name__=="__main__":
    unittest.main()
