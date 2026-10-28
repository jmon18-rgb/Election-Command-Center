"""Public fixtures are fictional. Real saved publisher HTML is local-only."""
import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import inspect_house_presidential_reference as tool


def fixture():
    # Distinct 2020 values catch accidental use of the adjacent election block.
    years = '<tr><th id="1491069057R2">3</th>' + ''.join(
        '<td rowspan="2">' + x + '</td>' for x in ['District', 'Incumbent', 'Party'])
    years += '<td colspan="6">2024</td><td colspan="6">2020</td></tr>'
    labels = ['Harris', 'Trump', 'Total', 'Harris %', 'Trump %', 'Margin',
              'Biden', 'Trump', 'Total', 'Biden %', 'Trump %', 'Margin']
    header = '<tr><th id="1491069057R3">4</th>' + ''.join('<td>' + x + '</td>' for x in labels) + '</tr>'
    cells = ['FL-04', 'Fictional incumbent', '(R)', '6,000', '9,000', '15,200',
             '39.47%', '59.21%', '-19.74%', '17,000', '20,000', '37,500',
             '45.33%', '53.33%', '-8.00%']
    row = '<tr><th id="1491069057R94">95</th>' + ''.join('<td>' + x + '</td>' for x in cells) + '</tr>'
    return ('<html><head><title>' + tool.TITLE + '</title></head><body><svg><title>Loading...</title></svg>'
            '<table>' + years + header + row + '</table><script>"FL-04"</script></body></html>').encode()


def staging():
    return {'election_year': 2024, 'district_map_year_claimed': 2026,
            'external_source_url': 'https://example.invalid/fictional.csv', 'external_source_blob_sha': 'fictional',
            'records': [{'race_code': 'FL-04', 'state': 'FL', 'dem_pres_2024_votes': 6000,
                         'rep_pres_2024_votes': 9000, 'dem_minus_rep_two_party_points': -20}]}


class Contract(unittest.TestCase):
    def test_denominators_and_exact_district(self):
        result = tool.inspect_html(fixture())
        self.assertEqual(result['computed_two_party_margin_points'], -20)
        self.assertEqual(result['published_all_candidate_margin_points'], -19.74)
        self.assertEqual(result['other_votes'], 200)
        self.assertFalse(result['later_year_columns_used'])
        report = tool.compare(result, staging())
        self.assertTrue(report['cached_counts_equal'])
        self.assertFalse(report['runtime_admitted'])
        self.assertFalse(report['upstream_lineage_independence_established'])
        different = staging()
        different['records'][0].update(dem_pres_2024_votes=6001, rep_pres_2024_votes=9001,
                                     dem_minus_rep_two_party_points=round(-300000 / 15002, 3))
        compared = tool.compare(result, different)
        self.assertFalse(compared['cached_counts_equal'], 'Close margins cannot waive an exact-count mismatch')
        self.assertTrue(compared['two_party_margin_agreement_within_0_01_points'])
        self.assertFalse(compared['automatic_pin_replacement'])

    def test_unsafe_source_and_staging_mutations(self):
        raw = fixture()
        duplicate = raw.replace(b'</table>', raw[raw.index(b'<tr><th id="1491069057R94"'):raw.index(b'</table>')] + b'</table>')
        mutations = [
            raw.replace(b'used in the 2026 elections', b'used in the 2024 elections'),
            raw.replace(b'<td colspan="6">2024</td>', b'<td colspan="6">2020</td>'),
            raw.replace(b'<td>Harris</td>', b'<td>Biden</td>'),
            raw.replace(b'>FL-04</td>', b'>FL-05</td>'), duplicate,
            raw.replace(b'6,000', b'-6,000'), raw.replace(b'6,000', b'6,000.0'),
            raw.replace(b'15,200', b'14,999'), raw.replace(b'39.47%', b'40.47%'),
            raw.replace(b'-19.74%', b'-20.00%'),
            raw.replace(b'id="1491069057R94"', b'id="otherR94"'),
            raw.replace(b'<td>6,000</td>', b'<td colspan="2">6,000</td>'),
            raw.replace(b'</head>', b'<title>' + tool.TITLE.encode() + b'</title></head>')]
        for i, body in enumerate(mutations):
            with self.subTest(source_mutation=i), self.assertRaises((ValueError, UnicodeError)):
                tool.inspect_html(body)
        reference = tool.inspect_html(raw)
        for change in ['year', 'map', 'duplicate', 'state', 'boolean', 'margin']:
            data = copy.deepcopy(staging())
            if change == 'year': data['election_year'] = 2020
            if change == 'map': data['district_map_year_claimed'] = 2024
            if change == 'duplicate': data['records'] *= 2
            if change == 'state': data['records'][0]['state'] = 'GA'
            if change == 'boolean': data['records'][0]['dem_pres_2024_votes'] = True
            if change == 'margin': data['records'][0]['dem_minus_rep_two_party_points'] = -19.74
            with self.subTest(staging_mutation=change), self.assertRaises(ValueError):
                tool.compare(reference, data)

    def test_receipt_binding_and_local_output(self):
        body = fixture(); sha = hashlib.sha256(body).hexdigest()
        receipt = {'http': 200, 'requested_url': tool.URL, 'final_url': tool.URL,
                   'bytes': len(body), 'sha256': sha, 'requested_at': '2026-10-28T19:00:00Z',
                   'completed_at': '2026-10-28T19:00:01Z'}
        with patch.object(tool, 'SHA256', sha), patch.object(tool, 'BYTE_COUNT', len(body)):
            tool.inspect_capture(body, receipt)
            for key, value in [('http', 403), ('final_url', 'https://example.invalid/'),
                               ('sha256', 'wrong'), ('bytes', len(body) - 1),
                               ('completed_at', '2026-10-28T18:59:00Z')]:
                changed = {**receipt, key: value}
                with self.subTest(receipt_field=key), self.assertRaises(ValueError):
                    tool.inspect_capture(body, changed)
            with self.assertRaises(ValueError): tool.inspect_capture(body + b' ', receipt)
        with tempfile.TemporaryDirectory(prefix='house-reference-contract-') as temp:
            root = Path(temp).resolve(); local = root / 'artifacts/readiness/early-house-geography'
            local.mkdir(parents=True)
            with patch.object(tool, 'ROOT', root), patch.object(tool, 'LOCAL', local):
                target = local / 'fictional.json'; tool.write_local(target, {'fictional': True})
                self.assertEqual(json.loads(target.read_text()), {'fictional': True})
                with self.assertRaises(ValueError): tool.write_local(target, {})
                with self.assertRaises(ValueError): tool.write_local(root / 'public.json', {})

    def test_actual_pinned_original_when_available(self):
        source = tool.LOCAL / 'downballot-exact-totals-sheet-20261028.html'
        if not source.exists():
            self.skipTest('Local publisher original not distributed; actual-original check NOT_RUN here')
        reference = tool.inspect_capture(source.read_bytes(), json.loads(
            (tool.LOCAL / 'downballot-exact-totals-sheet-20261028-receipt.json').read_text(encoding='utf-8')))
        data = json.loads((tool.ROOT / 'data/presidential_2024_by_2026_district_staging.json').read_text(encoding='utf-8'))
        report = tool.compare(reference, data)
        self.assertFalse(report['cached_counts_equal'])
        self.assertTrue(report['two_party_margin_agreement_within_0_01_points'])
        self.assertFalse(report['runtime_admitted'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
