import gzip
import unittest
from build_alaska_senate_ballot_contract import FOLDER, build, verify_official


class AlaskaBallotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract = build()
        cls.html = gzip.decompress((FOLDER / '2026-general-candidates.html.gz').read_bytes())
        cls.pdf = (FOLDER / '2026-general-HD1-JD1.pdf').read_bytes()

    def test_original_four_printed_plus_two_certified_writeins(self):
        self.assertEqual(sum(p['printed_on_sample_ballot'] for p in self.contract['people']), 4)
        self.assertEqual(sum(p['certified_write_in'] for p in self.contract['people']), 2)
        self.assertEqual(self.contract['rank_columns'], 5)
        self.assertTrue(self.contract['generic_write_in_slot'])
        self.assertFalse(self.contract['national_input_enabled'])
        self.assertFalse(self.contract['final_rcv_contract_verified'])

    def test_distinct_sullivans_and_saved_native_party_conflict(self):
        incumbent = next(p for p in self.contract['people'] if p['source_candidate_id'] == 219760)
        other = next(p for p in self.contract['people'] if p['source_candidate_id'] == 219761)
        self.assertTrue(incumbent['incumbent']); self.assertFalse(other['incumbent'])
        self.assertEqual(other['official_registered_affiliation'], 'Undeclared')
        self.assertEqual(self.contract['party_conflicts'][0]['id'], 219761)

    def test_official_affiliation_or_name_drift_rejected(self):
        for old, new in [(b'Sullivan, Daniel J. Jr.', b'Sullivan, Wrong'), (b'(Undeclared)', b'(Registered Republican)')]:
            with self.assertRaises(ValueError): verify_official(self.html.replace(old, new), self.pdf)

    def test_certified_writein_not_silently_promoted_to_printed_nominee(self):
        with self.assertRaises(ValueError): verify_official(self.html.replace(b'Certified Write-In', b'Printed Nominee'), self.pdf)


if __name__ == '__main__': unittest.main()
