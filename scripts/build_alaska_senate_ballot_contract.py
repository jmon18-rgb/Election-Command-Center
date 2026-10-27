"""Original general-ballot identity audit; not a forecast or results feed."""
import gzip
import hashlib
import io
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'data/alaska_senate_sources'
HASHES = {
    'sample-ballots.html.gz': '5ea6a086215267842ed0f00e1f4483ca75047124b3748a425c6d388dcccb985f',
    '2026-general-english-ballots.html.gz': '8d60d7fdfd57240f2867fc9709b6fa1e97aae08908f642011c2fad9cd1cc1cff',
    '2026-general-candidates.html.gz': '2bca91c84a41a46e445b244e14bad1a349487bc5a4a24f8d99a9df7fc00b4d02',
    '2026-general-HD1-JD1.pdf': '188710841f5b8d7c15cebbd6d2371ce9325465965891f5493b5bbf7726d4fa84',
    '2026-current-civic-full.json.gz': 'd6bf36fffd9dee482ebdb4f4e8dd5189e89819b3bb4e4ec7e0f679f331857253'}
# Explicit names/IDs were observed in the exact approved source, not inferred
# from party affiliation or from the two candidates' shared surname.
PEOPLE = [
    (219758, 'Gerald L. Heikes', 'Heikes, Gerald L.', 'Registered Republican', 'Republican', False, False),
    (219759, 'Mary Peltola', 'Peltola, Mary', 'Registered Democrat', 'Democratic', False, False),
    (219760, 'Dan Sullivan', 'Sullivan, Dan S.', 'Registered Republican', 'Republican', False, True),
    (219761, 'Daniel J. Jr. Sullivan', 'Sullivan, Daniel J. Jr.', 'Undeclared', 'Undeclared', False, False),
    (219762, 'Heather McElwain', 'McElwain, Heather', 'Registered Libertarian', 'Libertarian', True, False),
    (219763, 'Sidney “Sid” Hill', 'Hill, Sidney “Sid”', 'Undeclared', 'Undeclared', True, False)]


class Rows(HTMLParser):
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
        if tag == 'tr' and self.row is not None: self.rows.append(self.row); self.row = None


def verify_official(html, pdf):
    source = html.decode('utf-8')
    section = re.search(r'<section class="candidates-table">\s*<h4><a id="us-senate"></a>UNITED STATES SENATOR</h4>(.*?)</section>', source, re.S)
    if not section or '2026 General Election' not in source: raise ValueError('Wrong official general Senate roster')
    parser = Rows(); parser.feed(section[1])
    actual = [r[0] for r in parser.rows if r and 'Candidate Name on Ballot' not in r[0]]
    expected = [(('Certified Write-In ' if wi else '') + official + ' (' + affiliation + ') (Certified)' + (' Incumbent' if incumbent else ''))
                for _, _, official, affiliation, _, wi, incumbent in PEOPLE]
    if sorted(actual) != sorted(expected): raise ValueError('Official certified/printed/write-in identity changed')
    text = re.sub(r'\s+', ' ', PdfReader(io.BytesIO(pdf)).pages[0].extract_text().replace('\ufffd', ' '))
    if 'November 3, 2026 General Election' not in text: raise ValueError('Wrong official ballot date')
    block = text.split('United States Senator', 1)[1].split('United States Representative', 1)[0]
    for _, _, official, _, _, wi, _ in PEOPLE:
        if (official in block) == wi: raise ValueError('Printed candidate/write-in slot contract changed')
    if block.count('Write-in:') != 1 or not all(str(n) + suffix in block for n, suffix in [(1, 'st'), (2, 'nd'), (3, 'rd'), (4, 'th'), (5, 'th')]):
        raise ValueError('Five-column ranked-choice/generic-write-in ballot contract changed')


def build():
    data = {}
    for name, digest in HASHES.items():
        raw = (FOLDER / name).read_bytes(); raw = gzip.decompress(raw) if name.endswith('.gz') else raw
        if hashlib.sha256(raw).hexdigest() != digest: raise ValueError('Pinned original bytes changed: ' + name)
        data[name] = raw
    verify_official(data['2026-general-candidates.html.gz'], data['2026-general-HD1-JD1.pdf'])
    if b'/sample-ballots/ballot/zk4o0' not in data['sample-ballots.html.gz'] or b'/election/2026/General/SampleBallots/HD1-JD1.pdf' not in data['2026-general-english-ballots.html.gz']:
        raise ValueError('Original declared ballot-link chain changed')
    actual = json.loads(data['2026-current-civic-full.json.gz'])
    if actual['province'] != 'AK' or actual['election_name'] != 'Alaska US Senate' or actual['round'] != 1 or actual['test_data'] is not False:
        raise ValueError('Wrong observed provider scope')
    native = {r['candidate_id']: r for r in actual['candidates']}
    if len(native) != 6 or any(native.get(i, {}).get('name') != name for i, name, *_ in PEOPLE):
        raise ValueError('Native source identity drift')
    people = [{'source_candidate_id': i, 'source_name': name, 'official_name': official,
               'official_registered_affiliation': affiliation, 'expected_source_party': party,
               'certified_write_in': wi, 'printed_on_sample_ballot': not wi, 'incumbent': incumbent}
              for i, name, official, affiliation, party, wi, incumbent in PEOPLE]
    mismatches = [{'id': p['source_candidate_id'], 'source_name': p['source_name'],
                   'observed_source_party': native[p['source_candidate_id']]['party'], 'expected_party': p['expected_source_party']}
                  for p in people if native[p['source_candidate_id']]['party'] != p['expected_source_party']]
    if mismatches != [{'id': 219761, 'source_name': 'Daniel J. Jr. Sullivan', 'observed_source_party': 'Republican', 'expected_party': 'Undeclared'}]:
        raise ValueError('Saved party discrepancy changed; review actual evidence')
    output = {'status': 'VERIFIED_OFFICIAL_BALLOT_SOURCE_PARTY_CONFLICT_NOT_PREDICTIVE_ACTIVATION',
              'race_code': 'AK-SEN', 'election_date': '2026-11-03', 'source_url': 'https://civicapi.org/api/v2/race/86916',
              'official_roster_url': 'https://www.elections.alaska.gov/candidates/?election=26GENR',
              'official_ballot_url': 'https://www.elections.alaska.gov/election/2026/General/SampleBallots/HD1-JD1.pdf',
              'official_roster_sha256': HASHES['2026-general-candidates.html.gz'],
              'official_ballot_sha256': HASHES['2026-general-HD1-JD1.pdf'], 'ballot_page_visually_verified': 1,
              'rank_columns': 5, 'generic_write_in_slot': True, 'people': people,
              'observed_at': '2026-10-27T06:39:44.273Z', 'observed_source_stamp': actual['last_updated'],
              'observed_source_sha256': HASHES['2026-current-civic-full.json.gz'], 'party_conflicts': mismatches,
              'national_input_enabled': False, 'final_rcv_contract_verified': False,
              'limitations': ['Observed source is stale zero and only one State row; no regional/precinct remaining-vote evidence.',
                             'Four printed candidates plus two separately certified named write-ins are not six printed nominees.',
                             'Never sum same-party candidates or treat first choices/provider flags as final RCV outcomes.',
                             'No actual positive delivery, prediction, calibration or comparative-speed claim.']}
    (ROOT / 'data/alaska_senate_ballot_contract.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    return output


if __name__ == '__main__':
    build(); print('AK Senate original ballot/roster verified; known source-party conflict, State-only and RCV limits remain')
