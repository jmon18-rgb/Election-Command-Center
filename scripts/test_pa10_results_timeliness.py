"""Synthetic timing tests are not actual source latency evidence."""
import gzip
import unittest
from unittest.mock import patch
from datetime import datetime, timedelta, timezone
from pathlib import Path
from pa10_results_timeliness import discover_general, MatchedUpdates, preflight, parse_current_county


class TimingTests(unittest.TestCase):
    def test_current_parser_with_explicitly_synthetic_historical_transformation(self):
        raw = gzip.decompress((Path(__file__).resolve().parents[1] / 'data/pennsylvania_historical_sources/2024-dauphin-congress-official.html.gz').read_bytes())
        now = datetime(2026, 11, 4, 3, tzinfo=timezone.utc)
        with self.assertRaises(ValueError):
            parse_current_county(raw, now)
        # Synthetic format test only: never archive this as a real live capture.
        import re
        synthetic = raw.replace(b'2024 Presidential General Election Results', b'2026 General Election Results')
        synthetic = re.sub(rb'11/18/2024 12:36:56 PM', b'11/3/2026 9:00:00 PM', synthetic)
        parsed = parse_current_county(synthetic, now)
        self.assertEqual((parsed['dem'], parsed['rep']), (80272, 66986))
        for altered in [synthetic.replace(b'JANELLE STELSON', b'OTHER PERSON'),
                        synthetic.replace(b'147649', b'147650'),
                        synthetic.replace(b'11/3/2026 9:00:00 PM', b'11/3/2026 7:00:00 PM')]:
            with self.assertRaises(ValueError):
                parse_current_county(altered, now)

    def test_historical_menu_does_not_activate(self):
        raw = gzip.decompress((Path(__file__).resolve().parents[1] / 'data/pennsylvania_historical_sources/2024-dauphin-congress-official.html.gz').read_bytes())
        self.assertIsNone(discover_general(raw))

    def test_discovery_and_duplicates(self):
        link = b'<a href="/?key=51">2026 General Election Results</a>'
        self.assertIn('key=51&race=REPRESENTATIVE', discover_general(link + link))
        for raw in [link + link.replace(b'51', b'52'), link.replace(b'/?key=51', b'https://elsewhere.test/?key=51'), link.replace(b'51', b'51&key=52')]:
            with self.assertRaises(ValueError):
                discover_general(raw)
        for label in ['2026 Primary Election Results', '2024 General Election Results', '2026 General Election Results TEST']:
            self.assertIsNone(discover_general(('<a href="/?key=51">' + label + '</a>').encode()))

    def test_initial_and_repeats_are_not_timing_proof(self):
        m = MatchedUpdates()
        t = datetime(2026, 11, 4, 2, tzinfo=timezone.utc)
        for name in m.events:
            m.observe(name, 100, 200, t)
            m.observe(name, 100, 200, t + timedelta(seconds=15))
        self.assertEqual(m.comparisons(), [])

    def test_matched_change_sampling_bounds_and_recurrence(self):
        m = MatchedUpdates()
        t = datetime(2026, 11, 4, 2, tzinfo=timezone.utc)
        for name in m.events:
            m.observe(name, 100, 200, t)
        m.observe('county', 120, 210, t + timedelta(seconds=15))
        m.observe('civicapi', 100, 200, t + timedelta(seconds=15))
        m.observe('civicapi', 120, 210, t + timedelta(seconds=30))
        self.assertEqual(m.comparisons()[0]['observed_civic_minus_county_seconds'], 15)
        self.assertEqual(m.comparisons()[0]['sampling_window_seconds'], [0, 30])
        # Correction back to a previously seen vector makes pairing ambiguous.
        m.observe('county', 100, 200, t + timedelta(seconds=45))
        m.observe('county', 120, 210, t + timedelta(seconds=60))
        self.assertEqual(m.comparisons(), [])

    def test_rejections_and_outside_window_no_http(self):
        m = MatchedUpdates()
        t = datetime(2026, 11, 4, 2, tzinfo=timezone.utc)
        for args in [('county', True, 2, t), ('other', 1, 2, t), ('county', -1, 2, t), ('county', 1, 2, t.replace(tzinfo=None))]:
            with self.assertRaises(ValueError):
                m.observe(*args)
        m.observe('county', 1, 2, t)
        with self.assertRaises(ValueError):
            m.observe('county', 2, 3, t)
        with patch('pa10_results_timeliness.fetch', side_effect=AssertionError('No network outside campaign')):
            self.assertEqual(preflight(datetime(2026, 11, 5, tzinfo=timezone.utc))['status'], 'OUTSIDE_CAMPAIGN_WINDOW')

    def test_unmatched_updates_and_new_lower_correction(self):
        m = MatchedUpdates()
        t = datetime(2026, 11, 4, 2, tzinfo=timezone.utc)
        for name in m.events:
            m.observe(name, 200, 300, t)
        m.observe('county', 210, 320, t + timedelta(seconds=15))
        self.assertEqual(m.comparisons(), [])
        # Both sources receive a new lower correction, without matching an old episode.
        m.observe('county', 190, 290, t + timedelta(seconds=30))
        m.observe('civicapi', 190, 290, t + timedelta(seconds=45))
        self.assertEqual(len(m.comparisons()), 1)


if __name__ == '__main__':
    unittest.main()
