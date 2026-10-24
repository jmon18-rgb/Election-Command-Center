import copy
import unittest

from refresh_approved_ohio_nist import refresh, reject_vote_regression, END
from test_build_approved_ohio_nist_results import approval, xml, WHEN, UNAPPROVED


class OhioApprovedSourceRefresh(unittest.TestCase):
    def test_disabled_source_never_needs_even_valid_xml(self):
        result=refresh(UNAPPROVED,None,b"THIS WOULD BE MOCK",WHEN)
        self.assertEqual(result["status"],"DISABLED_SOURCE_NOT_READ")
        self.assertIsNone(result["snapshot"])

    def test_first_approved_report_idempotent_then_new_results_refresh(self):
        first=refresh(approval(),None,xml(dem=120,rep=140),WHEN)
        self.assertEqual(first["status"],"UPDATED")
        self.assertFalse(first["snapshot"]["may_move_national_needle"])
        self.assertEqual(
            refresh(approval(),first["snapshot"],xml(dem=120,rep=140),WHEN)["status"],
            "UNCHANGED")
        newer=refresh(approval(),first["snapshot"],xml(dem=135,rep=141),WHEN)
        self.assertEqual(newer["status"],"UPDATED")
        self.assertNotEqual(newer["snapshot"]["source"]["xml_sha256"],
                            first["snapshot"]["source"]["xml_sha256"])

    def test_source_revisions_and_vote_corrections_do_not_silently_regress(self):
        prior=refresh(approval(),None,xml(dem=120,rep=140),WHEN)["snapshot"]
        with self.assertRaisesRegex(ValueError,"candidate vote regression"):
            refresh(approval(),prior,xml(dem=119,rep=140),WHEN)
        for modify in ("candidate","county","race","time","metadata"):
            bad=copy.deepcopy(prior)
            if modify=="candidate":
                bad["races"][0]["counties"][0]["candidates"][0]["votes"]+=1
            if modify=="county":
                bad["races"][0]["counties"][0]["county_fips"]="39003"
            if modify=="race":
                bad["races"][0]["dashboard_race_id"]="Senate|OH"
            if modify=="time":
                bad["source"]["generated_at"]="2026-11-04T01:05:00Z"
            if modify=="metadata":
                bad["may_move_national_needle"]=True
            with self.assertRaises(ValueError):
                reject_vote_regression(bad,prior)

    def test_outside_election_night_and_wrong_source_fail_closed(self):
        with self.assertRaises(ValueError):
            refresh(approval(),None,xml(),END.replace(day=7))
        with self.assertRaises(ValueError):
            refresh(approval(),None,b"<not-xml/>",WHEN)
        wrong=approval()
        wrong["real_results_publication_reviewed"]=False
        with self.assertRaises(ValueError):
            refresh(wrong,None,xml(),WHEN)


if __name__=="__main__":
    unittest.main()
