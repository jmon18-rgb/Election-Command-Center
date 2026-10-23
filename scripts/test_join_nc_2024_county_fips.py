import unittest
from join_nc_2024_county_fips import join_nc_counties

names = ["COUNTY" + chr(65 + i // 26) + chr(65 + i % 26) for i in range(100)]
rows = [{"county_name": n, "mode": "election_day",
         "dem_votes_2024": 1, "rep_votes_2024": 1} for n in names]
staging = {"state":"NC", "status":"OFFICIAL_NC_2024_HISTORICAL_MODE_COUNTS_NOT_A_2026_NEEDLE",
           "observations":rows}
ref = "statefp,countyfp,name\n" + "".join(
    "37,%03d,%s\n" % (i,n) for i,n in enumerate(names))

class CrosswalkTests(unittest.TestCase):
    def test_exact_and_research_only(self):
        out = join_nc_counties(staging,ref)
        self.assertEqual(len(out["observations"]),100)
        self.assertEqual(out["observations"][0]["county_fips"],"37001")
        self.assertFalse(out["may_update_live_model"])
        self.assertFalse(out["same_office_baseline_verified"])

    def test_missing_name_fails(self):
        with self.assertRaises(ValueError):
            join_nc_counties({**staging,"observations":rows[:-1] +
                              [{**rows[-1],"county_name":"UNMAPPED"}]},ref)

    def test_missing_crosswalk_row_fails(self):
        with self.assertRaises(ValueError):
            join_nc_counties(staging,"statefp,countyfp,name\n37,001,TEST\n")

    def test_duplicate_county_method_fails(self):
        with self.assertRaises(ValueError):
            join_nc_counties({**staging,"observations":rows+[rows[0]]},ref)

if __name__ == "__main__":
    unittest.main()
