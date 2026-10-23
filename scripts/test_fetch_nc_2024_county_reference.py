import json
import unittest
from fetch_nc_2024_county_reference import transform

rows = [["NAME", "state", "county"]] + [
    ["COUNTY" + chr(65 + i//26) + chr(65+i%26) + " County, North Carolina",
     "37", "%03d" % (2*i+1)] for i in range(100)]

class CensusCountyReferenceTests(unittest.TestCase):
    def test_complete_county_reference(self):
        result = transform(json.dumps(rows))
        self.assertEqual(len(result.splitlines()), 101)
        self.assertIn("37,001,COUNTYAA", result)
        self.assertNotIn("vote", result.lower())

    def test_reject_missing_or_duplicate(self):
        for payload in (rows[:-1], rows+[rows[1]]):
            with self.assertRaises(ValueError):
                transform(json.dumps(payload))

    def test_wrong_election_geography_and_schema(self):
        broken=json.loads(json.dumps(rows))
        broken[1][1]="36"
        with self.assertRaises(ValueError):
            transform(json.dumps(broken))
        with self.assertRaises(ValueError):
            transform(json.dumps([["NAME","state","district"]]+rows[1:]))

if __name__ == "__main__":
    unittest.main()
