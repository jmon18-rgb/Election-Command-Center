import hashlib
import io
import unittest
import zipfile
from build_nc_official_candidate_votes_2026 import build

SOURCE = ("https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/"
          "2026_11_03/results_pct_20261103.zip")
HEADER = ("County\tElection Date\tPrecinct\tContest Group ID\tContest Type\t"
          "Contest Name\tChoice\tChoice Party\tVote For\tElection Day\t"
          "Early Voting\tAbsentee by Mail\tProvisional\tTotal Votes\n")


def zip_data(records):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("results_pct_20261103.txt", HEADER + records)
    return stream.getvalue()


def entry(county, name, party, votes):
    return "\t".join([county, "11/03/2026", "01", "37", "C", "US SENATE",
                      name, party, "1", str(votes), "0", "0", "0",
                      str(votes)]) + "\n"


class ExportTests(unittest.TestCase):
    def setUp(self):
        self.payload = zip_data(entry("WAKE", "A", "DEM", 40) +
                                entry("WAKE", "B", "REP", 51) +
                                entry("DURHAM", "A", "DEM", 0) +
                                entry("DURHAM", "B", "REP", 0))
        self.review = {
            "mode": "nc-candidate-only", "reviewed": True,
            "verified_source_url": SOURCE,
            "verified_archive_sha256": hashlib.sha256(self.payload).hexdigest(),
            "office": "Senate", "race_key": "NC-SEN",
            "contest_name": "US SENATE", "contest_group_id": "37",
        }
        self.fips = {"WAKE": "37183", "DURHAM": "37063"}
        self.time = "2026-11-04T00:45:00Z"

    def export(self, **kwargs):
        return build(kwargs.get("payload", self.payload),
                     kwargs.get("review", self.review),
                     kwargs.get("fips", self.fips),
                     checked_at=kwargs.get("checked_at", self.time))

    def test_positive_counties_only_no_ballots_or_probability(self):
        feed = self.export()
        self.assertEqual(feed["schema"], "nc-official-candidate-votes-v1")
        self.assertEqual(feed["race_key"], "NC-SEN")
        self.assertEqual(len(feed["counties"]), 1)
        self.assertEqual(feed["counties"][0]["county_id"], "37183")
        self.assertEqual(sum(c["votes"] for c in feed["counties"][0]["candidates"]), 91)
        self.assertIsNone(feed["ballots_reported"])
        self.assertIsNone(feed["reporting_fraction"])
        self.assertFalse(feed["may_move_national_needle"])
        self.assertEqual(feed["source"]["sha256"],
                         hashlib.sha256(self.payload).hexdigest())

    def test_rejects_unapproved_or_changed_archive(self):
        with self.assertRaises(ValueError):
            self.export(review={**self.review, "reviewed": False})
        with self.assertRaises(ValueError):
            self.export(review={**self.review, "verified_archive_sha256": "b" * 64})

    def test_rejects_2024_and_bad_identity(self):
        with self.assertRaises(ValueError):
            self.export(checked_at="2024-11-05T22:00:00Z")
        with self.assertRaises(ValueError):
            self.export(review={**self.review, "race_key": "NC-GOV"})
        with self.assertRaises(ValueError):
            self.export(review={**self.review, "contest_name": "US PRESIDENT"})

    def test_requires_explicit_county_mapping(self):
        with self.assertRaises(ValueError):
            self.export(fips={})

    def test_rejects_empty_counties(self):
        no_vote = zip_data(entry("WAKE", "A", "DEM", 0) +
                           entry("WAKE", "B", "REP", 0))
        review = {**self.review,
                  "verified_archive_sha256": hashlib.sha256(no_vote).hexdigest()}
        with self.assertRaises(ValueError):
            self.export(payload=no_vote, review=review)


if __name__ == "__main__":
    unittest.main()
