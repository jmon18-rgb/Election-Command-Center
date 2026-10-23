import hashlib
import io
import unittest
import zipfile

from nc_official_zip_staging_bridge import stage_zip

HEAD = ("County\tElection Date\tPrecinct\tContest Group ID\tContest Type\t"
        "Contest Name\tChoice\tChoice Party\tVote For\tElection Day\t"
        "Early Voting\tAbsentee by Mail\tProvisional\tTotal Votes\n")


def row(candidate, party, count, precinct="01", contest="US PRESIDENT"):
    return "\t".join(["WAKE", "11/05/2024", precinct, "42", "C",
                       contest, candidate, party, "1",
                       str(count), "0", "0", "0", str(count)]) + "\n"


def archive(contents, member="results_pct_20241105.txt"):
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr(member, contents)
    return out.getvalue()


class TestOfficialZipBridge(unittest.TestCase):
    def setUp(self):
        self.payload = archive(HEAD + row("A", "DEM", 40) +
                               row("A", "DEM", 10, precinct="02") +
                               row("B", "REP", 52))
        self.manifest = {
            "election_date": "2024-11-05",
            "source_url": ("https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/"
                           "2024_11_05/results_pct_20241105.zip"),
            "sha256": hashlib.sha256(self.payload).hexdigest(),
            "contest_name": "US PRESIDENT",
            "contest_group_id": "42",
        }
        self.fips = {"WAKE": "37183"}

    def call(self, payload=None, manifest=None):
        return stage_zip(self.payload if payload is None else payload,
                         manifest=self.manifest if manifest is None else manifest,
                         county_fips=self.fips)

    def test_stages_votes_without_invented_ballot_denominator(self):
        result = self.call()
        self.assertEqual(result["county_count"], 1)
        self.assertEqual(result["counties"][0]["county_id"], "37183")
        self.assertEqual(result["counties"][0]["candidates"][0]["votes"], 50)
        self.assertEqual(result["counties"][0]["candidates"][1]["votes"], 52)
        self.assertIsNone(result["ballots_reported"])
        self.assertIsNone(result["source_reporting_timestamp"])
        self.assertFalse(result["source_verified_for_live_2026"])
        self.assertFalse(result["production"])
        self.assertFalse(result["may_move_national_needle"])
        self.assertEqual(result["source"]["archive_sha256"],
                         self.manifest["sha256"])

    def test_rejects_wrong_archive_hash(self):
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            self.call(manifest={**self.manifest, "sha256": "0" * 64})

    def test_rejects_wrong_member_even_with_matching_sha(self):
        wrong = archive(HEAD + row("A", "D", 1), "sneaky.txt")
        with self.assertRaisesRegex(ValueError, "members"):
            self.call(payload=wrong, manifest={**self.manifest,
                       "sha256": hashlib.sha256(wrong).hexdigest()})

    def test_rejects_wrong_source_url(self):
        for bad in (
            "https://example.com/ENRS/2024_11_05/results_pct_20241105.zip",
            "https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_11_03/results_pct_20261103.zip",
            self.manifest["source_url"] + "?changed=1",
        ):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                self.call(manifest={**self.manifest, "source_url": bad})

    def test_rejects_wrong_contest_identity(self):
        for field, changed in [("contest_name", "US SENATE"),
                               ("contest_group_id", "999")]:
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.call(manifest={**self.manifest, field: changed})

    def test_rejects_empty_source_and_missing_fips(self):
        with self.assertRaises(ValueError):
            self.call(payload=b"")
        with self.assertRaises(ValueError):
            stage_zip(self.payload, manifest=self.manifest, county_fips={})

    def test_rejects_vote_method_mismatch(self):
        malformed = archive(HEAD + row("A", "D", 10).replace(
            "\t10\t0\t0\t0\t10\n", "\t9\t0\t0\t0\t10\n"))
        with self.assertRaisesRegex(ValueError, "methods"):
            self.call(payload=malformed, manifest={**self.manifest,
                       "sha256": hashlib.sha256(malformed).hexdigest()})


if __name__ == "__main__":
    unittest.main()
