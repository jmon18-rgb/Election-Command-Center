#!/usr/bin/env python3
import datetime as dt
import io
import json
import unittest
import zipfile
from prepare_nc_official_senate_review import review

T = dt.datetime(2026, 11, 4, 1, 0, tzinfo=dt.timezone.utc)
COLS = ["County", "Election Date", "Precinct", "Contest Group ID", "Contest Type",
        "Contest Name", "Choice", "Choice Party", "Vote For", "Election Day",
        "Early Voting", "Absentee by Mail", "Provisional", "Total Votes"]
FIPS = {"WAKE": "37183", "DURHAM": "37063"}

def entry(county, name, party, count, election="11/03/2026",
          contest="US SENATE", group="37"):
    return [county, election, "01", group, "C", contest, name, party,
            "1", str(count), "0", "0", "0", str(count)]

def archive(rows):
    payload = "\t".join(COLS)+"\n"+"\n".join("\t".join(row) for row in rows)+"\n"
    out=io.BytesIO()
    with zipfile.ZipFile(out,"w",compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("results_pct_20261103.txt",payload)
    return out.getvalue()

class Tests(unittest.TestCase):
    def setUp(self):
        self.rows=[entry("WAKE","Candidate A","DEM",1234567),
                   entry("WAKE","Candidate B","REP",2345678),
                   entry("DURHAM","Candidate A","DEM",900),
                   entry("DURHAM","Candidate B","REP",800)]
    def test_no_candidate_votes_leak_and_exact_source_ids(self):
        result=review(archive(self.rows), FIPS, T)
        self.assertEqual(result["status"],"IDENTITY_REVIEW_REQUIRED")
        self.assertFalse(result["automatically_approved"])
        self.assertFalse(result["real_2026_votes_published_to_site"])
        self.assertEqual(result["all_source_counties_observed"],2)
        senate=result["senate_contest_identity_candidates"][0]
        self.assertEqual(senate["contest_group_id"],"37")
        self.assertEqual(senate["county_fips_observed"],["37063","37183"])
        self.assertEqual(len(senate["candidate_choice_party_pairs"]),2)
        serialized=json.dumps(result)
        for secret in ("1234567","2345678",'"votes"', '"total_votes"',
                       '"ballots_reported"', '"precinct_results"'):
            self.assertNotIn(secret,serialized)
    def test_fail_closed_early_wrong_source_and_invalid_county(self):
        with self.assertRaisesRegex(ValueError,"before polls close"):
            review(archive(self.rows),FIPS,T.replace(day=3,hour=23))
        with self.assertRaisesRegex(ValueError,"wrong.election"):
            review(archive(self.rows[:-1]+[entry("WAKE","C","DEM",1,
                election="11/05/2024")]),FIPS,T)
        with self.assertRaisesRegex(ValueError,"Unknown source county"):
            review(archive([entry("UNKNOWN","A","DEM",10)]),FIPS,T)
    def test_two_contests_never_auto_approved(self):
        rows=self.rows+[entry("WAKE","C","DEM",7,group="39")]
        outcome=review(archive(rows),FIPS,T)
        self.assertEqual(outcome["status"],
                         "MULTIPLE_SENATE_CONTEST_IDENTITIES_REQUIRE_REVIEW")
        self.assertEqual(len(outcome["senate_contest_identity_candidates"]),2)
    def test_no_senate_only_archive_not_approved(self):
        out=review(archive([entry("WAKE","A","DEM",1,contest="US HOUSE")]),FIPS,T)
        self.assertEqual(out["status"],"NO_SENATE_CONTEST_IDENTIFIED")
        self.assertFalse(out["automatically_approved"])

if __name__=="__main__":
    unittest.main()
