"""Strict offline FL-04 historical comparison, excluded from every live model.

The publisher HTML and full derived report remain local. No downloader, model
import, automatic correction, boundary admission, or source-rights inference.
"""
import argparse
import hashlib
import json
import re
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / "artifacts/readiness/early-house-geography"
URL = "https://docs.google.com/spreadsheets/d/1eZfaFI-c-PFOoKx1-zZA2MP0_dxRq_LVK0re3BOQqy0/edit?gid=1491069057"
SHA256 = "105187a8fc3d559e86e2d9e52101059cd3450a3641c1c5c032105873a416ac49"
BYTE_COUNT = 357832
GID = "1491069057"
TITLE = "The Downballot's 2020 & 2024 presidential election results for congressional districts used in the 2026 elections - Google Sheets"
LIMIT = 12_000_000


class Sheet(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.row = None
        self.cell = None
        self.title = []
        self.in_head = False
        self.in_title = False
        self.title_count = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "head":
            self.in_head = True
        elif tag == "title" and self.in_head:
            self.in_title = True
            self.title_count += 1
        elif tag == "tr":
            self.row = {"id": None, "cells": []}
        elif tag == "th" and self.row is not None:
            self.row["id"] = attrs.get("id")
        elif tag == "td" and self.row is not None:
            self.cell = {"text": [], "rowspan": attrs.get("rowspan", "1"),
                         "colspan": attrs.get("colspan", "1")}

    def handle_data(self, data):
        if self.in_title:
            self.title.append(data)
        if self.cell is not None:
            self.cell["text"].append(data)

    def handle_endtag(self, tag):
        if tag == "head":
            self.in_head = False
        elif tag == "title":
            self.in_title = False
        elif tag == "td" and self.cell is not None:
            self.cell["text"] = " ".join("".join(self.cell["text"]).split())
            self.row["cells"].append(self.cell)
            self.cell = None
        elif tag == "tr" and self.row is not None:
            if self.row["id"]:
                self.rows.append(self.row)
            self.row = None


def require(condition, message):
    if not condition:
        raise ValueError(message)


def integer(text):
    require(isinstance(text, str) and re.fullmatch(
        r"(?:0|[1-9][0-9]*|[1-9][0-9]{0,2}(?:,[0-9]{3})+)", text), "Invalid integer votes")
    value = int(text.replace(",", ""))
    require(0 < value <= 10_000_000, "Votes outside historical bounds")
    return value


def percent(text):
    require(isinstance(text, str) and re.fullmatch(r"-?\d{1,3}\.\d{2}%", text),
            "Invalid printed percentage")
    return float(text[:-1])


def inspect_html(body):
    require(isinstance(body, bytes) and 0 < len(body) <= LIMIT, "Invalid HTML size")
    parser = Sheet()
    parser.feed(body.decode("utf-8", errors="strict"))
    require(parser.title_count == 1 and " ".join("".join(parser.title).split()) == TITLE,
            "Wrong publisher/map title")

    def header(row_id):
        rows = [r for r in parser.rows if r["id"] == GID + row_id]
        require(len(rows) == 1, "Missing or duplicate year header")
        return rows[0]["cells"]

    years = header("R2")
    require([(c["text"], c["rowspan"], c["colspan"]) for c in years] == [
        ("District", "2", "1"), ("Incumbent", "2", "1"), ("Party", "2", "1"),
        ("2024", "1", "6"), ("2020", "1", "6")], "Year/column contract mismatch")
    columns = header("R3")
    require([c["text"] for c in columns] == [
        "Harris", "Trump", "Total", "Harris %", "Trump %", "Margin",
        "Biden", "Trump", "Total", "Biden %", "Trump %", "Margin"] and
        all(c["rowspan"] == c["colspan"] == "1" for c in columns),
        "Candidate/denominator header mismatch")
    rows = [r for r in parser.rows if r["cells"] and r["cells"][0]["text"] == "FL-04"]
    require(len(rows) == 1, "Missing or duplicate exact FL-04 row")
    row = rows[0]
    require(re.fullmatch(GID + r"R\d+", row["id"] or ""), "Wrong sheet row identity")
    cells = row["cells"]
    require(len(cells) == 15 and all(c["rowspan"] == c["colspan"] == "1" for c in cells),
            "Unsupported target row layout")
    values = [c["text"] for c in cells]
    dem, rep, total = map(integer, values[3:6])
    require(total >= dem + rep, "All-candidate total below named candidates")
    printed_dem, printed_rep, printed_margin = map(percent, values[6:9])
    all_dem, all_rep = 100 * dem / total, 100 * rep / total
    require(abs(all_dem - printed_dem) <= .00501 and abs(all_rep - printed_rep) <= .00501,
            "Printed share/total mismatch")
    require(abs(all_dem - all_rep - printed_margin) <= .00501, "Printed all-candidate margin mismatch")
    return {"race_code": "FL-04", "election_year": 2024, "publisher_claimed_map_year": 2026,
            "sheet_row_id": row["id"], "dem_votes": dem, "rep_votes": rep,
            "all_candidate_votes": total, "other_votes": total - dem - rep,
            "published_all_candidate_margin_points": printed_margin,
            "computed_two_party_margin_points": 100 * (dem - rep) / (dem + rep),
            "other_election_columns_used": False}


def inspect_capture(body, receipt):
    require(isinstance(receipt, dict), "Receipt must be an object")
    require(len(body) == BYTE_COUNT and hashlib.sha256(body).hexdigest() == SHA256,
            "Pinned original bytes/hash mismatch")
    require(receipt.get("http") == 200 and receipt.get("requested_url") == URL and
            receipt.get("final_url") == URL and receipt.get("bytes") == len(body) and
            receipt.get("sha256") == SHA256, "Receipt does not bind exact original")
    clocks = []
    for key in ("requested_at", "completed_at"):
        text = receipt.get(key)
        require(isinstance(text, str) and text.endswith("Z"), "Receipt clock missing")
        clocks.append(datetime.fromisoformat(text.replace("Z", "+00:00")))
    require(clocks[0] <= clocks[1], "Receipt clocks reversed")
    return inspect_html(body)


def compare(reference, staging):
    require(staging.get("election_year") == 2024 and staging.get("district_map_year_claimed") == 2026,
            "Staging election/map identity mismatch")
    rows = [r for r in staging.get("records", []) if r.get("race_code") == "FL-04"]
    require(len(rows) == 1, "Missing or duplicate staging district")
    row = rows[0]
    require(row.get("state") == "FL", "Staging state mismatch")
    dem, rep = row.get("dem_pres_2024_votes"), row.get("rep_pres_2024_votes")
    require(all(type(v) is int and 0 < v <= 10_000_000 for v in (dem, rep)), "Staging votes invalid")
    old_margin = 100 * (dem - rep) / (dem + rep)
    supplied = row.get("dem_minus_rep_two_party_points")
    require(type(supplied) in (float, int) and abs(supplied - old_margin) <= .000501,
            "Staging two-party margin/count mismatch")
    delta = reference["computed_two_party_margin_points"] - old_margin
    return {"status": "RESEARCH_ONLY_NOT_RUNTIME", "districts_compared": 1,
            "reference": reference, "staging_source": staging.get("external_source_url"),
            "staging_blob_sha": staging.get("external_source_blob_sha"),
            "cached_counts_equal": dem == reference["dem_votes"] and rep == reference["rep_votes"],
            "publisher_minus_cached_votes": {"dem": reference["dem_votes"] - dem,
                                              "rep": reference["rep_votes"] - rep},
            "two_party_margin_difference_points": delta,
            "two_party_margin_agreement_within_0_01_points": abs(delta) <= .01,
            "automatic_pin_replacement": False, "runtime_admitted": False,
            "independent_official_precinct_geometry_verified": False,
            "upstream_lineage_independence_established": False,
            "source_specific_redistribution_rights_established": False,
            "calibration_claim": False,
            "limits": ["Publisher map-year claim is not an official precinct-to-plan reconciliation.",
                       "Preserve both pins; close margins never waive unequal counts or establish why they differ.",
                       "Two-party and all-candidate margins have distinct denominators.",
                       "No 2026 native feed, chronology, held-out evaluation or predictive accuracy claim."]}


def write_local(path, data):
    path = Path(path).resolve()
    base = LOCAL.resolve()
    require(base.parent == (ROOT / "artifacts/readiness").resolve() and
            path.parent == base and path.suffix == ".json" and not path.exists(),
            "Output must be a new JSON directly in ignored early-house-geography")
    with path.open("x", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=LOCAL / "downballot-exact-totals-sheet-20261028.html")
    parser.add_argument("--receipt", type=Path, default=LOCAL / "downballot-exact-totals-sheet-20261028-receipt.json")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    require(args.source.stat().st_size <= LIMIT, "Original oversize")
    require(args.receipt.stat().st_size <= 32_000, "Receipt oversize")
    body = args.source.read_bytes()
    reference = inspect_capture(body, json.loads(args.receipt.read_text(encoding="utf-8")))
    staging = json.loads((ROOT / "data/presidential_2024_by_2026_district_staging.json").read_text(encoding="utf-8"))
    report = compare(reference, staging)
    if args.output:
        write_local(args.output, report)
    print(json.dumps({key: report[key] for key in ("status", "districts_compared", "cached_counts_equal",
          "two_party_margin_agreement_within_0_01_points", "runtime_admitted", "calibration_claim")}, indent=2))


if __name__ == "__main__":
    main()
