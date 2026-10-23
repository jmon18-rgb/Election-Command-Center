import unittest
from probe_nc_download_js import inspect
class Tests(unittest.TestCase):
 def test_script_snippets_no_promotion(self):
  x=inspect('<script>function f(){var e=document.getElementById("cboElection");fetch("/api");}</script>')
  self.assertTrue(any('cboElection' in s for s in x['inline_js_snippets']))
  self.assertFalse(x['endpoint_verified'])
if __name__=="__main__":unittest.main()
