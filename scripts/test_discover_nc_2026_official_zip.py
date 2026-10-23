import io
import unittest
import zipfile

from discover_nc_2026_official_zip import (
    ELECTION, CANDIDATE_ZIP, select_source, inspect_archive,
)

HEADER = ("County\tElection Date\tPrecinct\tContest Group ID\tContest Type\t"
          "Contest Name\tChoice\tChoice Party\tVote For\tElection Day\t"
          "Early Voting\tAbsentee by Mail\tProvisional\tTotal Votes\tReal Precinct\n")


def zip_payload(text, member="results_pct_20261103.txt"):
    target = io.BytesIO()
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr(member, text)
    return target.getvalue()


def make_row(date=ELECTION):
    return ("WAKE\t" + date +
            "\t01\t123\tC\tUS SENATE\tCandidate A\tDEM\t1\t"
            "10\t5\t0\t0\t15\tY\n")


class Tests(unittest.TestCase):
    def test_catalog_date_is_not_evidence_that_zip_exists(self):
        cat = [{"edt": "11/03/2026", "pct": "1", "arc": "0"},
               {"edt": "11/05/2024", "pct": "1", "arc": "1"}]
        got = select_source(cat, [])
        self.assertTrue(got["eligible"])
        self.assertEqual(got["anticipated_source_url"], CANDIDATE_ZIP)
        self.assertIn("UNCONFIRMED", got["reason"])

    def test_filtered_or_ambiguous_catalog_fails(self):
        row = {"edt": "11/03/2026", "pct": "1"}
        for cat, blocked in [([], []), ([row, row], []),
                             ([row], [{"edt": ELECTION}]),
                             ([{"edt": ELECTION, "pct": "0"}], [])]:
            with self.subTest(cat=cat):
                self.assertFalse(select_source(cat, blocked)["eligible"])

    def test_official_zip_schema_observation_not_live_certification(self):
        observed = inspect_archive(zip_payload(HEADER + make_row()))
        self.assertEqual(observed["sampled_precinct_rows"], 1)
        self.assertFalse(observed["county_votes_ingested"])
        self.assertFalse(observed["source_verified_for_live_2026"])
        self.assertFalse(observed["may_move_national_needle"])
        self.assertEqual(len(observed["sha256_observed"]), 64)

    def test_wrong_member_cycle_and_schema_rejected(self):
        for payload in (
            zip_payload(HEADER + make_row(), "evil.txt"),
            zip_payload(HEADER + make_row("11/05/2024")),
            zip_payload("County\tChoice\nWAKE\tA\n"),
            b"not zip",
        ):
            with self.subTest(payload=payload[:25]), self.assertRaises(Exception):
                inspect_archive(payload)


if __name__ == "__main__":
    unittest.main()
