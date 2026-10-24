#!/usr/bin/env python3
import unittest
from datetime import datetime,timezone
from probe_de_wy_2026_official_general_links import assess,official_url

T=datetime(2026,10,24,19,tzinfo=timezone.utc)
WY='<h4>2026 Election</h4><a href="2026PrimaryResults.aspx">Primary Election</a>'
DE='<h2>Current Year Elections</h2><a href="/results/2026primary.shtml">September 2026 Primary Election Official Results</a>'

class OfficialDEWYLinkDiscoveryTests(unittest.TestCase):
    def test_primary_returns_are_not_general(self):
        for state,html in [("WY",WY),("DE",DE)]:
            x=assess(html,state,T)
            self.assertEqual(x["status"],"2026_GENERAL_RESULT_LINK_NOT_ON_PAGE")
            self.assertEqual(x["candidate_official_links"],[])
            self.assertFalse(x["automated_feed_verified"])
            self.assertFalse(x["may_update_model"])
            self.assertIsNone(x["candidate_votes"])

    def test_official_general_link_only_after_actual_discovery(self):
        wy= WY+'<a href="/Elections/Docs/2026/2026GeneralResults.aspx">General Election</a>'
        de= DE+'<a href="/results/2026_general_results.pdf">Nov 3, 2026 General Election</a>'
        x=assess(wy,"WY",T)
        self.assertEqual(x["status"],"OFFICIAL_2026_GENERAL_LINK_FOUND_UNVERIFIED")
        self.assertEqual(x["candidate_official_links"],
                         ["https://sos.wyo.gov/Elections/Docs/2026/2026GeneralResults.aspx"])
        self.assertFalse(x["automated_feed_verified"])
        y=assess(de,"DE",T)
        self.assertEqual(y["candidate_official_links"],
                         ["https://elections.delaware.gov/results/2026_general_results.pdf"])
        self.assertIsNone(y["professional_calls"])

    def test_historical_general_cannot_pass_even_under_current_year_title(self):
        for state,base in [("WY",WY),("DE",DE)]:
            old=base+'<h4>2024 Election</h4><a href="/2024General.pdf">General Election</a>'
            self.assertEqual(assess(old,state,T)["candidate_official_links"],[])
        self.assertEqual(assess(DE+'<h2>Previous Elections</h2>'+
                     '<a href="/2024.pdf">General Election</a>',
                     "DE",T)["status"],"2026_GENERAL_RESULT_LINK_NOT_ON_PAGE")

    def test_external_and_fake_links_fail_closed(self):
        for state,base in [("WY",WY),("DE",DE)]:
            x=assess(base+'<a href="https://evil.example/2026.pdf">2026 General Election</a>',
                     state,T)
            self.assertEqual(x["candidate_official_links"],[])
            for u in [
                "http://"+("sos.wyo.gov" if state=="WY" else "elections.delaware.gov")+"/2026.csv",
                "https://attacker@"+("sos.wyo.gov" if state=="WY" else "elections.delaware.gov")+"/2026.csv",
                "https://evil.example/2026General.csv",
            ]:
                self.assertFalse(official_url(state,u))
        self.assertFalse(official_url("ZZ","https://elections.delaware.gov/results/"))

    def test_ambiguous_and_unavailable_are_not_zero_results(self):
        wy=WY+'<a href="/x/2026.htm">General Election</a>'+\
           '<a href="/y/2026.htm">General Election</a>'
        self.assertEqual(assess(wy,"WY",T)["status"],
                         "AMBIGUOUS_OFFICIAL_LINKS_NOT_APPROVED")
        unavailable=assess("","DE",T,available=False)
        self.assertEqual(unavailable["status"],"SOURCE_UNAVAILABLE_NOT_ASSESSED")
        self.assertEqual(unavailable["candidate_official_links"],[])
        self.assertFalse(unavailable["automated_feed_verified"])
        with self.assertRaises(ValueError):
            assess(DE,"DE",datetime(2026,10,24))
        with self.assertRaises(ValueError):
            assess(DE,"AK",T)

if __name__=="__main__":
    unittest.main()
