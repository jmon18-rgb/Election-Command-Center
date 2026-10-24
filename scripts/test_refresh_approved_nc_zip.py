import hashlib
import io
import unittest
import zipfile

from refresh_approved_nc_zip import refresh, SOURCE, POLL_CLOSE

HEADER = ("County\tElection Date\tPrecinct\tContest Group ID\tContest Type\t"
          "Contest Name\tChoice\tChoice Party\tVote For\tElection Day\t"
          "Early Voting\tAbsentee by Mail\tProvisional\tTotal Votes\n")


def archive(dem, rep):
    tsv = HEADER
    for name, party, count in (("Candidate A", "DEM", dem),
                               ("Candidate B", "REP", rep)):
        tsv += "\t".join(["WAKE", "11/03/2026", "01", "37", "C",
                          "US SENATE", name, party, "1", str(count),
                          "0", "0", "0", str(count)]) + "\n"
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("results_pct_20261103.txt", tsv)
    return stream.getvalue()


class RefreshTests(unittest.TestCase):
    def setUp(self):
        self.a = archive(30, 40)
        self.b = archive(40, 50)
        self.c = archive(29, 50)
        self.config = {
            "schema": "county-desk-config-v1", "enabled": True,
            "snapshot_path": "./data/nc_candidate_votes_2026.json",
            "expected": {
                "mode": "nc-candidate-only",
                "reviewed": True, "verified_source_url": SOURCE,
                "verified_archive_sha256": hashlib.sha256(self.a).hexdigest(),
                "office": "Senate", "race_key": "NC-SEN",
                "contest_name": "US SENATE", "contest_group_id": "37",
                "allow_verified_revisions": True,
            },
        }
        self.counties = {"WAKE": "37183"}
        self.when = "2026-11-04T00:45:00Z"

    def check(self, payload=None, previous=None, config=None, now=None):
        return refresh(self.config if config is None else config,
                       previous,
                       self.a if payload is None else payload,
                       self.counties,
                       self.when if now is None else now)

    def test_disabled_skips_no_votes(self):
        got = self.check(config={**self.config, "enabled": False})
        self.assertEqual(got["status"], "DISABLED")
        self.assertIsNone(got["snapshot"])

    def test_first_snapshot_requires_pinned_sha_even_with_revisions_flag(self):
        first = self.check()
        self.assertEqual(first["status"], "UPDATED")
        self.assertIsNone(first["snapshot"]["ballots_reported"])
        self.assertEqual(first["snapshot"]["counties"][0]["county_id"], "37183")
        self.assertFalse(first["snapshot"]["may_move_national_needle"])
        with self.assertRaisesRegex(ValueError, "fingerprint"):
            self.check(payload=self.b)

    def test_new_archive_requires_explicit_revision_permission(self):
        prior = self.check()["snapshot"]
        restricted = {**self.config, "expected": {
            **self.config["expected"], "allow_verified_revisions": False,
        }}
        with self.assertRaisesRegex(ValueError, "approval"):
            self.check(payload=self.b, previous=prior, config=restricted)

    def test_monotonic_revision_rotates_config_sha(self):
        prior = self.check()["snapshot"]
        newer = self.check(payload=self.b, previous=prior,
                           now="2026-11-04T01:30:00Z")
        self.assertEqual(newer["status"], "UPDATED")
        self.assertEqual(newer["config"]["expected"]["verified_archive_sha256"],
                         hashlib.sha256(self.b).hexdigest())
        self.assertEqual(sum(c["votes"] for c in newer["snapshot"]["counties"][0]["candidates"]),90)

    def test_vote_regression_blocks_revision(self):
        prior = self.check()["snapshot"]
        with self.assertRaisesRegex(ValueError, "regression"):
            self.check(payload=self.c, previous=prior,
                       now="2026-11-04T01:30:00Z")

    def test_unchanged_archive_does_not_redeploy_every_ten_minutes(self):
        previous = self.check()["snapshot"]
        recent = self.check(previous=previous, now="2026-11-04T01:05:00Z")
        self.assertEqual(recent["status"], "UNCHANGED")
        updated = self.check(previous=previous, now="2026-11-04T02:00:00Z")
        self.assertEqual(updated["status"], "UPDATED")

    def test_no_candidate_votes_before_nov3_730pm_est_poll_close(self):
        self.assertEqual(POLL_CLOSE.isoformat(), "2026-11-04T00:30:00+00:00")
        for early in ("2026-11-03T05:00:00Z",
                      "2026-11-03T23:59:59Z",
                      "2026-11-04T00:29:59Z"):
            with self.subTest(early=early):
                with self.assertRaisesRegex(ValueError, "before polls close"):
                    self.check(now=early)
        self.assertEqual(self.check(now="2026-11-04T00:30:00Z")["status"], "UPDATED")
        # Even an accidentally enabled source cannot publish mock candidate votes early.
        self.assertEqual(self.check(config={**self.config, "enabled": False},
                                    now="2026-11-04T00:29:59Z")["status"], "DISABLED")

    def test_blocks_unreviewed_and_off_window(self):
        config = {**self.config, "expected": {**self.config["expected"], "reviewed": False}}
        with self.assertRaises(ValueError):
            self.check(config=config)
        with self.assertRaises(ValueError):
            self.check(now="2026-10-23T20:00:00Z")

    def test_previous_source_identity_mismatch_fails(self):
        previous = self.check()["snapshot"]
        previous["source"]["sha256"] = "0" * 64
        with self.assertRaises(ValueError):
            self.check(previous=previous)


if __name__ == "__main__":
    unittest.main()
