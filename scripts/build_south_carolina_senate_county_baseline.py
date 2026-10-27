"""Pinned official historical preparation only; never current returns or chronology."""
import csv
import gzip
import hashlib
import io
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_HASH = '58df7eaff97162cf27be2bb4d526b363888c09e0f662231a3ca09cff9c9f3f99'
PAGE_HASH = 'aaa85e7526d404d0291f31e614a8bf123eb130772bb2562c702a2e7b57c414a9'
CENSUS_HASH = '3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0'
PAGE = 'https://electionhistory.scvotes.gov/contest/1975'
DOWNLOAD = 'https://sc.elstats.civera.com/api/download_contest/1975_table.csv?split_party=false'
HEADER = ['', '', 'Lindsey Graham', 'Jaime Harrison', 'Bill Bledsoe', 'Write-In',
          'Total Votes Cast', 'Overvotes/Undervotes', 'Total Ballots Cast']
TOTALS = [1369137, 1110828, 32845, 2294, 2515104, 17725, 2532829]


def parse_rows(rows, reference):
    if (len(rows) != 2448 or rows[0] != HEADER or
            rows[1] != ['', '', 'Republican', 'Democratic', 'Conservative', '', '', '', ''] or
            rows[2][:2] != ['State', 'South Carolina'] or len(reference) != 46):
        raise ValueError('Historical contest/candidate/row scope changed')

    def counts(row):
        if len(row) != 9 or any(not value.isdecimal() for value in row[2:]):
            raise ValueError('Invalid historical integer votes')
        values = list(map(int, row[2:]))
        if sum(values[:4]) != values[4] or sum(values[4:6]) != values[6]:
            raise ValueError('Historical candidate/contest/ballot mismatch')
        return values

    if counts(rows[2]) != TOTALS:
        raise ValueError('Statewide source totals changed')
    county_counts, precinct_sums, active, precincts = {}, {}, None, 0
    for row in rows[3:]:
        values = counts(row)
        if row[0] == 'County':
            name = row[1]
            if name not in reference or name in county_counts:
                raise ValueError('Unknown or duplicate independent county identity')
            active = name
            county_counts[name], precinct_sums[name] = values, [0] * 7
        elif row[0] == 'Precinct' and active is not None:
            precincts += 1
            precinct_sums[active] = [a + b for a, b in zip(precinct_sums[active], values)]
        else:
            raise ValueError('Unexpected historical row scope')
    if (set(county_counts) != set(reference) or precincts != 2399 or
            any(precinct_sums[n] != values for n, values in county_counts.items()) or
            [sum(v[i] for v in county_counts.values()) for i in range(7)] != TOTALS):
        raise ValueError('County/precinct/state totals do not reconcile')
    return [{'county': name, 'fips': reference[name], 'dem_votes': v[1],
             'rep_votes': v[0], 'other_votes': v[2] + v[3],
             'conservative_votes': v[2], 'write_in_votes': v[3],
             'contest_votes': v[4], 'over_under_votes': v[5], 'ballots_cast': v[6]}
            for name, v in county_counts.items()]


def build():
    body = gzip.decompress((ROOT / 'data/south_carolina_historical_sources/2020-official-senate-table.csv.gz').read_bytes())
    page = gzip.decompress((ROOT / 'data/south_carolina_historical_sources/2020-official-senate-contest.html.gz').read_bytes())
    census = (ROOT / 'data/texas_historical_sources/2024-census-counties.zip').read_bytes()
    if (hashlib.sha256(body).hexdigest() != SOURCE_HASH or hashlib.sha256(census).hexdigest() != CENSUS_HASH or
            hashlib.sha256(page).hexdigest() != PAGE_HASH or DOWNLOAD.encode() not in page or
            b'2020-11-03T00:00:00Z' not in page or b'U.S. Senate' not in page):
        raise ValueError('Pinned original integrity failure')
    with zipfile.ZipFile(io.BytesIO(census)) as archive:
        text = archive.read('2024_Gaz_counties_national.txt').decode('utf-8-sig')
    reference = {r['NAME'].removesuffix(' County'): r['GEOID']
                 for r in csv.DictReader(io.StringIO(text), delimiter='\t') if r['USPS'] == 'SC'}
    if len(set(reference.values())) != 46 or any(not f.startswith('45') or len(f) != 5 for f in reference.values()):
        raise ValueError('Independent Census identity failure')
    counties = parse_rows(list(csv.reader(io.StringIO(body.decode('utf-8-sig')))), reference)
    return {'schema': 'official-south-carolina-senate-county-baseline-v1', 'year': 2020,
            'state': 'SC', 'office': 'US Senate', 'source_page': PAGE, 'declared_download': DOWNLOAD,
            'original_sha256': SOURCE_HASH, 'source_page_sha256': PAGE_HASH, 'independent_census_sha256': CENSUS_HASH,
            'status': 'HISTORICAL_PREPARATION_NOT_CURRENT_SOURCE_ADMISSION',
            'precinct_rows_reconciled': 2399, 'counties': counties,
            'statewide': dict(zip(['rep_votes', 'dem_votes', 'conservative_votes', 'write_in_votes',
                                  'contest_votes', 'over_under_votes', 'ballots_cast'], TOTALS)),
            'limits': ['Final historical totals, not chronological captures or calibration',
                       'Whole-county history; current2026 candidate/geography/count-clock contract still required',
                       'No current vote feed, national-input cap expansion or call admission']}


if __name__ == '__main__':
    output = build()
    (ROOT / 'data/south_carolina_senate_2020_county_baseline_official.json').write_text(
        json.dumps(output, indent=2) + '\n', encoding='utf-8')
    print('SC historical2020:46 matched counties/2399 precincts/state totals reconcile; NOT runtime admission')
