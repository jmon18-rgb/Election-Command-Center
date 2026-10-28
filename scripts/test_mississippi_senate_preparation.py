"""CI uses explicitly fictional CSV/HTML fixtures and pinned public references.

--local-originals DIRECTORY additionally exercises the saved full originals.
They are deliberately absent from public CI; no test downloads them.
"""
import argparse
import copy
import csv
import io
import json
import tempfile
import unittest
from pathlib import Path

import inspect_mississippi_senate_preparation as source


def fixture_rows():
    # Fictitious distribution: all statewide totals in one county. This is a
    # parser contract fixture, never a historical table or a calibration case.
    names = sorted(source.census_reference())
    rows = []
    for i, name in enumerate(names):
        for candidate, (party, _, total) in source.CANDIDATES.items():
            rows.append(["Jeff Davis" if name == "Jefferson Davis" else name,
                         "U.S. Senate", "", candidate, party, str(total if i == 0 else 0)])
    return rows


def csv_text(rows, header=source.HEADER):
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(header)
    writer.writerows(rows)
    return buffer.getvalue()


class ResearchContracts(unittest.TestCase):
    def setUp(self):
        self.rows = fixture_rows()
        self.reference = source.census_reference()
        self.alias_row = ["MS", "28065", "25033", "Jeff Davis", "Jefferson Davis"]

    def test_fictional_structure_reconciles_without_becoming_a_source(self):
        groups = source.parse(csv_text(self.rows))
        alias = source.alias_reference(self.reference, [self.alias_row])
        mapping = source.join_geography(groups, self.reference, alias)
        self.assertEqual(len(mapping), 82)
        self.assertEqual(len(set(mapping.values())), 82)
        self.assertEqual(mapping["Jeff Davis"], "28065")
        totals = source.reconcile_statewide(groups)
        self.assertEqual(totals, {"dem_votes": 578691, "rep_votes": 709511, "other_votes": 23152})
        self.assertEqual(sum(totals.values()), 1311354)

    def test_candidate_count_and_coverage_rejections(self):
        for label in ["name", "party", "office", "district", "county", "duplicate", "missing",
                      "negative", "decimal", "blank", "leading_zero", "spacing", "total", "extra_field", "missing_field"]:
            rows = copy.deepcopy(self.rows)
            if label == "name": rows[0][3] = "Unreviewed Candidate"
            elif label == "party": rows[0][4] = "Republican"
            elif label == "office": rows[0][1] = "State Senate"
            elif label == "district": rows[0][2] = "01"
            elif label == "county": rows[0][0] = "Unknown County"
            elif label == "duplicate": rows.append(rows[0])
            elif label == "missing": rows.pop()
            elif label == "negative": rows[0][5] = "-1"
            elif label == "decimal": rows[0][5] = "1.5"
            elif label == "blank": rows[0][5] = ""
            elif label == "leading_zero": rows[0][5] = "01"
            elif label == "spacing": rows[0][5] = " 1"
            elif label == "total": rows[0][5] = str(int(rows[0][5]) + 1)
            elif label == "extra_field": rows[0].append("unreviewed")
            else: rows[0].pop()
            with self.subTest(label=label), self.assertRaises(ValueError):
                source.parse(csv_text(rows))
        with self.assertRaisesRegex(ValueError, "header"):
            source.parse(csv_text(self.rows, ["region", *source.HEADER[1:]]))

    def test_state_fips_and_duplicate_alias_rejections(self):
        for row in [["LA", "22053", "19027", "Jeff Davis", "Jefferson Davis"],
                    ["MS", "28063", "25033", "Jeff Davis", "Jefferson Davis"],
                    ["MS", "28065", "25033", "Jefferson", "Jefferson Davis"]]:
            with self.subTest(row=row), self.assertRaises(ValueError):
                source.alias_reference(self.reference, [row])
        with self.assertRaises(ValueError):
            source.alias_reference(self.reference, [self.alias_row, self.alias_row])
        changed = dict(self.reference, **{"Jefferson Davis": "28063"})
        with self.assertRaises(ValueError):
            source.alias_reference(changed, [self.alias_row])
        alias = source.alias_reference(self.reference, [self.alias_row])
        groups = source.parse(csv_text(self.rows))
        changed = dict(groups)
        changed["Jefferson"] = changed.pop("Jeff Davis")
        with self.assertRaises(ValueError):
            source.join_geography(changed, self.reference, alias)

    def test_identity_table_uses_cells_not_unrelated_page_prose(self):
        table = source.IdentityTable()
        table.feed("<p>MS 28065 25033 Jeff Davis Jefferson Davis</p>")
        with self.assertRaises(ValueError):
            source.alias_reference(self.reference, table.rows)
        table.feed("<table><tr><td>MS</td><td>28065</td><td>25033</td>"
                   "<td>Jeff <b>Davis</b></td><td>Jefferson&nbsp;Davis</td></tr></table>")
        self.assertEqual(source.alias_reference(self.reference, table.rows)["fips"], "28065")

    def test_original_hashes_and_size_are_not_replaceable_by_a_valid_looking_fixture(self):
        body = csv_text(self.rows).encode()
        with self.assertRaisesRegex(ValueError, "Pinned original"):
            source.checked(body, source.SOURCE_SHA, source.SOURCE_BYTES)
        for pin in [source.SOURCE_SHA, source.CENSUS_SHA, source.ALIAS_SHA]:
            with self.assertRaises(ValueError):
                source.checked(b"not the saved original", pin)

    def test_output_cannot_overwrite_or_enter_runtime_directories(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = root / "artifacts/readiness/research.json"
            report = {"runtime_eligible": False}
            source.write_local_report(report, target, root)
            self.assertEqual(json.loads(target.read_text()), report)
            with self.assertRaises(FileExistsError):
                source.write_local_report(report, target, root)
            for path in [root / "data/research.json", root / "artifacts/readiness/../../public.json",
                         root / "artifacts/readiness/source.csv"]:
                with self.subTest(path=path), self.assertRaises(ValueError):
                    source.write_local_report(report, path, root)


def run_local_original_tests(directory):
    class SavedOriginals(unittest.TestCase):
        def test_actual_saved_complete_input_remains_excluded(self):
            report = source.review(directory)
            self.assertEqual((report["county_count"], report["candidate_rows"]), (82, 246))
            self.assertEqual(report["resolved_independent_geography_matches"], 82)
            self.assertEqual(next(r for r in report["counties"] if r["publisher_county"] == "Jeff Davis")["independent_fips"], "28065")
            self.assertEqual(sum(r["published_candidate_votes"] for r in report["counties"]), 1311354)
            for field in ["runtime_eligible", "current_2026_source_admitted", "chronological_calibration",
                          "reuse_rights_established", "native_official_certification_reviewed"]:
                self.assertIs(report[field], False)
            self.assertEqual(report["source_requests"], 0)

        def test_saved_alias_receipt_rejects_wrong_identity_or_capture_clocks(self):
            receipt = json.loads((directory / source.ALIAS_RECEIPT).read_text())
            with tempfile.TemporaryDirectory() as tmp:
                folder = Path(tmp)
                (folder / source.ALIAS_FILE).write_bytes((directory / source.ALIAS_FILE).read_bytes())
                for patch in [{"http_status": 403}, {"sha256": "0" * 64}, {"original_bytes": 60644},
                              {"final_url": "https://example.invalid/"}, {"capture_completed_at": None},
                              {"capture_completed_at": "2026-10-01T00:00:00Z"},
                              {"capture_completed_at": "2026-10-28T14:00:00"}]:
                    (folder / source.ALIAS_RECEIPT).write_text(json.dumps({**receipt, **patch}))
                    with self.subTest(patch=patch), self.assertRaises(ValueError):
                        source.alias_document(folder)
    return unittest.defaultTestLoader.loadTestsFromTestCase(SavedOriginals)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--local-originals", type=Path)
    args = parser.parse_args()
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(ResearchContracts)
    if args.local_originals:
        suite.addTests(run_local_original_tests(args.local_originals))
        print("Scope: synthetic contracts PLUS pinned saved originals; no source requests.")
    else:
        print("Scope: synthetic contracts and existing public references only. Full originals remain local; not exercised in CI.")
    raise SystemExit(0 if unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful() else 1)
