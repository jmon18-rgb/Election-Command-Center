#!/usr/bin/env python3
import unittest
from datetime import datetime, timezone
from probe_nh_2026_official_federal_links import assess, official_link

WHEN=datetime(2026,10,24,18,tzinfo=timezone.utc)
BASE="<h1>2026 General Election Results</h1>"
def link(label,href): return f'<a href="{href}"><span>{label}</span></a>'

class NH2026OfficialFederalLinksTests(unittest.TestCase):
    def test_future_sections_without_links_do_not_count_as_results(self):
        doc=BASE+'<p>Representative in Congress District No. 1</p><p>US Senator Summary</p>'
        x=assess(doc,checked_at=WHEN)
        self.assertTrue(all(row["status"]=="OFFICIAL_REPORT_LINK_NOT_YET_PUBLISHED"
                            for row in x["reports"].values()))
        self.assertFalse(x["approved_live_feed"])
        self.assertIsNone(x["candidate_votes"])

    def test_identify_only_exact_official_report_anchor_labels(self):
        page=BASE+link("Representative in Congress District No. 1",
                       "/sites/g/files/nh01.pdf")+link(
             "Representative in Congress District No. 2","/sites/g/files/nh02.csv")+link(
             "US Senator Summary", "/sites/g/files/senate.pdf")
        x=assess(page,checked_at=WHEN)["reports"]
        self.assertEqual(x["House|NH-01"]["candidate_official_url"],
                         "https://www.sos.nh.gov/sites/g/files/nh01.pdf")
        self.assertEqual(x["House|NH-02"]["candidate_official_url"],
                         "https://www.sos.nh.gov/sites/g/files/nh02.csv")
        self.assertEqual(x["Senate|NH"]["status"],"EXACT_OFFICIAL_LINK_FOUND_UNVERIFIED")
        self.assertTrue(all(not row["source_id_approved"] for row in x.values()))

    def test_unofficial_external_or_placeholder_urls_rejected(self):
        page=BASE+link("Representative in Congress District No. 1","#")+link(
             "Representative in Congress District No. 2",
             "https://evil.example/votes.pdf")+link("US Senator Summary", "javascript:alert(1)")
        x=assess(page,checked_at=WHEN)
        self.assertTrue(all(row["candidate_official_url"] is None for row in x["reports"].values()))
        for url in [
            "http://sos.nh.gov/data.csv",
            "https://sos.nh.gov.evil.example/data.csv",
            "https://sos.nh.gov:9000/data.csv",
            "https://someone@sos.nh.gov/data.csv",
            "https://sos.nh.gov/2026-general-election-results",
        ]: self.assertFalse(official_link(url),url)

    def test_duplicate_candidate_links_rejected(self):
        page=BASE+link("US Senator Summary","/a.pdf")+link("US Senator Summary","/b.pdf")
        result=assess(page,checked_at=WHEN)["reports"]["Senate|NH"]
        self.assertEqual(result["status"],"DUPLICATED_AMBIGUOUS_LINK")
        self.assertIsNone(result["candidate_official_url"])

    def test_unavailable_source_does_not_invent_results(self):
        x=assess("",checked_at=WHEN,source_available=False)
        self.assertEqual(x["status"],"SOURCE_UNAVAILABLE")
        self.assertTrue(all(not v["source_id_approved"] for v in x["reports"].values()))
        with self.assertRaises(ValueError): assess(BASE,checked_at=datetime(2026,10,24))

if __name__ == "__main__":
    unittest.main()
