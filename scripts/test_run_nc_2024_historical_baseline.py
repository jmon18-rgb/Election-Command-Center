import unittest
from run_nc_2024_historical_baseline import generate
class RunnerTests(unittest.TestCase):
    def test_no_shortcut_to_live_model(self):
        with self.assertRaises((ValueError,TypeError)):
            generate('[]','',archive_sha256='abc',member='bogus')
    def test_invalid_census_refused_before_votes(self):
        with self.assertRaises(ValueError):
            generate('[["NAME","state","county"],["Bad","37","001"]]',
                     '',archive_sha256='abc',member='bogus')
if __name__=="__main__": unittest.main()
