import unittest
from audit_nc_official_zip_layout import inspect
class Tests(unittest.TestCase):
 def test_reject_unknown_archive(self):
  with self.assertRaises(ValueError):inspect(b"not an official ZIP")
if __name__=="__main__":unittest.main()
