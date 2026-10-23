import unittest
from probe_nc_dashboard_downloads import inspect
class TestSourceDiscovery(unittest.TestCase):
 def test_allowlist_and_no_promotion(self):
  p=inspect('<script src="/js/app.js"></script><a href="https://er.ncsbe.gov/exports/results.csv">Export</a><a href="https://evil.example/x.csv">Bad</a>',"https://er.ncsbe.gov/")
  self.assertEqual(p['published_file_urls'],['https://er.ncsbe.gov/exports/results.csv'])
  self.assertEqual(p['script_urls'],['https://er.ncsbe.gov/js/app.js'])
  self.assertFalse(p['production_2026_feed_verified'])
 def test_missing_link_is_not_zero_results(self):
  p=inspect('<div>Election 2026</div>',"https://er.ncsbe.gov/downloads.html")
  self.assertEqual(p['published_file_urls'],[])
  self.assertFalse(p['county_candidate_votes_verified'])
if __name__=="__main__":unittest.main()
