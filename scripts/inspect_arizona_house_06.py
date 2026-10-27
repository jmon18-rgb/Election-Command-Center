"""Offline source preparation only; this does not admit observations to production."""
import datetime
import json
from pathlib import Path

COUNTIES = {'04003': 'Cochise', '04009': 'Graham', '04011': 'Greenlee',
            '04019': 'Pima', '04021': 'Pinal'}
ROSTER = [('JoAnna Mendoza', 'Democratic', 219782),
          ('Juan Ciscomani', 'Republican', 219783), ('Gary Swing', 'Green', 219784),
          ('Jereme Peters', 'Libertarian', 219785), ('Michael Dorland', 'Independent', 219786)]


def votes(candidates, native=False):
    if not isinstance(candidates, list) or len(candidates) != len(ROSTER):
        raise ValueError('Incomplete or additional candidate roster')
    found = {}
    for candidate in candidates:
        key = (candidate.get('name'), candidate.get('party'))
        if key in found or key not in {(n, p) for n, p, _ in ROSTER}:
            raise ValueError('Candidate identity drift or duplicate')
        expected = next(i for n, p, i in ROSTER if key == (n, p))
        if native and candidate.get('candidate_id') != expected:
            raise ValueError('Native candidate ID drift')
        value = candidate.get('votes')
        if type(value) is not int or value < 0:
            raise ValueError('Invalid vote count')
        found[key] = value
    return found


def inspect(payload):
    expected = {'country': 'US', 'province': 'AZ', 'district': 'AZ-06',
                'election_name': 'Arizona US House 6', 'election_scope': 'General',
                'election_type': 'House of Representatives',
                'election_date': '2026-11-03T05:00:00.000Z', 'round': 1,
                'test_data': False}
    if any(type(payload.get(k)) is not type(v) or payload[k] != v for k, v in expected.items()):
        raise ValueError('Wrong contest, year, round or test status')
    stamp = datetime.datetime.fromisoformat(payload['last_updated'].replace('Z', '+00:00'))
    if stamp.tzinfo is None:
        raise ValueError('Source clock lacks timezone')
    state = votes(payload['candidates'], native=True)
    regions = payload.get('region_results')
    if not isinstance(regions, dict) or len(regions) != 5:
        raise ValueError('Five district-part county aggregates required')
    seen, totals = set(), dict.fromkeys(state, 0)
    for row in regions.values():
        fips = row.get('fips')
        if fips in seen or fips not in COUNTIES or row.get('name') != COUNTIES[fips] or row.get('type') != 'County':
            raise ValueError('County matrix/identity drift or nested geography')
        seen.add(fips)
        for key, count in votes(row['candidates']).items():
            totals[key] += count
    if totals != state:
        raise ValueError('District/county named-candidate totals disagree')
    return {'race_code': 'AZ-06', 'county_parts': len(seen),
            'named_candidate_votes': sum(state.values()), 'source_clock': stamp.isoformat(),
            'live_delivery_verified': False, 'production_input_enabled': False}


if __name__ == '__main__':
    import sys
    print(json.dumps(inspect(json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))), indent=2))
