import hashlib
import io
import unittest
import zipfile
from run_nc_2022_senate_historical_replay import (
    inspect_original, OFFICIAL_SENATE_TOTALS, OFFICIAL_URL, MEMBER,
)
from nc_official_zip_staging_bridge import stage_zip

HEADER=("County\tElection Date\tPrecinct\tContest Group ID\tContest Type\t"
        "Contest Name\tChoice\tChoice Party\tVote For\tElection Day\t"
        "Early Voting\tAbsentee by Mail\tProvisional\tTotal Votes\n")


def sample(member=MEMBER, group="17", day="11/08/2022"):
    out=io.BytesIO()
    text=HEADER
    for party, candidate, votes in (("DEM","A",20),("REP","B",25)):
        text+="\t".join(["WAKE",day,"01",group,"C","US SENATE",candidate,
                         party,"1",str(votes),"0","0","0",str(votes)])+"\n"
    with zipfile.ZipFile(out,"w",zipfile.ZIP_DEFLATED) as z:
        z.writestr(member,text)
    return out.getvalue()


class Historical2022Tests(unittest.TestCase):
    def test_explicit_2022_election_path_is_allowed_but_not_model_promoted(self):
        payload=sample()
        stage=stage_zip(payload,manifest={
            "election_date":"2022-11-08","source_url":OFFICIAL_URL,
            "sha256":hashlib.sha256(payload).hexdigest(),
            "contest_name":"US SENATE","contest_group_id":"17",
        },county_fips={"WAKE":"37183"})
        self.assertEqual(stage["county_count"],1)
        self.assertEqual(stage["source"]["archive_member"],MEMBER)
        self.assertFalse(stage["may_move_national_needle"])
        self.assertFalse(stage["production"])

    def test_other_unreviewed_2022_date_and_bad_member_denied(self):
        payload=sample()
        for day in ("2022-11-01","2022-11-09","2020-11-03"):
            with self.assertRaises(ValueError):
                stage_zip(payload,manifest={
                    "election_date":day,"source_url":OFFICIAL_URL,
                    "sha256":hashlib.sha256(payload).hexdigest(),
                    "contest_name":"US SENATE","contest_group_id":"17",
                },county_fips={"WAKE":"37183"})
        other=sample(member="spoofed.txt")
        with self.assertRaisesRegex(ValueError,"members"):
            stage_zip(other,manifest={
                "election_date":"2022-11-08","source_url":OFFICIAL_URL,
                "sha256":hashlib.sha256(other).hexdigest(),
                "contest_name":"US SENATE","contest_group_id":"17",
            },county_fips={"WAKE":"37183"})

    def test_correct_source_does_not_accept_missing_99_counties(self):
        with self.assertRaisesRegex(ValueError,"100"):
            inspect_original(sample(),{"WAKE":"37183"})

    def test_signed_hash_mismatch_blocks_historical_acceptance(self):
        with self.assertRaisesRegex(ValueError,"reviewed SHA"):
            inspect_original(sample(),{"WAKE":"37183"},pinned_sha="0"*64)

    def test_independent_certification_values(self):
        self.assertEqual(OFFICIAL_SENATE_TOTALS,{"DEM":1784049,"REP":1905786})

if __name__=="__main__":
    unittest.main()
