#!/usr/bin/env python3
"""Synthetic official-page fixtures, no real candidate/result file requests."""
import datetime as dt
import unittest
from probe_ca_2026_media_file_identities import assess,exact_file,FILES
BEFORE=dt.datetime(2026,10,24,23,tzinfo=dt.timezone.utc)
CLOSE=dt.datetime(2026,11,4,4,tzinfo=dt.timezone.utc)
HEADER="<h1>California General Election Tuesday, November 3, 2026</h1>"
def mock_page(names=FILES):
    return HEADER+"".join(
      '<a href="https://media.sos.ca.gov/media/'+name+'">'+name+"</a>"
      for name in names)

class CaliforniaMediaIdentityTests(unittest.TestCase):
    def test_preclose_and_postclose_are_metadata_only(self):
        for now in (BEFORE,CLOSE):
            x=assess(mock_page(),now)
            self.assertEqual(x["expected_files"],8)
            self.assertEqual(x["exact_file_identities"],8)
            self.assertIn("V26GG.txt",x["official_metadata_links"])
            self.assertTrue(x["official_2026_general_verified"])
            self.assertFalse(x["rights_cleared"])
            self.assertFalse(x["browser_cors_verified"])
            self.assertFalse(x["api_schema_verified"])
            self.assertFalse(x["machine_house_feed_verified"])
            self.assertFalse(x["may_update_model"])
            self.assertFalse(x["geographic_needle_calibrated"])
            self.assertEqual(x["result_files_downloaded"],0)
            self.assertIsNone(x["verified_candidate_votes"])
        self.assertEqual(assess(mock_page(),BEFORE)["status"],
                         "CA_2026_MEDIA_LINKS_BEFORE_LOCAL_CLOSE")
        self.assertEqual(assess(mock_page(),CLOSE)["status"],
                         "CA_POST_CLOSE_LINKS_EXIST_BUT_VOTES_UNVERIFIED")
    def test_wrong_elections_mock_and_unavailable(self):
        for bad in ("California General Election November 5, 2024",
                    "California Primary Election June 2, 2026"):
            html=mock_page().replace(HEADER,"<h1>"+bad+"</h1>")
            self.assertEqual(assess(html,CLOSE)["status"],"CA_WRONG_ELECTION_PAGE")
        self.assertEqual(assess(mock_page()+"TEST RESULTS",CLOSE)["status"],
                         "CA_TEST_MODE_QUARANTINED")
        self.assertEqual(assess("",CLOSE,False)["status"],"CA_INDEX_UNAVAILABLE")
    def test_old_cross_host_duplicate_and_query_file_fail_closed(self):
        good=mock_page()
        official="https://media.sos.ca.gov/media/V26GG.txt"
        for bad in ("https://evil.example/media/V26GG.txt",
                    "https://media.sos.ca.gov/media/V24GG.txt",
                    "https://media.sos.ca.gov/media/V26GG.txt?year=2024",
                    "https://user@media.sos.ca.gov/media/V26GG.txt",
                    "http://media.sos.ca.gov/media/V26GG.txt"):
            with self.subTest(url=bad):
                x=assess(good.replace(official,bad),CLOSE)
                self.assertEqual(x["status"],"CA_UNSAFE_OR_DUPLICATE_FILE_LINKS")
                self.assertEqual(x["exact_file_identities"],0)
                self.assertFalse(x["machine_house_feed_verified"])
        dup=assess(good+'<a href="'+official+'">V26GG.txt</a>',CLOSE)
        self.assertIn("V26GG.txt",dup["unsafe_or_ambiguous"])
        self.assertEqual(dup["exact_file_identities"],0)
    def test_partial_listing_cannot_fill_missing(self):
        doc=assess(mock_page(["C26GG.txt","R26GG.txt"]),CLOSE)
        self.assertEqual(doc["exact_file_identities"],2)
        self.assertEqual(len(doc["missing_file_identities"]),6)
        with self.assertRaises(ValueError):
            assess(mock_page(),dt.datetime(2026,11,4,4))
        self.assertFalse(exact_file("https://media.sos.ca.gov/media/V24GG.txt",
                                    "V26GG.txt"))

if __name__=="__main__":
    unittest.main()
