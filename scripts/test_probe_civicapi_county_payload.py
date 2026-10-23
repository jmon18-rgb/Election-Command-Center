import unittest
from probe_civicapi_county_payload import inspect_payload
class ProbeTests(unittest.TestCase):
    def test_statewide_candidates_are_not_county_data(self):
        x=inspect_payload({"candidates":[{"name":"A","votes":100}]})
        self.assertFalse(x["county_results_verified"])
        self.assertEqual(x["county_candidate_row_paths"],[])
    def test_county_shaped_rows_do_not_automatically_certify(self):
        x=inspect_payload({"counties":[{"county_fips":"37001",
               "candidates":[{"name":"A","votes":100}]}]})
        self.assertIn(".counties[]",x["county_candidate_row_paths"])
        self.assertFalse(x["county_results_verified"])
if __name__=="__main__":unittest.main()
