"""MI07 processed precinct reference with independent official sample and roster.

Final totals are not chronological calibration or official outstanding ballots.
"""
import csv
import gzip
import hashlib
import io
import json
import re
import zipfile
from html.parser import HTMLParser
from pathlib import Path
from pypdf import PdfReader
from build_michigan_house_county_baseline import RAW_HASH, BLOB, CENSUS_HASH, URL

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'data/michigan_house_07_sources'
COUNTIES = {'Clinton', 'Eaton', 'Genesee', 'Ingham', 'Livingston', 'Oakland', 'Shiawassee'}
ALIASES = {'Curtis Hertel': ('D', {'DEM', 'Democrat'}),
           'Tom Barrett': ('R', {'REP', 'Republican'}),
           'L. Rachel Dailey': ('O', {'LIB', 'Libertarian'})}
METADATA = {'Ballots Cast', 'Over Vote Count', 'Over Votes', 'Under Vote Count', 'Under Votes',
            'Rejected write-in votes:', 'Rejected write-ins', 'Unresolved write-in votes:',
            'Unassigned write-ins', 'Write-in', 'Write-ins'}
PDF_HASH = 'd89815319b9430aea31b26b38fc75cea5208067321d60684a75fb2df7078bd08'
HTML_HASH = 'e3551674a96aebc1d295336d857a9b626ab38177823ed5357214a40b038b1938'
PDF_URL = 'https://docs.ingham.org/Department/County%20Clerk/Elections/Election%20Results/OfficialInghamNovember2024ElectionSummaryReportRPT.pdf'
ROSTER_URL = 'https://mi-boe.entellitrak.com/etk-mi-boe-prod/page.request.do?electionType=GEN&electionYear=2026&page=page.miboePublicReport'


class TableRows(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows = []; self.row = None; self.cell = None
    def handle_starttag(self, tag, attrs):
        if tag == 'tr': self.row = []
        if tag in ('td', 'th') and self.row is not None: self.cell = []
    def handle_data(self, data):
        if self.cell is not None: self.cell.append(data)
    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None:
            self.row.append(' '.join(' '.join(self.cell).split())); self.cell = None
        if tag == 'tr' and self.row is not None:
            self.rows.append(self.row); self.row = None


def verify_roster(raw):
    parser = TableRows(); parser.feed(raw.decode('utf-8'))
    title = '7th District Representative in Congress 2 Year Term (1) Position'
    starts = [i for i, row in enumerate(parser.rows) if title in row]
    if len(starts) != 1 or b'General Election' not in raw or b'Tuesday, November 3, 2026' not in raw:
        raise ValueError('Wrong official general roster/district')
    rows = []
    for row in parser.rows[starts[0] + 1:]:
        if any(re.match(r'\d+\w* District Representative in Congress', cell) for cell in row): break
        if any(cell.endswith(' Party') for cell in row):
            if len(row) != 8: raise ValueError('Official candidate table schema changed')
            rows.append((row[1], row[3], row[4]))
    expected = [('', 'Democratic Party', 'Lawrence, William'),
                ('', 'Republican Party', 'Barrett, Tom'), ('', 'Green Party', 'Dedrick, Shane'),
                ('DISQ', 'Working Class Party', 'Thibodeau, Felix')]
    if rows != expected: raise ValueError('Active/disqualified official candidate contract changed')
    return rows


def aggregate(rows, census):
    totals = {c: {'D': 0, 'R': 0, 'O': 0, 'writeins': 0, 'unresolved': 0, 'rejected': 0}
              for c in COUNTIES}
    seen = set(); matrix = {}; selected = 0
    for r in rows:
        if r['office'] != 'U.S. House' or r['district'] != '7': continue
        selected += 1; county, name = r['county'], r['candidate']
        if county not in COUNTIES or county not in census or not r['precinct'] or not r['votes'].isdigit():
            raise ValueError('Wrong district part, precinct or count')
        key = (county, ' '.join(r['precinct'].split()), name)
        if key in seen: raise ValueError('Duplicate normalized precinct row')
        seen.add(key); votes = int(r['votes'])
        if name in METADATA:
            if r['party']: raise ValueError('Metadata/write-in party changed')
            # The original Ingham canvass explicitly calls these unresolved.
            # The processed file's generic label must not erase that status.
            if county == 'Ingham' and name == 'Write-ins': totals[county]['unresolved'] += votes
            elif name in {'Write-in', 'Write-ins', 'Unassigned write-ins'}: totals[county]['writeins'] += votes
            elif name == 'Unresolved write-in votes:': totals[county]['unresolved'] += votes
            elif name.startswith('Rejected'): totals[county]['rejected'] += votes
            continue
        if name not in ALIASES or r['party'] not in ALIASES[name][1]:
            raise ValueError('Unknown historical candidate/party')
        party = ALIASES[name][0]; totals[county][party] += votes
        matrix.setdefault(key[:2], set()).add(party)
    if not matrix or any(v != {'D', 'R', 'O'} for v in matrix.values()) or {k[0] for k in matrix} != COUNTIES:
        raise ValueError('Incomplete three-candidate district-part precinct matrix')
    return totals, selected, len(matrix)


def checked(path, expected, compressed=False):
    raw = path.read_bytes(); raw = gzip.decompress(raw) if compressed else raw
    if hashlib.sha256(raw).hexdigest() != expected: raise ValueError('Pinned source bytes changed')
    return raw


def build():
    raw = checked(ROOT / 'data/michigan_historical_sources/2024-openelections-mi-precinct.csv.gz', RAW_HASH, True)
    if hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() != BLOB:
        raise ValueError('Processed publisher Git blob changed')
    html = checked(SOURCES / '2026-official-general-candidate-list.html.gz', HTML_HASH, True)
    roster = verify_roster(html)
    pdf = checked(SOURCES / '2024-official-ingham-results.pdf.gz', PDF_HASH, True)
    text = PdfReader(io.BytesIO(pdf)).pages[1].extract_text()
    if 'Certified 11/15/2024' not in text or 'Representative in Congress for Congressional District 7' not in text:
        raise ValueError('Wrong official historical sample')
    for name, party, expected in [('Curtis Hertel', 'DEM', 90181), ('Tom Barrett', 'REP', 49827), ('L. Rachel Dailey', 'LIB', 4911)]:
        match = re.search(re.escape(name) + r' ' + party + r' ([\d,]+) ([\d,]+) ([\d,]+) ([\d,]+)', text)
        if not match or sum(int(v.replace(',', '')) for v in match.groups()[:3]) != expected or int(match[4].replace(',', '')) != expected:
            raise ValueError('Official sample method/total reconciliation failed')
    block = text.split('Curtis Hertel DEM', 1)[1].split('Representative in Congress for Congressional District 7', 1)[0]
    unresolved = re.search(r'Unresolved Write-In ([\d,]+) ([\d,]+) ([\d,]+) ([\d,]+)', block)
    if not unresolved or tuple(int(v.replace(',', '')) for v in unresolved.groups()) != (206, 16, 57, 279):
        raise ValueError('Official unresolved write-in method/status contract changed')
    census_raw = checked(ROOT / 'data/texas_historical_sources/2024-census-counties.zip', CENSUS_HASH)
    with zipfile.ZipFile(io.BytesIO(census_raw)) as z:
        census = {r['NAME'].removesuffix(' County'): r['GEOID'] for r in csv.DictReader(io.StringIO(
            z.read('2024_Gaz_counties_national.txt').decode('utf-8-sig')), delimiter='\t') if r['GEOID'].startswith('26')}
    if len(census) != 83 or not COUNTIES <= census.keys(): raise ValueError('Incomplete independent Census reference')
    totals, count, precincts = aggregate(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))), census)
    summary = {k: sum(v[k] for v in totals.values()) for k in ['D', 'R', 'O']}
    if count != 1424 or precincts != 302 or summary != {'D': 209959, 'R': 226722, 'O': 14231}:
        raise ValueError('Exact processed district history changed')
    if any(totals['Ingham'][k] != v for k, v in {'D': 90181, 'R': 49827, 'O': 4911, 'writeins': 0, 'unresolved': 279}.items()):
        raise ValueError('Independent original Ingham district-part sample disagrees')
    mit = next(r for r in json.loads((ROOT / 'data/house_history_2024_staging.json').read_text(encoding='utf-8'))['records'] if r['2024_race_code'] == 'MI-07')
    if tuple(mit['recorded_' + k + '_votes'] for k in ['dem', 'rep', 'other']) != tuple(summary.values()):
        raise ValueError('Independent MIT district totals disagree')
    geo = next(r for r in json.loads((ROOT / 'data/house_geography_bridge.json').read_text(encoding='utf-8'))['districts'] if r['race_code_2026'] == 'MI-07')
    if not geo['geography_comparable_2024'] or geo['map_relation_2024_to_2026'] != 'boundaries_unchanged_per_2026_census':
        raise ValueError('Current district geography incomparable')
    counties = [{'county': c, 'county_fips': census[c], 'dem_votes': totals[c]['D'], 'rep_votes': totals[c]['R'],
                 'named_other_votes': totals[c]['O'], 'reported_write_in_votes_status_unverified': totals[c]['writeins'],
                 'unresolved_write_in_votes': totals[c]['unresolved'], 'rejected_write_in_votes_excluded': totals[c]['rejected']}
                for c in sorted(COUNTIES, key=lambda c: census[c])]
    baseline = {'status': 'PROCESSED_DISTRICT_PART_HISTORY_WITH_ONE_OFFICIAL_SAMPLE_NOT_CALIBRATION',
                'race_code': 'MI-07', 'election_date': '2024-11-05', 'county_count': 7, 'counties': counties,
                'geography_scope': 'district_parts', 'source_url': URL, 'source_sha256': RAW_HASH,
                'publisher_git_blob': BLOB, 'selected_rows': count, 'selected_precincts': precincts,
                'district_totals': {'dem_votes': summary['D'], 'rep_votes': summary['R'], 'named_other_votes': summary['O']},
                'map_comparability': geo['map_relation_2024_to_2026'], 'official_sample_url': PDF_URL,
                'official_sample_sha256': PDF_HASH, 'official_roster_url': ROSTER_URL, 'official_roster_sha256': HTML_HASH,
                'official_roster': roster, 'limitations': ['Processed OpenElections reference, not original statewide returns.',
                'Only Ingham district part independently corroborated with original official methods/totals.',
                'Metadata/rejected write-ins excluded; unresolved write-ins kept separate from named votes.',
                'Ingham generic processed label is classified unresolved using the original official canvass; other reported write-in statuses remain unverified.',
                'Final totals are not reporting chronology, calibration or official outstanding ballots.']}
    reference = {'source_sha256': CENSUS_HASH, 'scope': 'MI-07 district parts; independent Census FIPS',
                 'counties': [{'county': c['county'], 'fips': c['county_fips']} for c in counties]}
    for suffix, value in [('2024_county_baseline_processed', baseline), ('county_fips_reference', reference)]:
        (ROOT / 'data' / ('michigan_house_07_' + suffix + '.json')).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8', newline='\n')
    return baseline


if __name__ == '__main__':
    build(); print('MI07: seven district parts/302 precincts reconcile, original Ingham sample and active/disqualified2026 roster verified; not calibration')
