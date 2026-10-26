"""Capture-only independent-source discovery and matched D/R update accounting.

No output from this module is forecast evidence. Receipt differences include
sampling, transport and caching; they are not publisher-origin latency.
"""
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, parse_qs, urlencode
import hashlib
import json
import re
import urllib.request
import argparse
import os
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from build_pennsylvania_house_county_baseline import CountySample

ROOT_URL = 'https://elections.dauphincounty.gov/'
START = datetime(2026, 10, 26, tzinfo=timezone.utc)
END = datetime(2026, 11, 4, 17, tzinfo=timezone.utc)
CLOSE = datetime(2026, 11, 4, 1, tzinfo=timezone.utc)
PROVIDER_URL = 'https://civicapi.org/api/v2/race/87385'


def parse_current_county(raw, now):
    parser = CountySample()
    parser.feed(raw.decode('utf-8-sig'))
    heading = ' '.join(' '.join(parser.headings).split())
    if heading not in ('2026 General Election Results', '2026 Congressional General Election Results') or parser.table_count != 1:
        raise ValueError('Wrong current county election/table')
    text = ' '.join(' '.join(parser.parts).split())
    if not text.startswith('REPRESENTATIVE IN CONGRESS ') or re.search(r'\b(TEST|MOCK|DEMO)\b', text, re.I):
        raise ValueError('Wrong office or test county returns')
    rows = re.findall(r'(DEM|REP|NONPARTISAN)\s*\.\s*(.*?)\s+([\d,]+)(?:\s|$)', text)
    party_spans = re.findall(r'<span\b[^>]*class=["\'][^"\']*\bparty\b[^"\']*["\'][^>]*>(.*?)</span>', raw.decode('utf-8-sig'), re.I | re.S)
    if len(party_spans) != len(rows) or any(p.strip() not in ('DEM', 'REP', 'NONPARTISAN') for p in party_spans):
        raise ValueError('Unrecognized or incomplete county candidate rows')
    votes = {(p, n): int(v.replace(',', '')) for p, n, v in rows}
    required = {('DEM', 'JANELLE STELSON'), ('REP', 'SCOTT PERRY')}
    if len(rows) != len(votes) or not required <= set(votes) or set(votes) - required - {('NONPARTISAN', 'WRITE-IN')}:
        raise ValueError('Unexpected county candidate roster')
    totals = re.findall(r'TOTAL:\s*([\d,]+)', text)
    if len(totals) != 1 or int(totals[0].replace(',', '')) != sum(votes.values()):
        raise ValueError('County total mismatch')
    # Public page clock has no UTC designation. Explicit Pennsylvania election
    # night UTC-05 profile; no inferred publisher clock before/after this scope.
    stamps = re.findall(r'\b(11/[34]/2026 \d{1,2}:\d{2}:\d{2} [AP]M)\b', raw.decode('utf-8-sig'))
    stamps = set(stamps)
    if len(stamps) != 1:
        raise ValueError('Missing/ambiguous current local county clock')
    from datetime import timedelta
    stamp = datetime.strptime(stamps.pop(), '%m/%d/%Y %I:%M:%S %p').replace(tzinfo=timezone(timedelta(hours=-5))).astimezone(timezone.utc)
    if not CLOSE <= stamp <= now or (now - stamp).total_seconds() > 10800:
        raise ValueError('Pre-close/future/stale county clock')
    d, r = votes[('DEM', 'JANELLE STELSON')], votes[('REP', 'SCOTT PERRY')]
    if d + r == 0:
        raise ValueError('No positive county D/R counts')
    return {'dem': d, 'rep': r, 'publisher_clock_profile': 'Pennsylvania Nov3/4 UTC-05; page itself does not declare UTC'}


class Menu(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.current = None

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            if self.current is not None:
                raise ValueError('Nested election link')
            self.current = [dict(attrs).get('href', ''), []]

    def handle_data(self, data):
        if self.current is not None:
            self.current[1].append(data)

    def handle_endtag(self, tag):
        if tag == 'a' and self.current is not None:
            self.links.append((self.current[0], ' '.join(' '.join(self.current[1]).split())))
            self.current = None


def discover_general(raw):
    """Only an explicitly published current general-election menu link qualifies."""
    parser = Menu()
    parser.feed(raw.decode('utf-8-sig'))
    found = set()
    for href, label in parser.links:
        if not re.fullmatch(r'2026(?: Congressional)? General Election Results', label, re.I):
            continue
        url = urlsplit(urljoin(ROOT_URL, href))
        if (url.scheme != 'https' or url.netloc != 'elections.dauphincounty.gov'
                or url.path != '/' or url.fragment):
            raise ValueError('Published election link leaves verified origin')
        query = parse_qs(url.query, keep_blank_values=True)
        if set(query) != {'key'} or len(query['key']) != 1 or not re.fullmatch(r'[1-9]\d{0,5}', query['key'][0]):
            raise ValueError('Ambiguous election key')
        found.add(query['key'][0])
    if len(found) > 1:
        raise ValueError('Conflicting current general-election links')
    if not found:
        return None
    return ROOT_URL + '?' + urlencode({'key': found.pop(), 'race': 'REPRESENTATIVE IN CONGRESS'})


class MatchedUpdates:
    """In-memory single-session accounting of already validated county snapshots.

    Callers must validate election, county, candidate identity, non-test status
    and post-close freshness BEFORE observation. Arbitrary counts are not live
    evidence. Initial stock, repeated totals and recurrent corrected vectors
    cannot establish update timing. No state persists across capture gaps.
    """
    def __init__(self):
        self.events = {'county': [], 'civicapi': []}
        self.last_receipt = {}

    def observe(self, source, dem, rep, receipt):
        if source not in self.events or any(type(n) is not int or n < 0 for n in (dem, rep)) or dem + rep == 0:
            raise ValueError('Invalid source/counts')
        if not isinstance(receipt, datetime) or receipt.utcoffset() is None:
            raise ValueError('Receipt must be timezone-aware')
        receipt = receipt.astimezone(timezone.utc)
        if source in self.last_receipt and receipt <= self.last_receipt[source]:
            raise ValueError('Duplicate or reversed receipt clock')
        self.last_receipt[source] = receipt
        events = self.events[source]
        vector = (dem, rep)
        if events and events[-1]['vector'] == vector:
            events[-1]['last_seen'] = receipt
            return
        events.append({'vector': vector, 'first_seen': receipt, 'last_seen': receipt,
                       'previous_seen': events[-1]['last_seen'] if events else None})

    def comparisons(self):
        result = []
        for county in self.events['county']:
            vector = county['vector']
            a = [e for e in self.events['county'] if e['vector'] == vector]
            b = [e for e in self.events['civicapi'] if e['vector'] == vector]
            if len(a) != 1 or len(b) != 1 or county['previous_seen'] is None or b[0]['previous_seen'] is None:
                continue
            civic = b[0]
            result.append({'dem': vector[0], 'rep': vector[1],
                           'observed_civic_minus_county_seconds': (civic['first_seen'] - county['first_seen']).total_seconds(),
                           'sampling_window_seconds': [
                               (civic['previous_seen'] - county['first_seen']).total_seconds(),
                               (civic['first_seen'] - county['previous_seen']).total_seconds()],
                           'interpretation': 'Matched served D/R update; includes sampling/cache/transport, not origin publication latency'})
        return result


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Unexpected county redirect; review published origin')


def fetch(url):
    request = urllib.request.Request(url, headers={
        'User-Agent': 'Election-Command-Center readiness (github.com/jmon18-rgb/Election-Command-Center)'})
    started = datetime.now(timezone.utc)
    with urllib.request.build_opener(NoRedirect).open(request, timeout=12) as response:
        raw = response.read(2_000_001)
        if len(raw) > 2_000_000:
            raise ValueError('Oversize source response')
        receipt = datetime.now(timezone.utc)
        metadata = {'source_url': url, 'http_status': response.status,
                    'requested_at': started.isoformat(), 'received_at': receipt.isoformat(),
                    'body_sha256': hashlib.sha256(raw).hexdigest(),
                    'cache': {key: response.headers.get(key) for key in ('Age', 'Cache-Control', 'Date', 'ETag')}}
    return raw, receipt, metadata


def preflight(now=None):
    now = now or datetime.now(timezone.utc)
    report = {'captured_at': now.isoformat(), 'fixture_free': True, 'virtual_clock': False,
              'comparative_lag': 'UNPROVEN', 'source_url': ROOT_URL,
              'limitation': 'Discovery only; no live vote capture, no comparative timing acceptance'}
    if not START <= now < END:
        return dict(report, status='OUTSIDE_CAMPAIGN_WINDOW')
    raw, _, metadata = fetch(ROOT_URL)
    report.update(metadata)
    url = discover_general(raw)
    return dict(report, status='GENERAL_LINK_DISCOVERED_REQUIRES_SCOPE_VALIDATION' if url else 'INDEPENDENT_GENERAL_NOT_PUBLISHED', discovered_url=url)


def watch(output):
    """At most 56 pairs/14 minutes, 15s spacing, two concurrent ordinary GETs.

    A source error ends the session rather than inventing continuous timing
    bounds across outages. A subsequent scheduled run starts a new session.
    """
    report = preflight()
    report['observations'] = []
    report['matched_updates'] = []
    if not CLOSE <= datetime.now(timezone.utc) < END or not report.get('discovered_url'):
        return report
    matched = MatchedUpdates()
    deadline = time.monotonic() + 840
    node = os.environ.get('PA10_NODE_BINARY', 'node')
    folder = output.parent / 'validated'
    with ThreadPoolExecutor(max_workers=2) as executor:
        for round_number in range(56):
            # Leave room for the12s parallel fetch and10s parser subprocess.
            if time.monotonic() + 22 >= deadline or datetime.now(timezone.utc) >= END:
                break
            started = time.monotonic()
            futures = {source: executor.submit(fetch, url) for source, url in
                       [('county', report['discovered_url']), ('civicapi', PROVIDER_URL)]}
            failed = False
            for source, future in futures.items():
                try:
                    raw, receipt, metadata = future.result()
                    if not CLOSE <= receipt < END:
                        raise ValueError('Receipt outside authorized post-close window')
                    if source == 'county':
                        counts = parse_current_county(raw, receipt)
                    else:
                        parsed = subprocess.run([node, str(Path(__file__).with_name('pa10_timing_provider.cjs'))],
                                                input=raw, capture_output=True, timeout=10, check=True)
                        counts = json.loads(parsed.stdout)
                    matched.observe(source, counts['dem'], counts['rep'], receipt)
                    folder.mkdir(parents=True, exist_ok=True)
                    archive = folder / (source + '-' + metadata['body_sha256'] + ('.html' if source == 'county' else '.json'))
                    archive.write_bytes(raw)
                    report['observations'].append(dict(metadata, source=source, counts=counts, validated=True))
                except Exception as exc:
                    report['observations'].append({'source': source, 'validated': False, 'error_type': type(exc).__name__})
                    failed = True
            report['matched_updates'] = matched.comparisons()
            report['comparative_lag'] = 'MATCHED_SERVED_UPDATES_ONLY_NOT_PUBLICATION_PARITY' if report['matched_updates'] else 'UNPROVEN'
            report['status'] = 'CAPTURE_STOPPED_SOURCE_REJECTED' if failed else 'CAPTURE_SESSION'
            output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
            if failed:
                break
            delay = 15 - (time.monotonic() - started)
            if delay > 0 and round_number < 55:
                time.sleep(delay)
    report['limitation'] = 'Single Dauphin D/R scope; initial/recurrent/unmatched totals excluded; sampling/cache/transport windows, not AP/NYT latency or national calibration'
    return report


if __name__ == '__main__':
    # There is intentionally no clock override, guessed election key or raw
    # primary/test archive in the production command.
    output = Path('artifacts/readiness/pa10-independent-timing/preflight.json')
    output.parent.mkdir(parents=True, exist_ok=True)
    args = argparse.ArgumentParser()
    args.add_argument('--watch', action='store_true')
    options = args.parse_args()
    try:
        report = watch(output) if options.watch else preflight()
    except Exception as exc:
        report = {'status': 'DISCOVERY_FAILED', 'comparative_lag': 'UNPROVEN', 'error_type': type(exc).__name__}
        output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
        raise
    output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report))
