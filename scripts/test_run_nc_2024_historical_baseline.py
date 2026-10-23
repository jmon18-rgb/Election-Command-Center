import unittest
from run_nc_2024_historical_baseline import generate, transform_adjacency
class RunnerTests(unittest.TestCase):
    def test_no_shortcut_to_live_model(self):
        with self.assertRaises((ValueError,TypeError)):
            generate('[]','',archive_sha256='abc',member='bogus')
    def test_official_adjacency_parse(self):
        names=['COUNTY'+chr(65+i//26)+chr(65+i%26) for i in range(100)]
        body='County Name|County GEOID|Neighbor Name|Neighbor GEOID\\n' + ''.join(
            '%s County, NC|37%03d|%s County, NC|37%03d\\n' % (n,2*i+1,n,2*i+1)
            for i,n in enumerate(names))
        csv=transform_adjacency(body)
        self.assertEqual(len(csv.splitlines()),101)
        self.assertIn('37,001,COUNTYAA',csv)
        with self.assertRaises(ValueError):transform_adjacency(body.rsplit('\\n',2)[0]+'\\n')

    def test_invalid_census_refused_before_votes(self):
        with self.assertRaises(ValueError):
            generate('[["NAME","state","county"],["Bad","37","001"]]',
                     '',archive_sha256='abc',member='bogus')
if __name__=="__main__": unittest.main()
