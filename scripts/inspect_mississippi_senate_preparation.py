"""Offline Mississippi historical research. Never a runtime source or baseline.

The processed CSV and AP identity document stay in the ignored local research
folder. This module has no downloader and writes only on an explicit --output.
"""
import argparse
import collections
import csv
import gzip
import hashlib
import io
import json
import re
import zipfile
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / "artifacts/readiness/mississippi-source-research"
SOURCE_FILE = "20201103__ms__general__county.csv"
SOURCE_URL = "https://raw.githubusercontent.com/openelections/openelections-data-ms/master/2020/20201103__ms__general__county.csv"
SOURCE_SHA = "c6fe255353e08f6c76f72966cd7fb5e6499d28924df4541b163fa0a3dd241e5f"
SOURCE_BYTES = 142502
CENSUS_SHA = "3c337402b5c6e8d5aa26b4278ccf4edc8989f2683765b3ffbf22296cdb2df3a0"
ALIAS_FILE = "ap-spring2026-reporting-unit-identity.html.gz"
ALIAS_RECEIPT = "ap-spring2026-reporting-unit-identity-receipt.json"
ALIAS_SHA = "bbfe64e2db63fc002fe8f6b825da24fb181b90bd264d37caa9653b5a18b22740"
ALIAS_BYTES = 60643
ALIAS_URL = "https://developer.aptechlab.com/ap-elections-api/docs/Spring2026_Reporting_Unit_Updates.htm"
CANDIDATES = {
    "Mike Espy": ("Democrat", "dem_votes", 578691),
    "Cindy Hyde-Smith": ("Republican", "rep_votes", 709511),
    "Jimmy L. Edwards": ("Libertarian", "other_votes", 23152),
}
HEADER = ["county", "office", "district", "candidate", "party", "votes"]


def need(ok, reason):
    if not ok:
        raise ValueError(reason)


def bounded(path, limit):
    with Path(path).open("rb") as source:
        body = source.read(limit + 1)
    need(len(body) <= limit, "Local input size bound exceeded: " + Path(path).name)
    return body


def checked(body, sha, size=None):
    need((size is None or len(body) == size) and hashlib.sha256(body).hexdigest() == sha,
         "Pinned original changed")
    return body


def parse(text):
    """Retain exactly three published Senate candidates in all 82 counties."""
    need(isinstance(text, str) and len(text) <= SOURCE_BYTES, "CSV size/type bound")
    reader = csv.DictReader(io.StringIO(text), strict=True)
    need(reader.fieldnames == HEADER, "Exact six-field CSV header required")
    groups = collections.defaultdict(dict)
    for row in reader:
        need(None not in row and all(v is not None for v in row.values()), "CSV row field count")
        if row["office"] != "U.S. Senate":
            continue
        county, name = row["county"], row["candidate"]
        need(bool(county) and len(county) <= 60 and county == county.strip(), "Invalid county label")
        need(row["district"] == "", "Senate district must be blank")
        need(name in CANDIDATES, "Unreviewed Senate candidate")
        need(row["party"] == CANDIDATES[name][0], "Candidate party mismatch")
        need(name not in groups[county], "Duplicate county/candidate")
        need(re.fullmatch(r"0|[1-9][0-9]{0,8}", row["votes"]) is not None,
             "Invalid nonnegative integer vote count")
        groups[county][name] = int(row["votes"])
        need(len(groups) <= 82, "Too many publisher counties")
    need(len(groups) == 82, "Exactly 82 publisher counties required")
    need(all(set(v) == set(CANDIDATES) for v in groups.values()),
         "Complete three-candidate roster in every county required")
    for name, (_, _, total) in CANDIDATES.items():
        need(sum(v[name] for v in groups.values()) == total,
             "Pinned statewide candidate reconciliation failed")
    return dict(groups)


class IdentityTable(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows, self.row, self.cell = [], [], None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = []
        if tag in {"td", "th"}:
            self.cell = []

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in {"td", "th"} and self.cell is not None:
            self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        if tag == "tr" and self.row:
            self.rows.append(self.row)


def alias_reference(reference, rows):
    expected = ["MS", "28065", "25033", "Jeff Davis", "Jefferson Davis"]
    matches = [r for r in rows if len(r) == 5 and r[0] == "MS"
               and ("Jeff Davis" in r or "Jefferson Davis" in r)]
    need(matches == [expected] and reference.get("Jefferson Davis") == "28065",
         "Exact independent state/name/FIPS alias evidence required")
    return {"publisher_label": "Jeff Davis", "census_label": "Jefferson Davis", "fips": "28065",
            "document_row": expected, "evidence_sha256": ALIAS_SHA, "source_url": ALIAS_URL,
            "scope": "Single historical label bridge; AP reporting unit is not a native 2026 runtime ID."}


def join_geography(groups, reference, alias):
    need(len(reference) == 82 and len(set(reference.values())) == 82
         and all(re.fullmatch(r"28\d{3}", f) for f in reference.values()),
         "Independent 82-county identity set required")
    need(sorted(set(groups) - set(reference)) == ["Jeff Davis"]
         and sorted(set(reference) - set(groups)) == ["Jefferson Davis"],
         "Changed county labels require explicit review")
    need(alias.get("publisher_label") == "Jeff Davis" and alias.get("census_label") == "Jefferson Davis"
         and alias.get("fips") == reference["Jefferson Davis"], "Alias/reference disagreement")
    joined = {county: reference.get(county) if county != "Jeff Davis" else alias["fips"] for county in groups}
    need(set(joined.values()) == set(reference.values()) and len(set(joined.values())) == 82,
         "Complete one-to-one county identity required")
    return joined


def census_reference(root=ROOT):
    raw = checked(bounded(root / "data/texas_historical_sources/2024-census-counties.zip", 200000), CENSUS_SHA)
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        text = archive.read("2024_Gaz_counties_national.txt").decode("utf-8-sig")
    rows = [r for r in csv.DictReader(io.StringIO(text), delimiter="\t") if r["USPS"] == "MS"]
    need(len(rows) == 82, "Independent Census county count changed")
    return {r["NAME"].removesuffix(" County"): r["GEOID"] for r in rows}


def alias_document(source_dir):
    compressed = bounded(source_dir / ALIAS_FILE, 100000)
    with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as source:
        raw = source.read(ALIAS_BYTES + 1)
    checked(raw, ALIAS_SHA, ALIAS_BYTES)
    receipt = json.loads(bounded(source_dir / ALIAS_RECEIPT, 16000).decode("utf-8-sig"))
    need(isinstance(receipt, dict) and receipt.get("requested_url") == ALIAS_URL and receipt.get("final_url") == ALIAS_URL
         and receipt.get("http_status") == 200 and receipt.get("sha256") == ALIAS_SHA
         and receipt.get("original_bytes") == ALIAS_BYTES, "Identity-document HTTP receipt disagreement")
    need(all(isinstance(receipt.get(k), str) for k in ["capture_started_at", "capture_completed_at"]),
         "Identity-document capture clocks unavailable")
    clocks = [datetime.fromisoformat(receipt.get(k, "").replace("Z", "+00:00"))
              for k in ["capture_started_at", "capture_completed_at"]]
    need(all(t.tzinfo is not None for t in clocks) and clocks[0] <= clocks[1],
         "Identity-document capture clocks unavailable/reversed")
    table = IdentityTable()
    table.feed(raw.decode("utf-8-sig"))
    return table.rows, receipt


def reconcile_statewide(groups, root=ROOT):
    reference = json.loads(bounded(root / "data/senate_history_2020_2022_2024.json", 200000).decode("utf-8-sig"))
    contests = [r for r in reference["contest_records"] if r["state"] == "MS"
                and r["election_year"] == 2020 and r["election_type"] == "regular"]
    need(len(contests) == 1, "Missing/ambiguous independent statewide reference")
    totals = {axis: sum(v[name] for v in groups.values()) for name, (_, axis, _) in CANDIDATES.items()}
    keys = ["recorded_dem_votes", "recorded_rep_votes", "recorded_other_votes"]
    expected = [contests[0][k] for k in keys]
    need(all(type(n) is int and n >= 0 for n in expected)
         and expected == [totals[k] for k in ["dem_votes", "rep_votes", "other_votes"]]
         and contests[0]["recorded_total_candidate_votes"] == sum(expected),
         "Cached independent statewide totals disagree")
    return totals


def review(source_dir=LOCAL, root=ROOT):
    source_dir = Path(source_dir)
    raw = checked(bounded(source_dir / SOURCE_FILE, SOURCE_BYTES), SOURCE_SHA, SOURCE_BYTES)
    groups = parse(raw.decode("utf-8-sig"))
    reference = census_reference(root)
    rows, receipt = alias_document(source_dir)
    alias = alias_reference(reference, rows)
    joined = join_geography(groups, reference, alias)
    totals = reconcile_statewide(groups, root)
    counties = [{"publisher_county": county, "independent_fips": joined[county],
                 **{axis: votes[name] for name, (_, axis, _) in CANDIDATES.items()},
                 "published_candidate_votes": sum(votes.values())} for county, votes in sorted(groups.items())]
    return {"schema": "ms-2020-independent-county-research-v2", "status": "RESEARCH_ONLY_NOT_RUNTIME_ADMISSION",
            "source_url": SOURCE_URL, "publisher": "OpenElections converted historical county table",
            "source_sha256": SOURCE_SHA, "independent_census_sha256": CENSUS_SHA,
            "source_date": "2020-11-03", "office": "U.S. Senate", "counties": counties,
            "county_count": 82, "candidate_rows": 246, "candidate_totals": totals,
            "other_votes_scope": "Published Libertarian candidate only; write-ins not independently reviewed",
            "exact_independent_geography_matches": 81, "explicit_independent_aliases": [alias],
            "resolved_independent_geography_matches": 82, "identity_document_capture_at": receipt["capture_completed_at"],
            "runtime_eligible": False, "current_2026_source_admitted": False, "chronological_calibration": False,
            "reuse_rights_established": False, "native_official_certification_reviewed": False, "source_requests": 0,
            "next_required_evidence": ["Source-specific reuse/provenance review", "Native official certification comparison",
                                       "Separate current 2026 identity/status/clock/correction contract"],
            "scope": "Local research only. No runtime write, fabricated chronology, transfer scenario or predictive accuracy claim."}


def write_local_report(report, destination, root=ROOT):
    target = Path(destination).resolve()
    allowed = (root / "artifacts/readiness").resolve()
    need(target.is_relative_to(allowed) and target.suffix.lower() == ".json",
         "Derived research output must stay in ignored artifacts/readiness as JSON")
    target.parent.mkdir(parents=True, exist_ok=True)
    # Existing source files and prior evidence must never be overwritten.
    with target.open("x", encoding="utf-8", newline="\n") as output:
        output.write(json.dumps(report, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=LOCAL, help="Previously captured local originals; never fetched")
    parser.add_argument("--output", type=Path, help="New JSON file inside ignored artifacts/readiness; never overwritten")
    args = parser.parse_args()
    try:
        result = review(args.source_dir)
        if args.output:
            write_local_report(result, args.output)
    except (OSError, ValueError, csv.Error, KeyError, zipfile.BadZipFile) as error:
        parser.exit(2, "Research input rejected: " + str(error) + "\n")
    summary = {k: result[k] for k in ["status", "county_count", "candidate_rows", "candidate_totals",
               "resolved_independent_geography_matches", "runtime_eligible", "current_2026_source_admitted",
               "chronological_calibration", "source_requests"]}
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
