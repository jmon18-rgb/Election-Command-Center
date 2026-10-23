import unittest
from aggregate_nc_official_precinct_votes import aggregate

HEAD = ("County\tElection Date\tPrecinct\tContest Group ID\tContest Type\t"
        "Contest Name\tChoice\tChoice Party\tVote For\tElection Day\t"
        "Early Voting\tAbsentee by Mail\tProvisional\tTotal Votes\tReal Precinct\n")


def line(county, date, precinct, contest, choice, party, votes, *,
         group="42", day=None, vote_for="1"):
    if day is None:
        day = votes
    return "\t".join([
        county, date, precinct, group, "C", contest, choice, party,
        vote_for, str(day), "0", "0", "0", str(votes), "Y"
    ]) + "\n"


class Tests(unittest.TestCase):
    def setup(self, text, *, contest="US PRESIDENT", group="42"):
        return aggregate(text, date="11/05/2024", contest=contest,
                         contest_group_id=group, county_fips={"WAKE": "37183"})

    def test_exact_contest_aggregates_precincts(self):
        source = (HEAD +
                  line("WAKE", "11/05/2024", "01", "US PRESIDENT", "A", "DEM", 40) +
                  line("WAKE", "11/05/2024", "02", "US PRESIDENT", "A", "DEM", 30) +
                  line("WAKE", "11/05/2024", "01", "US PRESIDENT", "B", "REP", 50) +
                  line("WAKE", "11/05/2024", "01", "US SENATE", "A", "DEM", 100))
        result = self.setup(source)
        self.assertEqual(result, [
            {"county_id": "37183", "candidates": [
                {"name": "A", "party": "DEM", "votes": 70},
                {"name": "B", "party": "REP", "votes": 50},
            ]},
        ])

    def test_wrong_contest_fails(self):
        with self.assertRaises(ValueError):
            self.setup(HEAD + line("WAKE", "11/05/2024", "01", "X", "A", "D", 1))

    def test_method_mismatch_rejected(self):
        with self.assertRaisesRegex(ValueError, "methods"):
            self.setup(HEAD + line("WAKE", "11/05/2024", "01",
                                   "US PRESIDENT", "A", "D", 10, day=9))

    def test_ambiguous_or_wrong_contest_id_rejected(self):
        source = (HEAD +
                  line("WAKE", "11/05/2024", "01", "US PRESIDENT", "A", "D", 10) +
                  line("WAKE", "11/05/2024", "02", "US PRESIDENT", "B", "R", 10, group="55"))
        with self.assertRaises(ValueError):
            self.setup(source)
        with self.assertRaises(ValueError):
            self.setup(HEAD + line("WAKE", "11/05/2024", "01",
                                   "US PRESIDENT", "A", "D", 10), group="55")

    def test_duplicate_precinct_candidate_rejected(self):
        record = line("WAKE", "11/05/2024", "01", "US PRESIDENT", "A", "D", 10)
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            self.setup(HEAD + record + record)

    def test_vote_for_multiple_rejected(self):
        with self.assertRaisesRegex(ValueError, "multiple"):
            self.setup(HEAD + line("WAKE", "11/05/2024", "01",
                                   "US PRESIDENT", "A", "D", 10, vote_for="2"))

    def test_unmapped_county_fails(self):
        with self.assertRaises(ValueError):
            aggregate(HEAD + line("WAKE", "11/05/2024", "01",
                                  "US PRESIDENT", "A", "D", 10),
                      date="11/05/2024", contest="US PRESIDENT",
                      county_fips={})


if __name__ == "__main__":
    unittest.main()
