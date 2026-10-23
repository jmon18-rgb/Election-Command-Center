import unittest
from probe_nc_download_form import inspect
class Tests(unittest.TestCase):
 def test_form_structure_not_feed(self):
  x=inspect('<form method="post" action="/Download"><select name="ElectionID" id="e"></select><button type="submit">Display</button></form>')
  self.assertEqual(x["forms"][0]["method"],"post")
  self.assertEqual(x["select_controls"][0]["name"],"ElectionID")
  self.assertFalse(x["production_2026_feed_verified"])
 def test_external_actions_rejected(self):
  x=inspect('<form action="https://evil.test/collect"></form>')
  self.assertEqual(x["forms"][0]["action"],"EXTERNAL_OR_UNTRUSTED")
if __name__=="__main__":unittest.main()
